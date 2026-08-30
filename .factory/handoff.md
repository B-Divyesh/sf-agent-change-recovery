# Handoff — repair 11

## Result

All release-blocking findings in `.factory/verification-11.md` are repaired for Change Recovery Ledger 0.1.11. The researched brief, Tauri desktop artifact, static deployment class, local-first recovery behavior, and passing product flows are unchanged.

## Repairs

1. **Installed desktop billing now works without browser CORS.** The embedded page invokes two narrow Rust commands for the published product listing and license verification. Rust performs the HTTPS requests with a ten-second timeout. It sends no browser `Origin` header and returns only the typed catalog entry or license verdict. The public web page still uses the browser API from the published Sociobot origin.
2. **Every numeric offer is declared and tested.** `.factory/claims.json` now lists the exact `$15 per developer each month` price and the 2/7 Free plus 30/90 Pro retention choices. Each claim has one exact `@claim:` browser test.
3. **The AppImage no longer loads incompatible host GIO modules.** The pinned Linuxdeploy helper gives the bundled GIO library a same-length relative module path and uses the in-memory settings backend. The release workflow now opens the Ubuntu 22.04-built AppImage on a clean Ubuntu 24.04 runner and fails on early exit, missing libraries, undefined symbols, or failed modules.
4. **Local production previews fail quietly when the billing API does not allow their origin.** The catalog request runs only in the packaged app, the published web origin, or the explicit hermetic browser-test build. `verify-url.sh` therefore reports no console errors on a normal localhost production preview.

## Exact regression coverage

- `packaged_billing_uses_native_http_without_a_web_origin` serves committed catalog and license fixtures to the Rust client. It checks the request paths, percent-encoded token, parsed results, and absence of an `Origin` header.
- `packaged Tauri billing uses native commands when browser CORS is unavailable` records browser traffic and command calls. It proves checkout discovery and license restore use native commands with zero browser billing requests.
- `@claim:pro-price` checks the visible `$15` price and exact hosted checkout URL without opening payment.
- `@claim:retention-tiers` checks all four retention values and their Free/Pro availability.
- `scripts/smoke-appimage.sh` runs the real AppImage for 12 seconds in isolated XDG directories. The Ubuntu 24.04 release job rejects the three error classes reported by the verifier.

## Verification completed on 30 August 2026 UTC

- Clean install: Node 22.23.2, npm 10.9.8, `npm ci` installed 28 packages; `npm audit --audit-level=high` found 0 vulnerabilities.
- Claims: all 31 commands from `.factory/claims.json` passed individually.
- Browser: `npm test` passed 38/38 tests on Playwright 1.58.2 Chromium. This includes desktop, 390×844 mobile, 44 px targets, keyboard dialog focus trap/restore, six-route Axe scans, demo isolation, privacy requests, update/offline reload, security policy, routing, 404, and installer checks.
- Native: Rust 1.98.0; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and 22/22 Rust tests passed.
- Production build: `npm run build` produced `dist/site`; initial JS is 43.03 KB raw / 13.69 KB gzip and CSS is 15.78 KB raw / 4.36 KB gzip.
- Local response smoke: `scripts/verify-url.sh` passed `/`, `/?demo=1`, `/app`, `/privacy`, `/terms`, and `/404` with valid title/lang/main/h1/alt and zero console errors.
- Accessibility: all Axe serious/critical counts are zero. Mobile Lighthouse 13 scored performance 99, accessibility 100, best practices 100, and SEO 100; LCP 2.1 s, TBT 60 ms, CLS 0.
- Packaging: a fresh `Change Recovery Ledger_0.1.11_amd64.AppImage` built successfully. SHA-256 was `a38091cd0a9ccaa24e35fa0a2e0d5b7aff07b4984504380966e03b5c96371716`; its 12-second Xvfb smoke had no host-library module failures.
- Copy: `.factory/copy-audit.md` contains 42 audited lines; none exceeds 22 words or uses a banned marketing word.

## Run it

```sh
npm ci
npm audit --audit-level=high
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
CI=true APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri -- build --bundles appimage
bash scripts/smoke-appimage.sh "src-tauri/target/release/bundle/appimage/Change Recovery Ledger_0.1.11_amd64.AppImage"
```

The release workflow builds macOS arm64 and Intel disk images, Windows MSI/EXE files, and Linux AppImage/DEB/RPM files. It publishes `SHA256SUMS` and `latest.json` only after the Ubuntu 24.04 AppImage smoke passes.

## Release and deployment evidence

- Repair commits: `45bb64bf0d3185322f70a53f6c6c1e6e05abbeef` implements the findings; `7d989f0e3b99fee95189effab5c34a63993ae09b` adds the clean-runner graphics prerequisite and is tagged `v0.1.11`.
- GitHub quality run [`33287910730`](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33287910730) passed its browser and Rust jobs.
- GitHub release run [`33287911698`](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33287911698) passed four platform builds, the Ubuntu 24.04 AppImage smoke, and manifest verification.
- Release [`v0.1.11`](https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.11) targets `7d989f0e3b99fee95189effab5c34a63993ae09b`. It contains arm64 and Intel DMGs, MSI and EXE installers, AppImage, DEB, RPM, app archives, `SHA256SUMS`, and `latest.json`.
- Published `latest.json` identifies version `0.1.11` and tag `v0.1.11`. The downloaded AppImage matched `SHA256SUMS` at `347e26646be7f3478faad955c02407def8c9f38e32f8d23ff6129ab014ed4a0b`, remained open for the 12-second Ubuntu 24.04 smoke, logged no module error, and visibly resolved the live `$15` catalog price.
- Interim `v0.1.10` was not promoted after its clean-runner smoke found a missing host `libGLESv2.so.2`. Version 0.1.11 adds `libgles2` to that runner and is the successful release.
- Static deployment `ce487561-7d96-4d98-8276-5186f66602ef` completed at `https://agent-change-recovery.sociobot.in`. The live `/assets/index-BO2myMSz.js` matches local output at SHA-256 `3a1b7264cdf7e8fa8a5e107231d99a629761a9725130583c06a8ba5e871cad01`.
- Live `/`, `/?demo=1`, `/app`, `/privacy`, `/terms`, and `/404` pass title/lang/main/h1/alt/console checks. A missing route returns HTTP 404. CSP includes `frame-ancestors 'none'`; nosniff, strict referrer, and permissions policies are present; hashed assets are immutable; `sw.js` is no-cache.
- Fresh Linux, Windows, Apple silicon, and Intel browser contexts each receive the exact matching 0.1.11 download. The live 390 px demo has no page overflow, zero serious/critical Axe findings, updates to `recovery-ledger-v9`, and reloads offline.
- Final live Lighthouse 13 mobile scores are performance 100, accessibility 100, best practices 100, and SEO 100; LCP 1.4 s, TBT 60 ms, CLS 0.

## Known gaps and operator action

- macOS and Windows packages remain unsigned, as the product already discloses. The workflow does not consume signing secrets. Adding notarization or Authenticode later requires an Apple certificate/notarization setup and a Windows PFX plus password.
- The app does not check for desktop binary updates, so it intentionally ships no updater manifest.

## Workspace note

The pre-existing modified `graphify-out/` files were preserved and excluded from repair commits.
