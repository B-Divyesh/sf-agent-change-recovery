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
const MAX_RECOVERY_BYTES: u64 = 32 * 1024 * 1024;

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

fn checkpoint_id(project_store: &Path) -> Result<String, String> {
    let base = now_id();
    for suffix in 0..10_000 {
        let id = if suffix == 0 {
            base.clone()
        } else {
            format!("{base}-{suffix}")
        };
        if !project_store.join(&id).exists() {
            return Ok(id);
        }
    }
    Err("Could not allocate a unique checkpoint identifier.".into())
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

fn write_checkpoint(
    project_path: &Path,
    project_store: &Path,
    intent: String,
    commands: Vec<String>,
    safety: bool,
    files_override: Option<Vec<FileChange>>,
) -> Result<Vec<Checkpoint>, String> {
    let current = read_project(project_path)?;
    let dirs = checkpoint_dirs(project_store)?;
    let previous = dirs
        .last()
        .map(|dir| load_snapshot(dir))
        .transpose()?
        .unwrap_or_default();
    let changes = files_override.unwrap_or_else(|| changes_between(&previous, &current));
    let id = checkpoint_id(project_store)?;
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
    let _ = (pro, retention);
    write_checkpoint(&project_path, &store, intent, commands, false, None)?;
    list_manifests(&store)
}

#[tauri::command]
fn load_ledger(app: tauri::AppHandle, path: String) -> Result<Vec<Checkpoint>, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    list_manifests(&base.join("ledgers").join(project_key(&project_path)))
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
    restore_files_in_store(&project_path, &store, &checkpoint_id, &files)
}

