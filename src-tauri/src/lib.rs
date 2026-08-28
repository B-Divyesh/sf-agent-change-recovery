use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Manager;
use walkdir::{DirEntry, WalkDir};

const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_FILES: usize = 8_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    path: String,
    kind: String,
    additions: usize,
    deletions: usize,
    diff: Vec<String>,
    #[serde(default)]
    restored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    id: String,
    intent: String,
    detail: String,
    created_at: String,
    commands: Vec<String>,
    files: Vec<FileChange>,
    checks: String,
    check_passed: bool,
    #[serde(default)]
    safety: bool,
    project_path: String,
}

fn now_id() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}

fn clock_label() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{:02}:{:02}", (seconds / 3600) % 24, (seconds / 60) % 60)
}

fn project_key(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    format!("{:x}", hasher.finalize())[..16].to_string()
}

fn ignored(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    if entry.depth() == 0 {
        return true;
    }
    !(entry.file_type().is_dir()
        && matches!(
            name.as_ref(),
            ".git" | "node_modules" | "target" | "dist" | ".recovery-ledger"
        ))
}

fn read_project(root: &Path) -> Result<BTreeMap<String, Vec<u8>>, String> {
    if !root.is_dir() {
        return Err("The project folder does not exist or is not a directory.".into());
    }
    let mut files = BTreeMap::new();
    for item in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(ignored)
    {
        let entry = item.map_err(|error| format!("A project file could not be read: {error}"))?;
        if !entry.file_type().is_file() {
            continue;
        }
        if files.len() >= MAX_FILES {
            return Err(format!(
                "This folder has more than {MAX_FILES} files. Choose a smaller project folder."
            ));
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.len() > MAX_FILE_BYTES {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|error| error.to_string())?;
        let key = relative.to_string_lossy().replace('\\', "/");
        files.insert(
            key,
            fs::read(entry.path())
                .map_err(|error| format!("Could not read {relative:?}: {error}"))?,
        );
    }
    Ok(files)
}

fn load_snapshot(dir: &Path) -> Result<BTreeMap<String, Vec<u8>>, String> {
    let snapshot = dir.join("files");
    if !snapshot.exists() {
        return Ok(BTreeMap::new());
    }
    read_project(&snapshot)
}

fn text_lines(bytes: &[u8]) -> Option<Vec<String>> {
    std::str::from_utf8(bytes)
        .ok()
        .map(|text| text.lines().map(str::to_owned).collect())
}

fn describe_change(path: &str, before: Option<&Vec<u8>>, after: Option<&Vec<u8>>) -> FileChange {
    let kind = match (before, after) {
        (None, Some(_)) => "added",
        (Some(_), None) => "deleted",
        _ => "modified",
    };
    let old_lines = before.and_then(|bytes| text_lines(bytes));
    let new_lines = after.and_then(|bytes| text_lines(bytes));
    let deletions = old_lines.as_ref().map_or(0, Vec::len);
    let additions = new_lines.as_ref().map_or(0, Vec::len);
    let mut diff = Vec::new();
    match (old_lines, new_lines) {
        (Some(old), Some(new)) => {
            for line in old.into_iter().take(60) {
                diff.push(format!("- {line}"));
            }
            for line in new.into_iter().take(60) {
                diff.push(format!("+ {line}"));
            }
        }
        (None, Some(new)) => {
            for line in new.into_iter().take(120) {
                diff.push(format!("+ {line}"));
            }
        }
        (Some(old), None) => {
            for line in old.into_iter().take(120) {
                diff.push(format!("- {line}"));
            }
        }
        _ => diff.push("Binary content changed".into()),
    }
    FileChange {
        path: path.into(),
        kind: kind.into(),
        additions,
        deletions,
        diff,
        restored: false,
    }
}

fn changes_between(
    before: &BTreeMap<String, Vec<u8>>,
    after: &BTreeMap<String, Vec<u8>>,
) -> Vec<FileChange> {
    let mut paths: Vec<&String> = before.keys().chain(after.keys()).collect();
    paths.sort();
    paths.dedup();
    paths
        .into_iter()
        .filter(|path| before.get(*path) != after.get(*path))
        .map(|path| describe_change(path, before.get(path), after.get(path)))
        .collect()
}

fn save_snapshot(files: &BTreeMap<String, Vec<u8>>, dir: &Path) -> Result<(), String> {
    let root = dir.join("files");
    for (relative, content) in files {
        let target = root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(target, content).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn checkpoint_dirs(project_store: &Path) -> Result<Vec<PathBuf>, String> {
    if !project_store.exists() {
        return Ok(Vec::new());
    }
    let mut dirs: Vec<PathBuf> = fs::read_dir(project_store)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("manifest.json").exists())
        .collect();
    dirs.sort();
    Ok(dirs)
}

fn read_manifest(dir: &Path) -> Result<Checkpoint, String> {
    let bytes = fs::read(dir.join("manifest.json")).map_err(|error| error.to_string())?;
    serde_json::from_slice(&bytes).map_err(|error| error.to_string())
}

fn list_manifests(project_store: &Path) -> Result<Vec<Checkpoint>, String> {
    checkpoint_dirs(project_store)?
        .iter()
        .map(|dir| read_manifest(dir))
        .collect()
}

fn free_limit_reached(count: usize, pro: bool) -> bool {
    !pro && count >= 7
}

fn write_checkpoint(
    project_path: &Path,
    project_store: &Path,
    intent: String,
    commands: Vec<String>,
    safety: bool,
) -> Result<Vec<Checkpoint>, String> {
    let current = read_project(project_path)?;
    let dirs = checkpoint_dirs(project_store)?;
    let previous = dirs
        .last()
        .map(|dir| load_snapshot(dir))
        .transpose()?
        .unwrap_or_default();
    let changes = changes_between(&previous, &current);
    let id = now_id();
    let checkpoint_dir = project_store.join(&id);
    fs::create_dir_all(&checkpoint_dir).map_err(|error| error.to_string())?;
    save_snapshot(&current, &checkpoint_dir)?;
    let checkpoint = Checkpoint {
        id,
        intent,
        detail: if safety {
            "Saved automatically before selected files were reversed.".into()
        } else {
            "Captured from the selected local project folder.".into()
        },
        created_at: clock_label(),
        commands,
        files: changes,
        checks: "Not run by the ledger".into(),
        check_passed: true,
        safety,
        project_path: project_path.to_string_lossy().into_owned(),
    };
    fs::write(
        checkpoint_dir.join("manifest.json"),
        serde_json::to_vec_pretty(&checkpoint).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    list_manifests(project_store)
}

fn safe_relative(path: &str) -> Result<&Path, String> {
    let relative = Path::new(path);
    if relative.as_os_str().is_empty()
        || relative.components().any(|part| {
            matches!(
                part,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("A selected file path is outside the project folder.".into());
    }
    Ok(relative)
}

#[tauri::command]
fn capture_checkpoint(
    app: tauri::AppHandle,
    path: String,
    intent: String,
    commands: Vec<String>,
    pro: bool,
    retention: usize,
) -> Result<Vec<Checkpoint>, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    fs::create_dir_all(&store).map_err(|error| error.to_string())?;
    if free_limit_reached(checkpoint_dirs(&store)?.len(), pro) {
        return Err(
            "The free ledger keeps 7 checkpoints. Add an active Pro license to capture more."
                .into(),
        );
    }
    write_checkpoint(&project_path, &store, intent, commands, false)?;
    if pro && retention > 0 {
        let dirs = checkpoint_dirs(&store)?;
        let remove_count = dirs.len().saturating_sub(retention);
        for dir in dirs.into_iter().take(remove_count) {
            fs::remove_dir_all(dir).map_err(|error| error.to_string())?;
        }
    }
    list_manifests(&store)
}

#[tauri::command]
fn restore_files(
    app: tauri::AppHandle,
    path: String,
    checkpoint_id: String,
    files: Vec<String>,
) -> Result<Vec<Checkpoint>, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let dirs = checkpoint_dirs(&store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(&checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    if index == 0 {
        return Err("The first checkpoint has no earlier state to restore.".into());
    }
    write_checkpoint(
        &project_path,
        &store,
        "Safety checkpoint before reversal".into(),
        vec!["No commands run".into()],
        true,
    )?;
    let previous = load_snapshot(&dirs[index - 1])?;
    for relative in &files {
        let target = project_path.join(safe_relative(relative)?);
        if let Some(content) = previous.get(relative) {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&target, content)
                .map_err(|error| format!("Could not restore {relative}: {error}"))?;
        } else if target.exists() {
            fs::remove_file(&target)
                .map_err(|error| format!("Could not remove {relative}: {error}"))?;
        }
    }
    list_manifests(&store)
}

#[tauri::command]
fn export_patch(
    app: tauri::AppHandle,
    path: String,
    checkpoint_id: String,
    files: Vec<String>,
) -> Result<String, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let dirs = checkpoint_dirs(&store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(&checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    let current = load_snapshot(&dirs[index])?;
    let previous = if index > 0 {
        load_snapshot(&dirs[index - 1])?
    } else {
        BTreeMap::new()
    };
    let patch = patch_text(&previous, &current, &files);
    let export_dir = base.join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let target = export_dir.join(format!("recovery-{checkpoint_id}.patch"));
    fs::write(&target, patch).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

fn patch_text(
    previous: &BTreeMap<String, Vec<u8>>,
    current: &BTreeMap<String, Vec<u8>>,
    files: &[String],
) -> String {
    let mut patch = String::new();
    for path in files {
        let before = previous.get(path);
        let after = current.get(path);
        if before == after {
            continue;
        }
        let old_lines = match before {
            Some(bytes) => match patch_lines(bytes) {
                Some(lines) => lines,
                None => continue,
            },
            None => Vec::new(),
        };
        let new_lines = match after {
            Some(bytes) => match patch_lines(bytes) {
                Some(lines) => lines,
                None => continue,
            },
            None => Vec::new(),
        };
        let old_start = if old_lines.is_empty() { 0 } else { 1 };
        let new_start = if new_lines.is_empty() { 0 } else { 1 };
        let old_path = if before.is_some() {
            format!("a/{path}")
        } else {
            "/dev/null".into()
        };
        let new_path = if after.is_some() {
            format!("b/{path}")
        } else {
            "/dev/null".into()
        };
        patch.push_str(&format!(
            "diff --git a/{path} b/{path}\n--- {old_path}\n+++ {new_path}\n@@ -{old_start},{} +{new_start},{} @@\n",
            old_lines.len(),
            new_lines.len()
        ));
        for line in old_lines {
            patch.push('-');
            patch.push_str(&line);
            patch.push('\n');
        }
        for line in new_lines {
            patch.push('+');
            patch.push_str(&line);
            patch.push('\n');
        }
        patch.push('\n');
    }
    patch
}

fn patch_lines(bytes: &[u8]) -> Option<Vec<String>> {
    let text = std::str::from_utf8(bytes).ok()?;
    Some(text.lines().map(str::to_owned).collect())
}

fn encrypt_bytes(content: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    if passphrase.chars().count() < 12 {
        return Err("Use a passphrase with at least 12 characters.".into());
    }
    let mut salt = [0_u8; 16];
    let mut nonce_bytes = [0_u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);
    let mut key = [0_u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), &salt, &mut key)
        .map_err(|error| error.to_string())?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), content)
        .map_err(|_| "Encryption failed.".to_string())?;
    let mut output = b"CRL1".to_vec();
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&encrypted);
    Ok(output)
}

#[tauri::command]
fn export_encrypted(
    app: tauri::AppHandle,
    path: String,
    checkpoint_id: String,
    files: Vec<String>,
    passphrase: String,
) -> Result<String, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let dirs = checkpoint_dirs(&store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(&checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    let current = load_snapshot(&dirs[index])?;
    let previous = if index > 0 {
        load_snapshot(&dirs[index - 1])?
    } else {
        BTreeMap::new()
    };
    let encrypted = encrypt_bytes(
        patch_text(&previous, &current, &files).as_bytes(),
        &passphrase,
    )?;
    let export_dir = base.join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let target = export_dir.join(format!("recovery-{checkpoint_id}.crl"));
    fs::write(&target, encrypted).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture_checkpoint,
            restore_files,
            export_patch,
            export_encrypted
        ])
        .run(tauri::generate_context!())
        .expect("error while running Change Recovery Ledger");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        process::{Command, Stdio},
    };

    #[test]
    fn ignores_generated_folders() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("src")).unwrap();
        fs::create_dir_all(root.path().join("node_modules/pkg")).unwrap();
        fs::write(root.path().join("src/main.ts"), "keep").unwrap();
        fs::write(root.path().join("node_modules/pkg/index.js"), "skip").unwrap();
        let files = read_project(root.path()).unwrap();
        assert!(files.contains_key("src/main.ts"));
        assert!(!files.keys().any(|path| path.starts_with("node_modules")));
    }

    #[test]
    fn finds_only_changed_files() {
        let before = BTreeMap::from([
            ("a.ts".into(), b"old".to_vec()),
            ("same.ts".into(), b"same".to_vec()),
        ]);
        let after = BTreeMap::from([
            ("a.ts".into(), b"new".to_vec()),
            ("same.ts".into(), b"same".to_vec()),
        ]);
        let changes = changes_between(&before, &after);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "a.ts");
    }

    #[test]
    fn rejects_paths_outside_project() {
        assert!(safe_relative("../secret.txt").is_err());
        assert!(safe_relative("src/main.ts").is_ok());
    }

    #[test]
    fn free_history_stops_after_seven_checkpoints() {
        assert!(!free_limit_reached(6, false));
        assert!(free_limit_reached(7, false));
        assert!(!free_limit_reached(7, true));
    }

    #[test]
    fn encrypted_export_has_versioned_header_and_hides_plaintext() {
        let output = encrypt_bytes(b"diff --git secret", "correct horse battery staple").unwrap();
        assert_eq!(&output[..4], b"CRL1");
        assert!(!output.windows(6).any(|window| window == b"secret"));
    }

    #[test]
    fn patch_export_is_standard_unified_diff_and_dry_runs() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("src/auth")).unwrap();
        fs::write(
            root.path().join("src/auth/session.ts"),
            "const old = true\n",
        )
        .unwrap();
        let previous =
            BTreeMap::from([("src/auth/session.ts".into(), b"const old = true\n".to_vec())]);
        let current = BTreeMap::from([(
            "src/auth/session.ts".into(),
            b"const current = true\nconst queued = false\n".to_vec(),
        )]);
        let patch = patch_text(&previous, &current, &["src/auth/session.ts".into()]);
        assert!(patch.contains("@@ -1,1 +1,2 @@"));
        let mut child = Command::new("patch")
            .args(["--batch", "--dry-run", "-p1", "-d"])
            .arg(root.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .expect("patch must be installed for the patch export regression test");
        child
            .stdin
            .take()
            .unwrap()
            .write_all(patch.as_bytes())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    #[test]
    fn project_files_stay_within_the_chosen_folder() {
        let root = tempfile::tempdir().unwrap();
        let chosen = root.path().join("chosen");
        fs::create_dir_all(&chosen).unwrap();
        fs::write(chosen.join("inside.txt"), "keep").unwrap();
        fs::write(root.path().join("outside.txt"), "do not read").unwrap();
        let files = read_project(&chosen).unwrap();
        assert_eq!(files.get("inside.txt"), Some(&b"keep".to_vec()));
        assert!(!files.values().any(|content| content == b"do not read"));
    }

    #[test]
    fn skips_files_larger_than_two_megabytes() {
        let root = tempfile::tempdir().unwrap();
        fs::write(root.path().join("small.txt"), "record").unwrap();
        fs::write(
            root.path().join("large.bin"),
            vec![0_u8; MAX_FILE_BYTES as usize + 1],
        )
        .unwrap();
        let files = read_project(root.path()).unwrap();
        assert!(files.contains_key("small.txt"));
        assert!(!files.contains_key("large.bin"));
    }

    #[test]
    fn excludes_git_metadata_from_checkpoints() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join(".git")).unwrap();
        fs::write(root.path().join(".git/HEAD"), "ref: refs/heads/main").unwrap();
        fs::write(root.path().join("tracked.txt"), "project file").unwrap();
        let files = read_project(root.path()).unwrap();
        assert!(files.contains_key("tracked.txt"));
        assert!(!files.keys().any(|path| path.starts_with(".git/")));
    }
}
