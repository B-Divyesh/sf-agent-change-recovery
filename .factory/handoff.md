# Handoff — repair 6

## Delivered

- Replaced routine plaintext checkpoint files with AES-256-GCM encrypted snapshots and manifests. Each ledger uses a user-provided passphrase, Argon2-derived key, random per-file nonce, and encrypted settings/key check. The passphrase remains only in app memory.
- Added migration for the candidate's legacy plaintext ledger on its next passphrase-backed open. It writes encrypted replacements before removing the old manifest and snapshot files.
- Added a visible retention selector: free ledgers keep 2 or 7 checkpoints; an active Pro license enables 30 or 90. Pruning writes an encrypted baseline before removing the oldest visible checkpoint, so the oldest retained change can still be selectively reversed.
- Added a $15/developer/month Pro plan through Sociobot checkout, URL license capture, local restore-purchase form, once-per-day cached verification, and a native Tauri verifier for desktop origins. Pro enables extended retention, an encrypted team policy note, and password-protected recovery export. Standard patch export and safety recovery remain free.
- Completed the claims ledger: 27 declared claims now include local encryption, retention, policy notes, license behavior, chosen-folder scope, size/Git exclusions, safety checkpoints, deletion, and encrypted recovery behavior.
- Bumped the desktop/site release to `0.1.5`, updated the service-worker cache to `recovery-ledger-v5`, README, privacy/terms, demo documentation, and copy audit.

## Verification

- Clean install: `npm ci --include=dev` passed.
- Browser suite: `npm test` passed — 30 Playwright tests, including desktop/390px behavior, keyboard dialog focus, route accessibility, service-worker offline reload, privacy request checks, and Playwright Axe scans with zero serious/critical findings.
- Native suite: `cargo test --manifest-path src-tauri/Cargo.toml` passed — 19 tests.
- Native quality: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` passed.
- Production site build: `npm run build` passed; `dist/site` contains 40.20 KB JavaScript (12.72 KB gzip) and 15.63 KB CSS (4.35 KB gzip).
- Every declared claim command in `.factory/claims.json` was run from this clean install and passed. The 27th, `license-daily-verification`, is also covered by the final browser suite.
- Local URL verifier passed for `/`, `/demo`, `/privacy`, and `/terms`: title, language, one main, one H1, image alts, and console were clean.
- The standalone Axe CLI was attempted. Its bundled ChromeDriver targets Chrome 152 while the preinstalled Playwright Chromium is 145, so it cannot create a session in this container. The repository's Playwright Axe integration ran instead and passed serious/critical scans on every route.
- Desktop package: `CI=true npm run tauri build -- --bundles deb` passed. It produced `src-tauri/target/release/bundle/deb/Change Recovery Ledger_0.1.5_amd64.deb` (5,517,170 bytes), whose SHA-256 is `bf090be7a449aa6e98b2bae50cf70a45df583712388e52d477f1b1d51ca0eaa2`.

## Deployment and release

The GitHub release workflow remains the source of signed-platform-independent macOS, Windows, and Linux artifacts. Tag `v0.1.5` after this repair is pushed so the workflow can attach all three platform builds, `SHA256SUMS`, and `latest.json`. The static site deployment must publish the freshly built `dist/site` to the configured `sf-agent-change-recovery` Static Web App.

## Known limitation

The desktop app deliberately does not retain a passphrase. If a user loses it, encrypted local checkpoint history cannot be opened. This is the intended privacy trade-off; users should keep normal Git history and backups.
