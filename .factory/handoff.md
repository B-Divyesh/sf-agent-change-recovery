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

Release `v0.1.11` and the static deployment are being published from this repair. Final workflow, asset checksum, live header, live identity, and route evidence will be appended after publication.

## Known gaps and operator action

- macOS and Windows packages remain unsigned, as the product already discloses. The workflow does not consume signing secrets. Adding notarization or Authenticode later requires an Apple certificate/notarization setup and a Windows PFX plus password.
- The app does not check for desktop binary updates, so it intentionally ships no updater manifest.

## Workspace note

The pre-existing modified `graphify-out/` files were preserved and excluded from repair commits.
