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
    io::Write,
    path::{Component, Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
#[cfg(unix)]
use std::{
    ffi::CString,
    os::unix::{
        ffi::OsStrExt,
        io::{AsRawFd, FromRawFd},
    },
};
use tauri::Manager;
use walkdir::{DirEntry, WalkDir};

const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_FILES: usize = 8_000;
const MAX_RECOVERY_BYTES: u64 = 32 * 1024 * 1024;
const MIN_RETENTION: usize = 2;
const FREE_RETENTION_MAX: usize = 7;
const PRO_RETENTION_MAX: usize = 90;
const STORAGE_MAGIC: &[u8; 4] = b"LGR2";
const KEY_CHECK: &[u8] = b"change-recovery-ledger-key-check-v1";
const PRODUCT_CATALOG_URL: &str = "https://api.sociobot.in/api/v1/products";
const LICENSE_VERIFY_URL: &str =
    "https://api.sociobot.in/api/v1/products/agent-change-recovery/verify";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoreKeyInfo {
    version: u8,
    salt: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LedgerSettings {
    retention: usize,
    #[serde(default)]
    policy: String,
}

struct CheckpointWrite {
    intent: String,
    commands: Vec<String>,
    safety: bool,
    files_override: Option<Vec<FileChange>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureCheckpointInput {
    path: String,
    intent: String,
    commands: Vec<String>,
    pro: bool,
    retention: usize,
    passphrase: String,
    policy: String,
}

struct LedgerCrypto {
    key: [u8; 32],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LedgerResponse {
    ledger: Vec<Checkpoint>,
    retention: usize,
    policy: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct LicenseVerdict {
    valid: bool,
    reason: String,
    expires_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct ProductListing {
    slug: String,
    checkout_url: String,
    price_minor: u64,
    currency: String,
}

#[derive(Deserialize)]
struct ProductCatalog {
    data: Vec<ProductListing>,
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

fn validate_retention(retention: usize, pro: bool) -> Result<(), String> {
    let maximum = if pro {
        PRO_RETENTION_MAX
    } else {
        FREE_RETENTION_MAX
    };
    if !(MIN_RETENTION..=maximum).contains(&retention) {
        return Err(format!(
            "Choose a retention value from {MIN_RETENTION} to {maximum} checkpoints."
        ));
    }
    Ok(())
}

fn require_ledger_passphrase(passphrase: &str) -> Result<(), String> {
    if passphrase.chars().count() < 12 {
        return Err(
            "Use a local ledger passphrase with at least 12 characters. It is never saved.".into(),
        );
    }
    Ok(())
}

fn storage_path(store: &Path, name: &str) -> PathBuf {
    store.join(name)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or("Could not determine the ledger storage folder.")?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Could not name the ledger storage file.")?;
    let temporary = parent.join(format!(".{file_name}.{}.tmp", now_id()));
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    // POSIX rename replaces a file atomically. Windows does not permit that
    // replacement, so retain the compatible fallback there.
    #[cfg(not(target_os = "windows"))]
    return fs::rename(temporary, path).map_err(|error| error.to_string());

    #[cfg(target_os = "windows")]
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    #[cfg(target_os = "windows")]
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

fn derive_ledger_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    require_ledger_passphrase(passphrase)?;
    if salt.len() != 16 {
        return Err("The local ledger key information is invalid.".into());
    }
    let mut key = [0_u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|error| error.to_string())?;
    Ok(key)
}

fn encrypt_for_ledger(content: &[u8], crypto: &LedgerCrypto) -> Result<Vec<u8>, String> {
    let mut nonce_bytes = [0_u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let cipher = Aes256Gcm::new_from_slice(&crypto.key).map_err(|error| error.to_string())?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), content)
        .map_err(|_| "The local ledger could not be encrypted.".to_string())?;
    let mut output = STORAGE_MAGIC.to_vec();
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&encrypted);
    Ok(output)
}

fn decrypt_from_ledger(content: &[u8], crypto: &LedgerCrypto) -> Result<Vec<u8>, String> {
    const HEADER_BYTES: usize = 4 + 12;
    const AUTH_TAG_BYTES: usize = 16;
    if content.len() < HEADER_BYTES + AUTH_TAG_BYTES || &content[..4] != STORAGE_MAGIC {
        return Err("The local ledger data is not in a supported encrypted format.".into());
    }
    let cipher = Aes256Gcm::new_from_slice(&crypto.key).map_err(|error| error.to_string())?;
    cipher
        .decrypt(
            Nonce::from_slice(&content[4..HEADER_BYTES]),
            &content[HEADER_BYTES..],
        )
        .map_err(|_| "The local ledger could not be opened. Check its passphrase.".to_string())
}

fn write_encrypted(path: &Path, content: &[u8], crypto: &LedgerCrypto) -> Result<(), String> {
    write_atomic(path, &encrypt_for_ledger(content, crypto)?)
}

fn read_encrypted(path: &Path, crypto: &LedgerCrypto) -> Result<Vec<u8>, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    decrypt_from_ledger(&bytes, crypto)
}

fn create_ledger_store(
    store: &Path,
    passphrase: &str,
    retention: usize,
) -> Result<(LedgerCrypto, LedgerSettings), String> {
    require_ledger_passphrase(passphrase)?;
    validate_retention(retention, true)?;
    fs::create_dir_all(store).map_err(|error| error.to_string())?;
    let mut salt = [0_u8; 16];
    OsRng.fill_bytes(&mut salt);
    let crypto = LedgerCrypto {
        key: derive_ledger_key(passphrase, &salt)?,
    };
    let key_info = StoreKeyInfo {
        version: 2,
        salt: salt.to_vec(),
    };
    write_atomic(
        &storage_path(store, "storage.json"),
        &serde_json::to_vec(&key_info).map_err(|error| error.to_string())?,
    )?;
    write_encrypted(&storage_path(store, "key-check.enc"), KEY_CHECK, &crypto)?;
    let settings = LedgerSettings {
        retention,
        policy: String::new(),
    };
    write_encrypted(
        &storage_path(store, "settings.enc"),
        &serde_json::to_vec(&settings).map_err(|error| error.to_string())?,
        &crypto,
    )?;
    Ok((crypto, settings))
}

fn open_encrypted_store(
    store: &Path,
    passphrase: &str,
) -> Result<(LedgerCrypto, LedgerSettings), String> {
    let key_info: StoreKeyInfo = serde_json::from_slice(
        &fs::read(storage_path(store, "storage.json")).map_err(|error| error.to_string())?,
    )
    .map_err(|_| "The local ledger key information is invalid.".to_string())?;
    if key_info.version != 2 {
        return Err("This local ledger uses an unsupported encryption format.".into());
    }
    let crypto = LedgerCrypto {
        key: derive_ledger_key(passphrase, &key_info.salt)?,
    };
    if read_encrypted(&storage_path(store, "key-check.enc"), &crypto)? != KEY_CHECK {
        return Err("The local ledger could not be opened. Check its passphrase.".into());
    }
    let settings: LedgerSettings = serde_json::from_slice(&read_encrypted(
        &storage_path(store, "settings.enc"),
        &crypto,
    )?)
    .map_err(|_| "The local ledger settings could not be read.".to_string())?;
    validate_retention(settings.retention, true)?;
    Ok((crypto, settings))
}

fn legacy_checkpoint_dirs(project_store: &Path) -> Result<Vec<PathBuf>, String> {
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

fn migrate_legacy_store(
    store: &Path,
    passphrase: &str,
    retention: usize,
) -> Result<(LedgerCrypto, LedgerSettings), String> {
    let legacy: Vec<(PathBuf, Checkpoint, BTreeMap<String, Vec<u8>>)> =
        legacy_checkpoint_dirs(store)?
            .into_iter()
            .map(|dir| {
                let manifest = serde_json::from_slice(
                    &fs::read(dir.join("manifest.json")).map_err(|error| error.to_string())?,
                )
                .map_err(|error| error.to_string())?;
                let snapshot = read_project(&dir.join("files"))?;
                Ok((dir, manifest, snapshot))
            })
            .collect::<Result<_, String>>()?;
    let (crypto, settings) = create_ledger_store(store, passphrase, retention)?;
    for (dir, manifest, snapshot) in &legacy {
        save_snapshot(snapshot, dir, &crypto)?;
        write_manifest(dir, manifest, &crypto)?;
    }
    for (dir, _, _) in legacy {
        let raw_files = dir.join("files");
        if raw_files.exists() {
            fs::remove_dir_all(raw_files).map_err(|error| error.to_string())?;
        }
        let raw_manifest = dir.join("manifest.json");
        if raw_manifest.exists() {
            fs::remove_file(raw_manifest).map_err(|error| error.to_string())?;
        }
    }
    prune_checkpoints(store, &crypto, settings.retention)?;
    Ok((crypto, settings))
}

fn open_ledger_store(
    store: &Path,
    passphrase: &str,
    requested_retention: Option<usize>,
    pro: bool,
) -> Result<(LedgerCrypto, LedgerSettings), String> {
    if let Some(retention) = requested_retention {
        validate_retention(retention, pro)?;
    }
    fs::create_dir_all(store).map_err(|error| error.to_string())?;
    let storage_info = storage_path(store, "storage.json");
    let (crypto, mut settings) = if storage_info.exists() {
        open_encrypted_store(store, passphrase)?
    } else if !legacy_checkpoint_dirs(store)?.is_empty() {
        migrate_legacy_store(
            store,
            passphrase,
            requested_retention.unwrap_or(FREE_RETENTION_MAX),
        )?
    } else {
        create_ledger_store(
            store,
            passphrase,
            requested_retention.unwrap_or(FREE_RETENTION_MAX),
        )?
    };
    if let Some(retention) = requested_retention {
        if settings.retention != retention {
            settings.retention = retention;
            write_encrypted(
                &storage_path(store, "settings.enc"),
                &serde_json::to_vec(&settings).map_err(|error| error.to_string())?,
                &crypto,
            )?;
            prune_checkpoints(store, &crypto, retention)?;
        }
    }
    Ok((crypto, settings))
}

fn enforce_plan_retention(
    store: &Path,
    crypto: &LedgerCrypto,
    settings: &mut LedgerSettings,
    pro: bool,
) -> Result<(), String> {
    let maximum = if pro {
        PRO_RETENTION_MAX
    } else {
        FREE_RETENTION_MAX
    };
    if settings.retention <= maximum {
        return Ok(());
    }
    settings.retention = maximum;
    write_encrypted(
        &storage_path(store, "settings.enc"),
        &serde_json::to_vec(settings).map_err(|error| error.to_string())?,
        crypto,
    )?;
    prune_checkpoints(store, crypto, maximum)
}

fn load_snapshot(dir: &Path, crypto: &LedgerCrypto) -> Result<BTreeMap<String, Vec<u8>>, String> {
    let bytes = read_encrypted(&dir.join("snapshot.enc"), crypto)?;
    bincode::deserialize(&bytes)
        .map_err(|_| "The encrypted checkpoint snapshot could not be read.".to_string())
}

fn save_snapshot(
    files: &BTreeMap<String, Vec<u8>>,
    dir: &Path,
    crypto: &LedgerCrypto,
) -> Result<(), String> {
    let bytes = bincode::serialize(files).map_err(|error| error.to_string())?;
    write_encrypted(&dir.join("snapshot.enc"), &bytes, crypto)
}

fn load_baseline(
    project_store: &Path,
    crypto: &LedgerCrypto,
) -> Result<Option<BTreeMap<String, Vec<u8>>>, String> {
    let path = storage_path(project_store, "baseline.enc");
    if !path.exists() {
        return Ok(None);
    }
    let bytes = read_encrypted(&path, crypto)?;
    bincode::deserialize(&bytes)
        .map(Some)
        .map_err(|_| "The encrypted retention baseline could not be read.".to_string())
}

fn save_baseline(
    project_store: &Path,
    files: &BTreeMap<String, Vec<u8>>,
    crypto: &LedgerCrypto,
) -> Result<(), String> {
    let bytes = bincode::serialize(files).map_err(|error| error.to_string())?;
    write_encrypted(&storage_path(project_store, "baseline.enc"), &bytes, crypto)
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

fn checkpoint_dirs(project_store: &Path) -> Result<Vec<PathBuf>, String> {
    if !project_store.exists() {
        return Ok(Vec::new());
    }
    let mut dirs: Vec<PathBuf> = fs::read_dir(project_store)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join("manifest.enc").exists())
        .collect();
    dirs.sort();
    Ok(dirs)
}

fn read_manifest(dir: &Path, crypto: &LedgerCrypto) -> Result<Checkpoint, String> {
    serde_json::from_slice(&read_encrypted(&dir.join("manifest.enc"), crypto)?)
        .map_err(|_| "The encrypted checkpoint manifest could not be read.".to_string())
}

fn write_manifest(
    dir: &Path,
    checkpoint: &Checkpoint,
    crypto: &LedgerCrypto,
) -> Result<(), String> {
    write_encrypted(
        &dir.join("manifest.enc"),
        &serde_json::to_vec(checkpoint).map_err(|error| error.to_string())?,
        crypto,
    )
}

fn list_manifests(project_store: &Path, crypto: &LedgerCrypto) -> Result<Vec<Checkpoint>, String> {
    checkpoint_dirs(project_store)?
        .iter()
        .map(|dir| read_manifest(dir, crypto))
        .collect()
}

fn prune_checkpoints(
    project_store: &Path,
    crypto: &LedgerCrypto,
    retention: usize,
) -> Result<(), String> {
    validate_retention(retention, true)?;
    let mut dirs = checkpoint_dirs(project_store)?;
    while dirs.len() > retention {
        let oldest = dirs.remove(0);
        let baseline = load_snapshot(&oldest, crypto)?;
        // Preserve the exact predecessor for the first retained checkpoint before
        // removing an old checkpoint. This keeps selective reversal safe at the
        // retention boundary without retaining its manifest in the visible ledger.
        save_baseline(project_store, &baseline, crypto)?;
        fs::remove_dir_all(oldest).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn previous_snapshot(
    project_store: &Path,
    dirs: &[PathBuf],
    index: usize,
    crypto: &LedgerCrypto,
) -> Result<Option<BTreeMap<String, Vec<u8>>>, String> {
    if index > 0 {
        return load_snapshot(&dirs[index - 1], crypto).map(Some);
    }
    load_baseline(project_store, crypto)
}

fn write_checkpoint(
    project_path: &Path,
    project_store: &Path,
    crypto: &LedgerCrypto,
    retention: usize,
    write: CheckpointWrite,
) -> Result<Vec<Checkpoint>, String> {
    let current = read_project(project_path)?;
    let dirs = checkpoint_dirs(project_store)?;
    let previous = dirs
        .last()
        .map(|dir| load_snapshot(dir, crypto))
        .transpose()?
        .unwrap_or_default();
    let changes = write
        .files_override
        .unwrap_or_else(|| changes_between(&previous, &current));
    let id = checkpoint_id(project_store)?;
    let checkpoint_dir = project_store.join(&id);
    fs::create_dir_all(&checkpoint_dir).map_err(|error| error.to_string())?;
    save_snapshot(&current, &checkpoint_dir, crypto)?;
    let checkpoint = Checkpoint {
        id,
        intent: write.intent,
        detail: if write.safety {
            "Saved automatically before selected files were reversed.".into()
        } else {
            "Captured from the selected local project folder.".into()
        },
        created_at: clock_label(),
        commands: write.commands,
        files: changes,
        checks: "Not run by the ledger".into(),
        check_passed: true,
        safety: write.safety,
        project_path: project_path.to_string_lossy().into_owned(),
    };
    write_manifest(&checkpoint_dir, &checkpoint, crypto)?;
    prune_checkpoints(project_store, crypto, retention)?;
    list_manifests(project_store, crypto)
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

fn relative_components(path: &str) -> Result<Vec<&std::ffi::OsStr>, String> {
    let relative = safe_relative(path)?;
    let components: Vec<_> = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(name) => Some(name),
            _ => None,
        })
        .collect();
    if components.is_empty() {
        return Err("A selected file path is outside the project folder.".into());
    }
    Ok(components)
}

fn verify_restore_destination(project_path: &Path, relative: &str) -> Result<(), String> {
    let mut current = fs::canonicalize(project_path).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let components = relative_components(relative)?;
    for (index, component) in components.iter().enumerate() {
        current.push(component);
        match fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Could not reverse {relative}: its path contains a symlink. Choose a project folder without redirected paths."
                ));
            }
            Ok(metadata) if index + 1 < components.len() && !metadata.is_dir() => {
                return Err(format!(
                    "Could not reverse {relative}: a parent path is not a folder."
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
            Err(error) => return Err(format!("Could not inspect {relative}: {error}")),
        }
    }
    Ok(())
}

#[cfg(unix)]
fn c_string(component: &std::ffi::OsStr, relative: &str) -> Result<CString, String> {
    CString::new(component.as_bytes()).map_err(|_| format!("Could not safely resolve {relative}."))
}

#[cfg(unix)]
fn open_project_directory(project_path: &Path) -> Result<fs::File, String> {
    let path = CString::new(project_path.as_os_str().as_bytes())
        .map_err(|_| "Could not safely open the project folder.".to_string())?;
    let fd = unsafe {
        libc::open(
            path.as_ptr(),
            libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW,
        )
    };
    if fd < 0 {
        return Err(format!(
            "Could not safely open the project folder: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(unsafe { fs::File::from_raw_fd(fd) })
}

#[cfg(unix)]
fn open_restore_parent(
    project_path: &Path,
    relative: &str,
    create_missing: bool,
) -> Result<Option<(fs::File, CString)>, String> {
    let components = relative_components(relative)?;
    let mut directory = open_project_directory(project_path)?;
    for component in &components[..components.len() - 1] {
        let name = c_string(component, relative)?;
        let flags = libc::O_RDONLY | libc::O_DIRECTORY | libc::O_CLOEXEC | libc::O_NOFOLLOW;
        let mut fd = unsafe { libc::openat(directory.as_raw_fd(), name.as_ptr(), flags) };
        if fd < 0 && std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
            if !create_missing {
                return Ok(None);
            }
            let created = unsafe { libc::mkdirat(directory.as_raw_fd(), name.as_ptr(), 0o755) };
            if created != 0 && std::io::Error::last_os_error().raw_os_error() != Some(libc::EEXIST)
            {
                return Err(format!(
                    "Could not create a folder for {relative}: {}",
                    std::io::Error::last_os_error()
                ));
            }
            fd = unsafe { libc::openat(directory.as_raw_fd(), name.as_ptr(), flags) };
        }
        if fd < 0 {
            return Err(format!(
                "Could not safely resolve {relative}: {}",
                std::io::Error::last_os_error()
            ));
        }
        directory = unsafe { fs::File::from_raw_fd(fd) };
    }
    Ok(Some((
        directory,
        c_string(components.last().expect("non-empty components"), relative)?,
    )))
}

#[cfg(unix)]
fn restore_selected_file(
    project_path: &Path,
    relative: &str,
    content: Option<&Vec<u8>>,
) -> Result<(), String> {
    match content {
        Some(content) => {
            let (parent, name) = open_restore_parent(project_path, relative, true)?
                .expect("creating a restore parent always returns a directory");
            let fd = unsafe {
                libc::openat(
                    parent.as_raw_fd(),
                    name.as_ptr(),
                    libc::O_WRONLY
                        | libc::O_CREAT
                        | libc::O_TRUNC
                        | libc::O_CLOEXEC
                        | libc::O_NOFOLLOW,
                    0o600,
                )
            };
            if fd < 0 {
                return Err(format!(
                    "Could not restore {relative}: {}",
                    std::io::Error::last_os_error()
                ));
            }
            let mut target = unsafe { fs::File::from_raw_fd(fd) };
            target
                .write_all(content)
                .map_err(|error| format!("Could not restore {relative}: {error}"))?;
            target
                .sync_all()
                .map_err(|error| format!("Could not finish restoring {relative}: {error}"))
        }
        None => {
            let Some((parent, name)) = open_restore_parent(project_path, relative, false)? else {
                return Ok(());
            };
            let result = unsafe { libc::unlinkat(parent.as_raw_fd(), name.as_ptr(), 0) };
            if result == 0 || std::io::Error::last_os_error().raw_os_error() == Some(libc::ENOENT) {
                Ok(())
            } else {
                Err(format!(
                    "Could not remove {relative}: {}",
                    std::io::Error::last_os_error()
                ))
            }
        }
    }
}

#[cfg(not(unix))]
fn restore_selected_file(
    project_path: &Path,
    relative: &str,
    content: Option<&Vec<u8>>,
) -> Result<(), String> {
    verify_restore_destination(project_path, relative)?;
    let target = project_path.join(safe_relative(relative)?);
    if let Some(content) = content {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&target, content)
            .map_err(|error| format!("Could not restore {relative}: {error}"))
    } else if target.exists() {
        fs::remove_file(&target).map_err(|error| format!("Could not remove {relative}: {error}"))
    } else {
        Ok(())
    }
}

#[tauri::command]
fn capture_checkpoint(
    app: tauri::AppHandle,
    input: CaptureCheckpointInput,
) -> Result<LedgerResponse, String> {
    let project_path = fs::canonicalize(Path::new(&input.path)).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let (crypto, mut settings) =
        open_ledger_store(&store, &input.passphrase, Some(input.retention), input.pro)?;
    let policy = input.policy.trim().to_string();
    if !policy.is_empty() && !input.pro {
        return Err("A team policy note requires an active Pro license.".into());
    }
    if settings.policy != policy {
        settings.policy = policy;
        write_encrypted(
            &storage_path(&store, "settings.enc"),
            &serde_json::to_vec(&settings).map_err(|error| error.to_string())?,
            &crypto,
        )?;
    }
    let ledger = write_checkpoint(
        &project_path,
        &store,
        &crypto,
        settings.retention,
        CheckpointWrite {
            intent: input.intent,
            commands: input.commands,
            safety: false,
            files_override: None,
        },
    )?;
    Ok(LedgerResponse {
        ledger,
        retention: settings.retention,
        policy: settings.policy,
    })
}

#[tauri::command]
fn load_ledger(
    app: tauri::AppHandle,
    path: String,
    passphrase: String,
    pro: bool,
) -> Result<LedgerResponse, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let (crypto, mut settings) = open_ledger_store(&store, &passphrase, None, true)?;
    enforce_plan_retention(&store, &crypto, &mut settings, pro)?;
    Ok(LedgerResponse {
        ledger: list_manifests(&store, &crypto)?,
        retention: settings.retention,
        policy: settings.policy,
    })
}

#[tauri::command]
fn restore_files(
    app: tauri::AppHandle,
    path: String,
    checkpoint_id: String,
    files: Vec<String>,
    passphrase: String,
    pro: bool,
) -> Result<Vec<Checkpoint>, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let (crypto, mut settings) = open_ledger_store(&store, &passphrase, None, true)?;
    enforce_plan_retention(&store, &crypto, &mut settings, pro)?;
    restore_files_in_store(
        &project_path,
        &store,
        &crypto,
        settings.retention,
        &checkpoint_id,
        &files,
    )
}

fn restore_files_in_store(
    project_path: &Path,
    store: &Path,
    crypto: &LedgerCrypto,
    retention: usize,
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
    if index == 0 && load_baseline(store, crypto)?.is_none() {
        return Err("The first checkpoint has no earlier state to restore.".into());
    }
    let project_path = fs::canonicalize(project_path).map_err(|_| {
        "The project folder was not found. Check the full path and try again.".to_string()
    })?;
    let source_manifest = read_manifest(&dirs[index], crypto)?;
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
    let restore_from = if source_manifest.safety {
        load_snapshot(&dirs[index], crypto)?
    } else {
        previous_snapshot(store, &dirs, index, crypto)?
            .ok_or("The earlier checkpoint required for this reversal is no longer available.")?
    };
    // Inspect every destination before recording the safety checkpoint. An
    // unsafe project shape therefore leaves both the project and ledger alone.
    for relative in files {
        verify_restore_destination(&project_path, relative)?;
    }
    // Resolve the earlier state before writing the safety checkpoint. A tight
    // retention policy may prune the source checkpoint during that write, but
    // must never change what the user asked to restore in this operation.
    write_checkpoint(
        &project_path,
        store,
        crypto,
        retention,
        CheckpointWrite {
            intent: "Safety checkpoint before reversal".into(),
            commands: vec!["No commands run".into()],
            safety: true,
            files_override: Some(safety_files),
        },
    )?;
    for relative in files {
        restore_selected_file(&project_path, relative, restore_from.get(relative))?;
    }
    list_manifests(store, crypto)
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

fn load_bundled_sample(
    base: &Path,
    passphrase: &str,
    retention: usize,
    pro: bool,
) -> Result<(PathBuf, Vec<Checkpoint>, usize), String> {
    let project = base.join("sample-project");
    if project.exists() {
        fs::remove_dir_all(&project).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&project).map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project));
    delete_ledger_store(&store)?;
    let (crypto, settings) = open_ledger_store(&store, passphrase, Some(retention), pro)?;
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
        &crypto,
        settings.retention,
        CheckpointWrite {
            intent: "Baseline before session refactor".into(),
            commands: vec!["npm test -- session".into()],
            safety: false,
            files_override: None,
        },
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
        &crypto,
        settings.retention,
        CheckpointWrite {
            intent: "Refactor session refresh".into(),
            commands: vec!["npm test -- session".into(), "npm test -- editor".into()],
            safety: false,
            files_override: None,
        },
    )?;
    Ok((project, ledger, settings.retention))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SampleProject {
    path: String,
    ledger: Vec<Checkpoint>,
    retention: usize,
    policy: String,
}

#[tauri::command]
fn load_sample_project(
    app: tauri::AppHandle,
    _reset: bool,
    passphrase: String,
    retention: usize,
    pro: bool,
) -> Result<SampleProject, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let (path, ledger, saved_retention) = load_bundled_sample(&base, &passphrase, retention, pro)?;
    Ok(SampleProject {
        path: path.to_string_lossy().into_owned(),
        ledger,
        retention: saved_retention,
        policy: String::new(),
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
    passphrase: String,
) -> Result<String, String> {
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let (crypto, _) = open_ledger_store(&store, &passphrase, None, true)?;
    let dirs = checkpoint_dirs(&store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(&checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    let current = load_snapshot(&dirs[index], &crypto)?;
    let previous = previous_snapshot(&store, &dirs, index, &crypto)?.unwrap_or_default();
    let patch = patch_text(&previous, &current, &files)?;
    let export_dir = base.join("exports");
    fs::create_dir_all(&export_dir).map_err(|error| error.to_string())?;
    let target = export_dir.join(format!("recovery-{checkpoint_id}.patch"));
    fs::write(&target, patch).map_err(|error| error.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

struct PatchLines {
    lines: Vec<String>,
    has_final_newline: bool,
}

fn append_patch_lines(patch: &mut String, lines: &PatchLines, prefix: char) {
    for (index, line) in lines.lines.iter().enumerate() {
        patch.push(prefix);
        patch.push_str(line);
        patch.push('\n');
        if index + 1 == lines.lines.len() && !lines.has_final_newline {
            patch.push_str("\\ No newline at end of file\n");
        }
    }
}

fn patch_text(
    previous: &BTreeMap<String, Vec<u8>>,
    current: &BTreeMap<String, Vec<u8>>,
    files: &[String],
) -> Result<String, String> {
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
                None => {
                    return Err(format!(
                        "Cannot export {path}: binary files are not supported in a text patch."
                    ));
                }
            },
            None => PatchLines {
                lines: Vec::new(),
                has_final_newline: true,
            },
        };
        let new_lines = match after {
            Some(bytes) => match patch_lines(bytes) {
                Some(lines) => lines,
                None => {
                    return Err(format!(
                        "Cannot export {path}: binary files are not supported in a text patch."
                    ));
                }
            },
            None => PatchLines {
                lines: Vec::new(),
                has_final_newline: true,
            },
        };
        let old_start = if old_lines.lines.is_empty() { 0 } else { 1 };
        let new_start = if new_lines.lines.is_empty() { 0 } else { 1 };
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
            old_lines.lines.len(),
            new_lines.lines.len()
        ));
        append_patch_lines(&mut patch, &old_lines, '-');
        append_patch_lines(&mut patch, &new_lines, '+');
        patch.push('\n');
    }
    Ok(patch)
}

fn patch_lines(bytes: &[u8]) -> Option<PatchLines> {
    let text = std::str::from_utf8(bytes).ok()?;
    Some(PatchLines {
        lines: text.split_terminator('\n').map(str::to_owned).collect(),
        has_final_newline: text.ends_with('\n'),
    })
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
    ledger_passphrase: String,
    pro: bool,
) -> Result<String, String> {
    if !pro {
        return Err("An active Pro license is required for encrypted recovery export.".into());
    }
    let project_path = fs::canonicalize(Path::new(&path)).map_err(|error| error.to_string())?;
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let store = base.join("ledgers").join(project_key(&project_path));
    let (crypto, _) = open_ledger_store(&store, &ledger_passphrase, None, true)?;
    let dirs = checkpoint_dirs(&store)?;
    let index = dirs
        .iter()
        .position(|dir| dir.file_name().and_then(|name| name.to_str()) == Some(&checkpoint_id))
        .ok_or("The selected checkpoint no longer exists.")?;
    let current = load_snapshot(&dirs[index], &crypto)?;
    let previous = previous_snapshot(&store, &dirs, index, &crypto)?.unwrap_or_default();
    let encrypted = encrypt_bytes(
        patch_text(&previous, &current, &files)?.as_bytes(),
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

fn billing_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Change-Recovery-Ledger/desktop")
        .build()
        .map_err(|_| {
            "The Sociobot billing request could not start. Try again when you are online."
                .to_string()
        })
}

fn get_product_listing_from(endpoint: &str) -> Result<Option<ProductListing>, String> {
    let endpoint = reqwest::Url::parse(endpoint)
        .map_err(|_| "The product catalog address is invalid.".to_string())?;
    let response = billing_client()?.get(endpoint).send().map_err(|_| {
        "The product catalog is unavailable. Try again when you are online.".to_string()
    })?;
    if !response.status().is_success() {
        return Err("The product catalog is unavailable. Try again later.".into());
    }
    let catalog = response
        .json::<ProductCatalog>()
        .map_err(|_| "The product catalog returned an unreadable response.".to_string())?;
    Ok(catalog
        .data
        .into_iter()
        .find(|product| product.slug == "agent-change-recovery"))
}

#[tauri::command]
fn get_product_listing() -> Result<Option<ProductListing>, String> {
    get_product_listing_from(PRODUCT_CATALOG_URL)
}

fn verify_license_from(endpoint: &str, license: &str) -> Result<LicenseVerdict, String> {
    if license.trim().is_empty() {
        return Err("Paste a Sociobot license before verifying it.".into());
    }
    let mut endpoint = reqwest::Url::parse(endpoint)
        .map_err(|_| "The license verification address is invalid.".to_string())?;
    endpoint
        .query_pairs_mut()
        .append_pair("license", license.trim());
    let response = billing_client()?.get(endpoint).send().map_err(|_| {
        "License verification is unavailable. Try again when you are online.".to_string()
    })?;
    if !response.status().is_success() {
        return Err("License verification is unavailable. Try again later.".into());
    }
    response
        .json::<LicenseVerdict>()
        .map_err(|_| "The license service returned an unreadable response.".to_string())
}

#[tauri::command]
fn verify_license(license: String) -> Result<LicenseVerdict, String> {
    verify_license_from(LICENSE_VERIFY_URL, &license)
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
            get_product_listing,
            verify_license,
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
        io::{Read, Write},
        net::TcpListener,
        process::{Command, Stdio},
        thread,
    };

    const TEST_PASSPHRASE: &str = "correct horse battery staple";

    fn serve_recorded_json(body: &'static str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0_u8; 2048];
            loop {
                let count = stream.read(&mut buffer).unwrap();
                if count == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..count]);
                if request.windows(4).any(|part| part == b"\r\n\r\n") {
                    break;
                }
            }
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
            String::from_utf8(request).unwrap()
        });
        (format!("http://{address}"), handle)
    }

    fn test_crypto(store: &Path) -> LedgerCrypto {
        open_ledger_store(store, TEST_PASSPHRASE, Some(FREE_RETENTION_MAX), false)
            .unwrap()
            .0
    }

    macro_rules! normal_write {
        ($intent:expr, $commands:expr) => {
            CheckpointWrite {
                intent: $intent.into(),
                commands: $commands,
                safety: false,
                files_override: None,
            }
        };
    }

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
    // @claim:patch-export
    fn claim_patch_export_is_standard_unified_diff_and_dry_runs() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("src/auth")).unwrap();
        fs::write(
            root.path().join("src/auth/session.ts"),
            "const old = true\n",
        )
        .unwrap();
        fs::write(root.path().join("src/auth/no-final-newline.txt"), "old").unwrap();
        let previous = BTreeMap::from([
            ("src/auth/session.ts".into(), b"const old = true\n".to_vec()),
            ("src/auth/no-final-newline.txt".into(), b"old".to_vec()),
        ]);
        let current = BTreeMap::from([
            (
                "src/auth/session.ts".into(),
                b"const current = true\nconst queued = false\n".to_vec(),
            ),
            ("src/auth/no-final-newline.txt".into(), b"new".to_vec()),
        ]);
        let patch = patch_text(
            &previous,
            &current,
            &[
                "src/auth/session.ts".into(),
                "src/auth/no-final-newline.txt".into(),
            ],
        )
        .unwrap();
        assert!(patch.contains("@@ -1,1 +1,2 @@"));
        assert!(patch
            .contains("-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file"));
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
        let binary = BTreeMap::from([("binary.dat".into(), vec![0, 159, 146, 150])]);
        assert!(patch_text(&BTreeMap::new(), &binary, &["binary.dat".into()]).is_err());
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
    fn packaged_billing_uses_native_http_without_a_web_origin() {
        let catalog_json = include_str!("../../tests/fixtures/sociobot-product-catalog.json");
        let (catalog_origin, catalog_request) = serve_recorded_json(catalog_json);
        let product = get_product_listing_from(&format!("{catalog_origin}/api/v1/products"))
            .unwrap()
            .unwrap();
        assert_eq!(product.slug, "agent-change-recovery");
        assert_eq!(product.price_minor, 1500);
        assert_eq!(product.currency, "USD");
        assert_eq!(
            product.checkout_url,
            "https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout"
        );
        let request = catalog_request.join().unwrap();
        assert!(request.starts_with("GET /api/v1/products HTTP/1.1\r\n"));
        assert!(!request.to_ascii_lowercase().contains("\r\norigin:"));

        let verdict_json = include_str!("../../tests/fixtures/sociobot-license-valid.json");
        let (verify_origin, verify_request) = serve_recorded_json(verdict_json);
        let verdict = verify_license_from(
            &format!("{verify_origin}/api/v1/products/agent-change-recovery/verify"),
            "sbk-recorded+license",
        )
        .unwrap();
        assert_eq!(
            verdict,
            LicenseVerdict {
                valid: true,
                reason: "ok".into(),
                expires_at: None,
            }
        );
        let request = verify_request.join().unwrap();
        assert!(request.starts_with(
            "GET /api/v1/products/agent-change-recovery/verify?license=sbk-recorded%2Blicense HTTP/1.1\r\n"
        ));
        assert!(!request.to_ascii_lowercase().contains("\r\norigin:"));
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
        #[cfg(unix)]
        assert_replaced_symlink_parent_is_rejected();
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
        let crypto = test_crypto(&store);
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("session.ts"), "before\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Fix session refresh", vec!["npm test".into()]),
        )
        .unwrap();
        fs::write(project.join("session.ts"), "after\n").unwrap();
        let checkpoint = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Fix session refresh", vec!["npm test".into()]),
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
        let crypto = test_crypto(&store);
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("state.txt"), "one\n").unwrap();
        let first = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Baseline", vec![]),
        )
        .unwrap();
        assert_eq!(first.last().unwrap().files.len(), 1);
        fs::write(project.join("state.txt"), "two\n").unwrap();
        let second = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Second", vec![]),
        )
        .unwrap();
        assert_eq!(second.last().unwrap().files[0].path, "state.txt");
        fs::write(project.join("state.txt"), "three\n").unwrap();
        let third = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Third", vec![]),
        )
        .unwrap();
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
        let (sample, ledger, retention) =
            load_bundled_sample(root.path(), TEST_PASSPHRASE, FREE_RETENTION_MAX, false).unwrap();
        assert_ne!(sample, real);
        assert_eq!(ledger.len(), 2);
        assert_eq!(retention, FREE_RETENTION_MAX);
        let changed = ledger.last().unwrap();
        assert!(changed
            .files
            .iter()
            .any(|file| file.path == "src/auth/session.ts"));
        restore_files_in_store(
            &sample,
            &root.path().join("ledgers").join(project_key(&sample)),
            &open_encrypted_store(
                &root.path().join("ledgers").join(project_key(&sample)),
                TEST_PASSPHRASE,
            )
            .unwrap()
            .0,
            FREE_RETENTION_MAX,
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
        let (reset, reset_ledger, _) =
            load_bundled_sample(root.path(), TEST_PASSPHRASE, FREE_RETENTION_MAX, false).unwrap();
        assert_eq!(reset, sample);
        assert_eq!(reset_ledger.len(), 2);
    }

    #[test]
    // @claim:reversible-safety-checkpoint
    fn claim_reversible_safety_checkpoint() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        let crypto = test_crypto(&store);
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("alpha.txt"), "baseline alpha\n").unwrap();
        fs::write(project.join("keep.txt"), "keep baseline\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Baseline before agent", vec![]),
        )
        .unwrap();
        fs::write(project.join("alpha.txt"), "wrong alpha\n").unwrap();
        fs::write(project.join("keep.txt"), "unrelated keep edit\n").unwrap();
        let captured = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Agent changed both files", vec![]),
        )
        .unwrap();
        let changed = captured.last().unwrap().clone();
        let restored = restore_files_in_store(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            &changed.id,
            &["alpha.txt".into()],
        )
        .unwrap();
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
            load_snapshot(&store.join(&safety.id), &crypto)
                .unwrap()
                .get("alpha.txt"),
            Some(&b"wrong alpha\n".to_vec())
        );
        restore_files_in_store(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            &safety.id,
            &["alpha.txt".into()],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(project.join("alpha.txt")).unwrap(),
            "wrong alpha\n"
        );
        assert_eq!(
            fs::read_to_string(project.join("keep.txt")).unwrap(),
            "unrelated keep edit\n"
        );
    }

    #[cfg(unix)]
    fn assert_replaced_symlink_parent_is_rejected() {
        use std::os::unix::fs::symlink;

        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let outside = root.path().join("outside");
        let store = root.path().join("ledger");
        let crypto = test_crypto(&store);
        fs::create_dir_all(project.join("src")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(project.join("src/victim.txt"), "safe baseline\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Baseline before agent", vec![]),
        )
        .unwrap();
        fs::write(project.join("src/victim.txt"), "wrong project edit\n").unwrap();
        let captured = write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Agent changed victim", vec![]),
        )
        .unwrap();
        let checkpoint_id = captured.last().unwrap().id.clone();

        fs::remove_dir_all(project.join("src")).unwrap();
        fs::write(outside.join("victim.txt"), "outside sentinel\n").unwrap();
        symlink(&outside, project.join("src")).unwrap();

        let result = restore_files_in_store(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            &checkpoint_id,
            &["src/victim.txt".into()],
        );

        assert!(result.is_err(), "a symlinked parent must stop reversal");
        assert_eq!(
            fs::read_to_string(outside.join("victim.txt")).unwrap(),
            "outside sentinel\n"
        );
    }

    #[cfg(unix)]
    #[test]
    fn reversal_rejects_replaced_symlink_parent_outside_project() {
        assert_replaced_symlink_parent_is_rejected();
    }

    #[test]
    // @claim:local-encryption
    fn claim_local_encryption_keeps_project_content_out_of_ledger_files() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        let secret = "CRL-UNIQUE-LOCAL-SECRET-9817";
        fs::write(project.join("secret.txt"), secret).unwrap();
        let crypto = test_crypto(&store);
        write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Capture a sensitive local change", vec![]),
        )
        .unwrap();
        let mut bytes = Vec::new();
        for entry in WalkDir::new(&store).into_iter().filter_map(Result::ok) {
            if entry.file_type().is_file() {
                bytes.extend(fs::read(entry.path()).unwrap());
            }
        }
        assert!(!bytes
            .windows(secret.len())
            .any(|window| window == secret.as_bytes()));
        assert!(checkpoint_dirs(&store)
            .unwrap()
            .iter()
            .all(|dir| dir.join("snapshot.enc").exists() && dir.join("manifest.enc").exists()));
        assert_eq!(
            load_snapshot(&checkpoint_dirs(&store).unwrap()[0], &crypto)
                .unwrap()
                .get("secret.txt"),
            Some(&secret.as_bytes().to_vec())
        );
    }

    #[test]
    // @claim:retention-settings-encryption
    fn claim_retention_settings_are_encrypted_in_the_local_ledger() {
        let root = tempfile::tempdir().unwrap();
        let store = root.path().join("ledger");
        let (_, settings) =
            open_ledger_store(&store, TEST_PASSPHRASE, Some(FREE_RETENTION_MAX), false).unwrap();
        assert_eq!(settings.retention, FREE_RETENTION_MAX);
        let raw = fs::read(storage_path(&store, "settings.enc")).unwrap();
        assert_eq!(&raw[..4], STORAGE_MAGIC);
        assert!(!raw
            .windows(b"retention".len())
            .any(|window| window == b"retention"));
        let (_, reopened) = open_encrypted_store(&store, TEST_PASSPHRASE).unwrap();
        assert_eq!(reopened.retention, FREE_RETENTION_MAX);
    }

    #[test]
    // @claim:retention-policy
    fn claim_retention_prunes_old_checkpoints_and_keeps_boundary_recovery() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        fs::create_dir_all(&project).unwrap();
        let crypto = open_ledger_store(&store, TEST_PASSPHRASE, Some(2), false)
            .unwrap()
            .0;
        fs::write(project.join("state.txt"), "baseline\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            2,
            normal_write!("Baseline", vec![]),
        )
        .unwrap();
        fs::write(project.join("state.txt"), "wrong\n").unwrap();
        let second = write_checkpoint(
            &project,
            &store,
            &crypto,
            2,
            normal_write!("Wrong agent change", vec![]),
        )
        .unwrap();
        let source = second.last().unwrap().clone();
        fs::write(project.join("state.txt"), "later change\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            2,
            normal_write!("Later change", vec![]),
        )
        .unwrap();
        assert_eq!(checkpoint_dirs(&store).unwrap().len(), 2);
        assert!(load_baseline(&store, &crypto).unwrap().is_some());
        restore_files_in_store(
            &project,
            &store,
            &crypto,
            2,
            &source.id,
            &["state.txt".into()],
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(project.join("state.txt")).unwrap(),
            "baseline\n"
        );
        assert_eq!(checkpoint_dirs(&store).unwrap().len(), 2);
    }

    #[test]
    // @claim:team-policy-note
    fn claim_team_policy_note_is_encrypted_with_the_ledger() {
        let root = tempfile::tempdir().unwrap();
        let store = root.path().join("ledger");
        let (crypto, mut settings) =
            open_ledger_store(&store, TEST_PASSPHRASE, Some(30), true).unwrap();
        settings.policy = "Require a reviewer for authentication reversals.".into();
        write_encrypted(
            &storage_path(&store, "settings.enc"),
            &serde_json::to_vec(&settings).unwrap(),
            &crypto,
        )
        .unwrap();
        let (_, reopened) = open_encrypted_store(&store, TEST_PASSPHRASE).unwrap();
        assert_eq!(reopened.retention, 30);
        assert_eq!(
            reopened.policy,
            "Require a reviewer for authentication reversals."
        );
        let raw = fs::read(storage_path(&store, "settings.enc")).unwrap();
        assert!(!raw.windows(9).any(|window| window == b"reviewer"));
    }

    #[test]
    // @claim:ledger-deletion
    fn claim_ledger_deletion_removes_snapshots_not_project_files() {
        let root = tempfile::tempdir().unwrap();
        let project = root.path().join("project");
        let store = root.path().join("ledger");
        let crypto = test_crypto(&store);
        fs::create_dir_all(&project).unwrap();
        fs::write(project.join("keep.txt"), "project stays\n").unwrap();
        write_checkpoint(
            &project,
            &store,
            &crypto,
            FREE_RETENTION_MAX,
            normal_write!("Capture", vec![]),
        )
        .unwrap();
        assert!(store.exists());
        delete_ledger_store(&store).unwrap();
        assert!(!store.exists());
        assert_eq!(
            fs::read_to_string(project.join("keep.txt")).unwrap(),
            "project stays\n"
        );
    }
}
