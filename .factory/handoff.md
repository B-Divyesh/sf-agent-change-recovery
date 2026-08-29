# Handoff — independent verification 10

## Result

**FAIL — do not release or promote candidate `e3449421e29444260713c32f31f0ab72e1994f10`.**

Verified 29 August 2026 against `https://agent-change-recovery.sociobot.in`. Product code was not modified. Full evidence is in `.factory/verification-10.md`.

## Release blockers

1. **The candidate desktop release is missing.** The live static site and footer are v0.1.7, but there is no v0.1.7 tag, GitHub release, or release workflow run. Download actions and the live installer deliver v0.1.6. That older app contains pre-repair behavior and does not match the candidate.
2. **Production Pro checkout is unavailable.** `https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout` returns HTTP 404 and the product is absent from the public catalog. Candidate v0.1.7 hides the purchase action honestly, but the contracted `$15/developer/month` tier cannot be bought.

## What passed

- All 28 exact `.factory/claims.json` tests passed after clean dependency installation.
- `npm test`: 35/35; `cargo test`: 21/21.
- TypeScript/Vite build, Rust formatting, Clippy with warnings denied, and the exact Tauri production build passed.
- The cold first screen clearly states what the product does, who it serves, and offers **Try it with sample data** in one click.
- Selective patch export and reversal, reset, error recovery, local sample loading, encrypted storage, and passphrase non-persistence passed.
- Live Axe found zero serious/critical issues. Keyboard, focus, dialog handling, 390px layout, reduced motion, real 404, and offline reload passed.
- Privacy request logging found only the product origin plus the disclosed GitHub release and Sociobot catalog origins. Headers and cache policy passed.
- Static live files match the candidate build byte-for-byte.
- Three mobile Lighthouse runs had median performance 97, accessibility 100, best practices 100, SEO 100, and median LCP 2.387s.
- The license API enforced a fresh observed allowance of 29 requests; request 30 returned 429 with `Retry-After`.

## Reproduce

```sh
npm ci
npm audit --audit-level=high
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
CI=true APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri -- build
bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in
```

Linux Tauri packaging also requires the system dependencies declared in `.github/workflows/release.yml`, including WebKitGTK, AppIndicator, SVG, `patchelf`, `file`, and `libfuse2`.

## Required next actions

1. Publish v0.1.7 from the exact candidate through the GitHub release workflow; verify all macOS, Windows, and Linux assets, `SHA256SUMS`, `latest.json`, and live links.
2. Register/enable the product in Sociobot billing and verify the production hosted checkout.
3. Re-run independent verification against the published v0.1.7 binaries. Smoke-test the Linux AppImage on Ubuntu 24 for GLib/GIO module warnings.

## Workspace note

Pre-existing modified and untracked `graphify-out` files were left untouched and are not part of this verification commit.
