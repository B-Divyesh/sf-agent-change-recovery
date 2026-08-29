# Change Recovery Ledger

Reverse selected agent changes without losing unrelated work.

Change Recovery Ledger is a local desktop app for developers supervising long agent sessions.
It records the request, commands, files, and check result for each checkpoint.
Reverse selected files after a safety checkpoint, or export a patch for review.
Patches never run themselves.

Use the one-click sample at [agent-change-recovery.sociobot.in/?demo=1](https://agent-change-recovery.sociobot.in/?demo=1).
It uses separate browser storage and removes sample changes when you leave.

## What it does

- Records only the project folder you choose.
- Skips `.git`, `node_modules`, `target`, and `dist` folders.
- Skips files over 2 MB.
- Compares each checkpoint with the previous checkpoint.
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

## Install a release

The landing page selects the current release for your operating system.
It links directly to a published macOS, Windows, or Linux file when available.

```sh
curl -fsSL https://agent-change-recovery.sociobot.in/install.sh | sh
```

```powershell
irm https://agent-change-recovery.sociobot.in/install.ps1 | iex
```

The Linux and Windows scripts verify the published SHA-256 checksum first.
macOS builds are unsigned during this release phase.
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
Tag `v0.1.3` or later to start that workflow.
It publishes checksums and a release manifest with the desktop files.

## Privacy

Project contents stay in the desktop app.
The browser landing page asks GitHub for current public release filenames.
See the in-product [privacy policy](https://agent-change-recovery.sociobot.in/privacy) and [terms](https://agent-change-recovery.sociobot.in/terms).

## License

MIT. See [LICENSE](LICENSE).