fn restore_files_in_store(
    project_path: &Path,
    store: &Path,
    checkpoint_id: &str,
    files: &[String],
) -> Result<Vec<Checkpoint>, String> {
    if files.is_empty() {
        return Err("Select at least one file to reverse.".into());
    }
    let dirs = checkpoint_dirs(store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    if index == 0 {
        return Err("The first checkpoint has no earlier state to restore.".into());
    }
    let source_manifest = read_manifest(&dirs[index])?;
    let mut safety_files = Vec::with_capacity(files.len());
    for relative in files {
        safe_relative(relative)?;
        let change = source_manifest
            .files
            .iter()
            .find(|change| change.path == *relative)
            .cloned()
            .ok_or_else(|| format!("{relative} is not selectable in this checkpoint."))?;
        if !safety_files
            .iter()
            .any(|saved: &FileChange| saved.path == change.path)
        {
            safety_files.push(FileChange {
                restored: false,
                ..change
            });
        }
    }
    write_checkpoint(
        project_path,
        store,
        "Safety checkpoint before reversal".into(),
        vec!["No commands run".into()],
        true,
        Some(safety_files),
    )?;
    // A safety checkpoint stores the exact pre-reversal bytes. Selecting it must
    // restore that snapshot, rather than merely replaying its earlier neighbour.
    let restore_from = if source_manifest.safety {
        load_snapshot(&dirs[index])?
    } else {
        load_snapshot(&dirs[index - 1])?
    };
    for relative in files {
        let target = project_path.join(safe_relative(relative)?);
        if let Some(content) = restore_from.get(relative) {
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
    list_manifests(store)
}

fn delete_ledger_store(store: &Path) -> Result<(), String> {
    if store.exists() {
        fs::remove_dir_all(store).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn write_sample_files(root: &Path, files: &[(&str, &str)]) -> Result<(), String> {
    for (relative, content) in files {
        let target = root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(target, content).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn load_bundled_sample(base: &Path) -> Result<(PathBuf, Vec<Checkpoint>), String> {
    let project = base.join("sample-project");
    if project.exists() {
        fs::remove_dir_all(&project).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&project).map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project));
    delete_ledger_store(&store)?;
    write_sample_files(
        &project,
        &[
            (
                "src/auth/session.ts",
                "export async function refresh() {\n  return renewOnce()\n}\n",
            ),
            (
                "src/editor/autosave.ts",
                "export async function save() {\n  await ensureSession()\n}\n",
            ),
            (
                "src/account/profile.ts",
                "export function profile() {\n  return renewSession()\n}\n",
            ),
        ],
    )?;
    write_checkpoint(
        &project,
        &store,
        "Baseline before session refactor".into(),
        vec!["npm test -- session".into()],
        false,
        None,
    )?;
    write_sample_files(
        &project,
        &[
            ("src/auth/session.ts", "export async function refresh() {\n  return refreshQueue.current ?? renewOnce()\n}\n"),
            ("src/editor/autosave.ts", "export async function save() {\n  await session.refresh()\n  scheduleNextSave()\n}\n"),
            ("src/account/profile.ts", "export function profile() {\n  return session.refresh({ source: 'profile' })\n}\n"),
            ("src/auth/refresh-queue.ts", "export class RefreshQueue {\n  current?: Promise<string>\n}\n"),
        ],
    )?;
    let ledger = write_checkpoint(
        &project,
        &store,
        "Refactor session refresh".into(),
        vec!["npm test -- session".into(), "npm test -- editor".into()],
        false,
        None,
    )?;
    Ok((project, ledger))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SampleProject {
    path: String,
    ledger: Vec<Checkpoint>,
}

#[tauri::command]
fn load_sample_project(app: tauri::AppHandle, _reset: bool) -> Result<SampleProject, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let (path, ledger) = load_bundled_sample(&base)?;
    Ok(SampleProject {
        path: path.to_string_lossy().into_owned(),
        ledger,
    })
}

#[tauri::command]
fn delete_ledger(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    delete_ledger_store(&base.join("ledgers").join(project_key(&project_path)))
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

fn decrypt_bytes(content: &[u8], passphrase: &str) -> Result<Vec<u8>, String> {
    const HEADER_BYTES: usize = 4 + 16 + 12;
    const AUTH_TAG_BYTES: usize = 16;
    if content.len() < HEADER_BYTES + AUTH_TAG_BYTES || &content[..4] != b"CRL1" {
        return Err("This is not a supported Change Recovery Ledger recovery file.".into());
    }
    if passphrase.chars().count() < 12 {
        return Err("Use the recovery passphrase with at least 12 characters.".into());
    }
    let salt = &content[4..20];
    let nonce = &content[20..32];
    let encrypted = &content[HEADER_BYTES..];
    let mut key = [0_u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|error| error.to_string())?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|error| error.to_string())?;
    cipher
        .decrypt(Nonce::from_slice(nonce), encrypted)
        .map_err(|_| "The recovery file could not be opened. Check the passphrase.".to_string())
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

#[tauri::command]
fn import_encrypted_recovery(
    app: tauri::AppHandle,
    recovery_path: String,
    passphrase: String,
) -> Result<String, String> {
    let source = fs::canonicalize(Path::new(&recovery_path)).map_err(|_| {
        "The encrypted recovery file was not found. Check its full path and try again.".to_string()
    })?;
    let metadata = fs::metadata(&source).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Choose an encrypted recovery file, not a folder.".into());
    }
    if metadata.len() > MAX_RECOVERY_BYTES {
        return Err("This encrypted recovery file is too large to open safely.".into());
    }
    let patch = decrypt_bytes(
        &fs::read(&source).map_err(|error| error.to_string())?,
        &passphrase,
    )?;
    if !patch.is_empty() && !patch.starts_with(b"diff --git ") {
        return Err("The encrypted recovery does not contain a supported patch.".into());
    }
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let export_dir = base.join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let target = export_dir.join(format!("recovery-import-{}.patch", now_id()));
    fs::write(&target, patch).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            capture_checkpoint,
            load_ledger,
            restore_files,
            export_patch,
            export_encrypted,
            import_encrypted_recovery,
            delete_ledger,
            load_sample_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Change Recovery Ledger");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::Write,
        net::TcpListener,
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
    // @claim:encrypted-export
    fn claim_encrypted_export() {
        let patch =
            b"diff --git a/secret.txt b/secret.txt\n--- a/secret.txt\n+++ b/secret.txt\n+secret\n";
        let output = encrypt_bytes(patch, "correct horse battery staple").unwrap();
        assert_eq!(&output[..4], b"CRL1");
        assert!(!output.windows(6).any(|window| window == b"secret"));
    }

    #[test]
    // @claim:encrypted-import
    fn claim_encrypted_import_opens_a_patch_without_running_it() {
        let patch =
            b"diff --git a/secret.txt b/secret.txt\n--- a/secret.txt\n+++ b/secret.txt\n+secret\n";
        let output = encrypt_bytes(patch, "correct horse battery staple").unwrap();
        assert_eq!(
            decrypt_bytes(&output, "correct horse battery staple").unwrap(),
            patch
        );
        assert!(decrypt_bytes(&output, "wrong passphrase").is_err());
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
    // @claim:local-privacy
    fn claim_local_privacy() {
        let root = tempfile::tempdir().unwrap();
        let chosen = root.path().join("chosen");
        fs::create_dir_all(&chosen).unwrap();
        fs::write(chosen.join("inside.txt"), "keep").unwrap();
        fs::write(root.path().join("outside.txt"), "do not read").unwrap();
        let files = read_project(&chosen).unwrap();
        assert_eq!(files.get("inside.txt"), Some(&b"keep".to_vec()));
        assert!(!files.values().any(|content| content == b"do not read"));
        // The capture core has no outbound transport. A listening local endpoint
        // stays untouched while a unique project value is captured.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        assert!(
            matches!(listener.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
        );
    }

    #[test]
    // @claim:chosen-folder-only
    fn claim_chosen_folder_only() {
        let root = tempfile::tempdir().unwrap();
        let chosen = root.path().join("chosen");
        fs::create_dir_all(&chosen).unwrap();
        fs::write(chosen.join("inside.txt"), "keep").unwrap();
        fs::write(root.path().join("outside.txt"), "do not read").unwrap();
        let files = read_project(&chosen).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files.contains_key("inside.txt"));
    }

    #[test]
    // @claim:large-file-skip
    fn claim_large_file_skip() {
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
    // @claim:git-metadata-exclusion
    fn claim_git_metadata_exclusion() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join(".git")).unwrap();
        fs::write(root.path().join(".git/HEAD"), "ref: refs/heads/main").unwrap();
        fs::write(root.path().join("tracked.txt"), "project file").unwrap();
        let files = read_project(root.path()).unwrap();
        assert!(files.contains_key("tracked.txt"));
        assert!(!files.keys().any(|path| path.starts_with(".git/")));
    }

    #[test]
    // @claim:generated-folder-exclusions
    fn claim_generated_folder_exclusions() {
        let root = tempfile::tempdir().unwrap();
        for folder in [".git", "node_modules", "target", "dist"] {
            let nested = root.path().join(folder).join("nested");
            fs::create_dir_all(&nested).unwrap();
            fs::write(nested.join("ignored.txt"), "do not record").unwrap();
        }
        fs::write(root.path().join("keep.txt"), "record me").unwrap();
        let files = read_project(root.path()).unwrap();
        assert_eq!(files.get("keep.txt"), Some(&b"record me".to_vec()));
        for folder in [".git", "node_modules", "target", "dist"] {
            assert!(!files.keys().any(|path| path.starts_with(folder)));
        }
    }

    #[test]
    // @claim:checkpoint-record
    fn claim_checkpoint_record_keeps_request_commands_files_and_check_result() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("session.ts"), "before\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            "Fix session refresh".into(),
            vec!["npm test".into()],
            false,
            None,
        )
        .unwrap();
        fs::write(project.join("session.ts"), "after\n").unwrap();
        let checkpoint = write_checkpoint(
            &project,
            &store,
            "Fix session refresh".into(),
            vec!["npm test".into()],
            false,
            None,
        )
        .unwrap()
        .pop()
        .unwrap();
        assert_eq!(checkpoint.intent, "Fix session refresh");
        assert_eq!(checkpoint.commands, vec!["npm test"]);
        assert_eq!(checkpoint.files.len(), 1);
        assert_eq!(checkpoint.checks, "Not run by the ledger");
    }

    #[test]
    // @claim:checkpoint-comparison
    fn claim_checkpoint_comparison_uses_the_previous_snapshot() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("state.txt"), "one\n").unwrap();
        let first =
            write_checkpoint(&project, &store, "Baseline".into(), vec![], false, None).unwrap();
        assert_eq!(first.last().unwrap().files.len(), 1);
        fs::write(project.join("state.txt"), "two\n").unwrap();
        let second =
            write_checkpoint(&project, &store, "Second".into(), vec![], false, None).unwrap();
        assert_eq!(second.last().unwrap().files[0].path, "state.txt");
        fs::write(project.join("state.txt"), "three\n").unwrap();
        let third =
            write_checkpoint(&project, &store, "Third".into(), vec![], false, None).unwrap();
        assert_eq!(
            third.last().unwrap().files[0].diff,
            vec!["- two", "+ three"]
        );
    }

    #[test]
    // @claim:bundled-sample-project
    fn claim_bundled_sample_project_is_resettable_and_isolated() {
        let root = tempfile::tempdir().unwrap();
        let real = root.path().join("real-project");
        fs::create_dir_all(&real).unwrap();
        fs::write(real.join("sentinel.txt"), "real work").unwrap();
        let (sample, ledger) = load_bundled_sample(root.path()).unwrap();
        assert_ne!(sample, real);
        assert_eq!(ledger.len(), 2);
        let changed = ledger.last().unwrap();
        assert!(changed
            .files
            .iter()
            .any(|file| file.path == "src/auth/session.ts"));
        restore_files_in_store(
            &sample,
            &root.path().join("ledgers").join(project_key(&sample)),
            &changed.id,
            &["src/auth/session.ts".into()],
        )
        .unwrap();
        assert!(fs::read_to_string(sample.join("src/auth/session.ts"))
            .unwrap()
            .contains("return renewOnce()"));
        assert_eq!(
            fs::read_to_string(real.join("sentinel.txt")).unwrap(),
            "real work"
        );
        let (reset, reset_ledger) = load_bundled_sample(root.path()).unwrap();
        assert_eq!(reset, sample);
        assert_eq!(reset_ledger.len(), 2);
    }

    #[test]
    // @claim:reversible-safety-checkpoint
    fn claim_reversible_safety_checkpoint() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("alpha.txt"), "baseline alpha\n").unwrap();
        fs::write(project.join("keep.txt"), "keep baseline\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            "Baseline before agent".into(),
            vec![],
            false,
            None,
        )
        .unwrap();
        fs::write(project.join("alpha.txt"), "wrong alpha\n").unwrap();
        fs::write(project.join("keep.txt"), "unrelated keep edit\n").unwrap();
        let captured = write_checkpoint(
            &project,
            &store,
            "Agent changed both files".into(),
            vec![],
            false,
            None,
        )
        .unwrap();
        let changed = captured.last().unwrap().clone();
        let restored =
            restore_files_in_store(&project, &store, &changed.id, &["alpha.txt".into()]).unwrap();
        assert_eq!(
            fs::read_to_string(project.join("alpha.txt")).unwrap(),
            "baseline alpha\n"
        );
        assert_eq!(
            fs::read_to_string(project.join("keep.txt")).unwrap(),
            "unrelated keep edit\n"
        );
        let safety = restored.last().unwrap().clone();
        assert!(safety.safety);
        assert_eq!(
            safety
                .files
                .iter()
                .map(|file| file.path.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha.txt"]
        );
        assert_eq!(
            load_snapshot(&store.join(&safety.id))
                .unwrap()
                .get("alpha.txt"),
            Some(&b"wrong alpha\n".to_vec())
        );
        restore_files_in_store(&project, &store, &safety.id, &["alpha.txt".into()]).unwrap();
        assert_eq!(
            fs::read_to_string(project.join("alpha.txt")).unwrap(),
            "wrong alpha\n"
        );
        assert_eq!(
            fs::read_to_string(project.join("keep.txt")).unwrap(),
            "unrelated keep edit\n"
        );
    }

    #[test]
    // @claim:ledger-deletion
    fn claim_ledger_deletion_removes_snapshots_not_project_files() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("keep.txt"), "project stays\n").unwrap();
        write_checkpoint(&project, &store, "Capture".into(), vec![], false, None).unwrap();
        assert!(store.exists());
        delete_ledger_store(&store).unwrap();
        assert!(!store.exists());
        assert_eq!(
            fs::read_to_string(project.join("keep.txt")).unwrap(),
            "project stays\n"
        );
    }
}
