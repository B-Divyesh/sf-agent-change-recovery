# Change Recovery Ledger

Reverse selected agent changes without losing unrelated work.

Change Recovery Ledger is a local desktop sidecar for developers supervising long agent sessions. It records project snapshots with the agent’s intent and command trail. You can inspect a file group, create a safety checkpoint, restore selected files, or export selected changes as a patch. Git metadata is excluded from checkpoints, and exported patches never run themselves.

The public site is at [agent-change-recovery.sociobot.in](https://agent-change-recovery.sociobot.in). Open [`/demo`](https://agent-change-recovery.sociobot.in/demo) to try the full recovery path with isolated sample data.

## What ships

- Tauri 2 desktop app for macOS, Windows, and Linux.
- Rust snapshot core with generated-folder exclusions and path traversal checks.
- Local checkpoint manifests and file snapshots in the operating system’s app-data folder.
- Selective restore that creates a safety checkpoint first.
- A safety checkpoint that can restore a mistaken reversal of its selected files.
- Selected-file patch export that never executes the patch.
- Passphrase-encrypted recovery export and import back into a reviewable patch.
- A confirmed local-ledger deletion control that leaves project files unchanged.
- Offline browser demo under a separate `demo:` storage key.
- Sociobot license purchase, restore, and daily verification flow.
- Static product site, legal pages, offline shell, and platform-aware release link.

The first seven checkpoints are included. Pro costs $15 per developer each month. It adds longer history, configurable retention, and passphrase-encrypted recovery export. Safety checkpoints and patch export are included in the free controls.

## Run the site and demo

Requirements: Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:4173/demo` for the verifier sandbox. Demo changes use only `demo:agent-change-recovery:ledger`. Choose **Reset demo** for a clean state.

## Run the desktop app

Install the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system, then run:

```sh
npm ci
npm run tauri dev
```

The desktop app accepts an explicit project path. It ignores `.git`, `node_modules`, `target`, and `dist`. Files over 2 MB are skipped. The first capture establishes the baseline; later captures show changes from the previous snapshot.

Choose **Delete local ledger** after loading a project to remove its local snapshots. The confirmation names the checkpoint count, and it does not change files in the project folder.

With Pro, choose **Open encrypted recovery**, enter the `.crl` file path and its passphrase, and the app writes the decrypted patch for review. It never runs the patch.

## Install a release

The landing page picks the current release for your platform. On Linux, this command verifies the AppImage checksum, installs an executable at `~/.local/bin/change-recovery-ledger`, and tells you if that directory is not on `PATH`:

```sh
curl -fsSL https://agent-change-recovery.sociobot.in/install.sh | sh
```

On Windows, this command verifies the release checksum and starts the verified installer:

```powershell
irm https://agent-change-recovery.sociobot.in/install.ps1 | iex
```

macOS downloads are unsigned disk images. Open the downloaded image and move the app to Applications; macOS may ask you to confirm before opening it.

## Test and build

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:site
```

`npm test` starts the built site and runs the Playwright claim, accessibility, mobile, and routing suite. The exact static deploy output is `dist/site`, with `index.html` at that root.

Desktop packages are built only in GitHub Actions. Tag a release such as `v0.1.2`; `.github/workflows/release.yml` builds macOS arm64 and x64, Windows x64, Linux AppImage and deb targets, then publishes `SHA256SUMS` and `latest.json`.

## Privacy and security

Project contents are not sent by the desktop core. License verification sends only the pasted license token to `api.sociobot.in`. The landing page checks GitHub’s public API for current release filenames and the Sociobot product catalog to show checkout only when it is published.

Checkpoint data can contain secrets. Use the in-app **Delete local ledger** control when snapshots are no longer needed. Keep normal Git history and backups; this product is a recovery sidecar, not a backup service.

See the in-product [privacy policy](https://agent-change-recovery.sociobot.in/privacy) and [terms](https://agent-change-recovery.sociobot.in/terms).

## License

MIT. See [LICENSE](LICENSE).
