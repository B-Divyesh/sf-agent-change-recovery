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

- Committed repair: `661df98` (`fix: encrypt ledgers and enforce retention`), pushed to `main`; tag `v0.1.5` is pushed.
- Static deployment: deployed `dist/site` to the configured `sf-agent-change-recovery` Azure Static Web App production environment. It is live at `https://agent-change-recovery.sociobot.in` (Azure endpoint: `https://yellow-field-06248de10.7.azurestaticapps.net`). The custom domain serves the release's `index-Bmm9SXYy.js`; live URL checks passed for `/`, `/demo`, `/privacy`, and `/terms`.
- Desktop release: [Change Recovery Ledger v0.1.5](https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.5). GitHub Actions run [33267150720](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33267150720) completed successfully on 2026-08-29 for macOS Intel/Apple Silicon, Windows, and Linux, then published `SHA256SUMS` and valid `latest.json`.
- Consumer check: downloaded release asset `Change.Recovery.Ledger_0.1.5_amd64.deb` and verified it against the published `SHA256SUMS`: `8f199f3ed264acf9487ac115fc726da3d571bc55e38169c750b762e48256d8c2` — `OK`.
- The published desktop artifacts are unsigned. A production signed release needs the owner to add platform signing configuration to the workflow (Apple certificate/notarization credentials and a Windows Authenticode PFX); none are embedded in this repository.

## Known limitation

The desktop app deliberately does not retain a passphrase. If a user loses it, encrypted local checkpoint history cannot be opened. This is the intended privacy trade-off; users should keep normal Git history and backups.

## Repair 7 — 29 August 2026

### Delivered

- Reproduced the controller's intermittent browser failure by fulfilling the landing page's GitHub release request with HTTP 403. Chromium emitted `Failed to load resource: the server responded with a status of 403 (Forbidden)` even though the product's fallback copy rendered.
- Made the Playwright suite hermetic for the documented GitHub release lookup. Each regular browser context now receives a realistic local release fixture; the release/privacy tests retain route-specific fixtures. This prevents rate-limit-dependent external 403s from becoming console resource errors during unrelated quality checks.
- Strengthened the built CSP regression: it now asserts that the release request was intercepted exactly once, the fixture result rendered, `frame-ancestors 'none'` remains response-header-only, and the console error list is empty.
- Reconfirmed the report-7 delivery remains present: encrypted local snapshots/manifests, enforced 2/7/30/90 retention, listed claim coverage for all public safety/privacy behavior, and the $15/month Sociobot Pro restore flow.

### Verification

- Clean JavaScript install: `npm ci --include=dev` — passed with 0 audit vulnerabilities.
- Exact security-policy regression: `npm test -- --grep "built security policy keeps frame ancestry"` — passed. Forced pre-fix 403 evidence was captured before the repair; the complete suite has no browser console resource error in this test.
- Browser suite: `npm test` — **30 passed**. This includes desktop and 390px mobile layouts, keyboard/focus dialog behavior, Playwright Axe serious/critical scans, demo isolation, request privacy, service-worker offline/update behavior, and all browser claims.
- Native suite: `cargo test --manifest-path src-tauri/Cargo.toml` — **19 passed**; `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` — passed.
- Production build: `npm run build` — passed; `dist/site` contains 40.20 KB JavaScript (12.72 KB gzip) and 15.63 KB CSS (4.35 KB gzip).
- Local desktop package: `CI=true npm run tauri build -- --bundles deb` — passed; produced `Change Recovery Ledger_0.1.5_amd64.deb` (5,517,160 bytes, SHA-256 `84c74fe62034399a942a29206ae97e7aa6bc606daa507754078af2a359b74dcc`). Extracting it as a consumer yielded an executable `/usr/bin/change-recovery-ledger`.
- Published-consumer check: downloaded the v0.1.5 Debian asset and verified it against its published `SHA256SUMS` — passed.
- Live production check: `scripts/verify-url.sh` passed on `/`, `/demo`, `/privacy`, and `/terms` (title, `lang`, exactly one `main`/`h1`, image alts, and no console errors). The live response has the response-header CSP with `frame-ancestors 'none'`; the hashed JS has `Cache-Control: public, max-age=31536000, immutable`.
- Mobile Lighthouse against production: performance **99**, accessibility **100**, LCP **1,356 ms**, TBT **100 ms**, CLS **0**.

### Packaging note

The local Debian package is reproducible. The local AppImage attempt reaches `linuxdeploy` with the CI environment flag (`APPIMAGE_EXTRACT_AND_RUN=1`) but exits 1 on this Ubuntu 24.04 container because its GTK plugin fails after staging the AppDir; `/dev/fuse` is also absent. The release workflow deliberately uses Ubuntu 22.04 and the existing checksum-verified v0.1.5 AppImage remains the consumer artifact. This is a runner/tooling limitation, not a desktop runtime regression.
