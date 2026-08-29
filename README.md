# Change Recovery Ledger

Reverse selected agent changes without losing unrelated work.

Change Recovery Ledger is a local desktop app for developers supervising long agent sessions.
It records the request, commands, files, and check result for each checkpoint.
Reverse selected files after a safety checkpoint, or export a patch for review.
Patches never run themselves.
Every desktop ledger uses a passphrase to encrypt snapshots, manifests, and retention settings on disk.

Use the one-click sample at [agent-change-recovery.sociobot.in/?demo=1](https://agent-change-recovery.sociobot.in/?demo=1).
It uses separate browser storage and removes sample changes when you leave.

## What it does

- Records only the project folder you choose.
- Encrypts snapshots, manifests, retention settings, and Pro policy notes locally.
- Skips `.git`, `node_modules`, `target`, and `dist` folders.
- Skips files over 2 MB.
- Compares each checkpoint with the previous checkpoint.
- Lets you retain 2 or 7 recent checkpoints on the free plan, or 30 or 90 with Pro.
- Creates a safety checkpoint before a selected-file reversal.
- Exports a standard unified patch without applying it.
- Loads a bundled sample project in the desktop app.
- Deletes local checkpoint snapshots without changing project files.

The app is not Git and is not a backup service.
Keep normal version control and backups.

## Run the site and demo

Requirements: Node.js 22 and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:4173/?demo=1` to use the local sample.
Choose **Reset demo** for a clean browser sample.

## Run the desktop app

Install the [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

```sh
npm ci
npm run tauri dev
```

Choose **Load sample project** to try a disposable bundled project.
Choose **Reset sample project** to recreate it.
The desktop app never needs access to a real folder for that sample.
Enter a 12-character-or-longer local ledger passphrase before loading or opening a ledger.
The app keeps that passphrase only in memory while the ledger is open.

## Pro plan

Pro adds 30 or 90 checkpoint retention, an encrypted local team policy note, and password-protected recovery export.
The free plan remains useful: it keeps 2 or 7 checkpoints and exports standard patches.

Choose **Have a license? Paste it** to restore a purchase on another device.
The price and **Subscribe to Pro** action appear only after Sociobot publishes a working checkout.
The app verifies a saved license with Sociobot at most once each day and never sends project files with that request.
When checkout is available, Sociobot and Dodo are the merchant of record.

## Install a release

The landing page selects the current release for your operating system.
It links directly to a published macOS, Windows, or Linux file when available.
For macOS, it shows both Apple silicon and Intel downloads so you can choose the correct build.

```sh
curl -fsSL https://agent-change-recovery.sociobot.in/install.sh | sh
```

```powershell
irm https://agent-change-recovery.sociobot.in/install.ps1 | iex
```

The Linux and Windows scripts verify the published SHA-256 checksum first.
macOS builds are unsigned during this release phase. The shell installer picks the matching Apple silicon or Intel disk image.
Open the disk image, then move the app to Applications.
For an unsigned build, Control-click the app and choose **Open**.

## Test and build

```sh
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

`npm test` runs browser claims, routing, accessibility, mobile, privacy, and installer checks.
`npm run build` writes the static deployment output to `dist/site`.

The release workflow builds desktop packages on macOS, Windows, and Linux runners.
Tag `v0.1.7` or later to start that workflow.
It publishes checksums and a release manifest with the desktop files.

## Privacy

Project contents stay in the desktop app and encrypted ledger storage.
The browser landing page asks GitHub for current public release filenames and Sociobot whether Pro checkout is published.
See the in-product [privacy policy](https://agent-change-recovery.sociobot.in/privacy) and [terms](https://agent-change-recovery.sociobot.in/terms).

## License

MIT. See [LICENSE](LICENSE).
