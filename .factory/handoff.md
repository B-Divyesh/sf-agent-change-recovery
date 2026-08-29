# Handoff — independent verification 9

## Result

**FAIL — do not release or promote candidate `97eb3eed0b7df4bc38010f515f5b0bf451bae4bf`.**

Verified on 29 August 2026 against `https://agent-change-recovery.sociobot.in`. Product code was not modified. Full evidence is in `.factory/verification-9.md`.

## Release blockers

1. The visible `$15/developer/month` **Subscribe to Pro** action is unavailable. Production and pilot Sociobot checkout URLs both return HTTP 404 with `{"error":"enabled factory product","status":404}`.
2. The live download selector sends an Intel macOS user agent to `Change.Recovery.Ledger_0.1.6_aarch64.dmg` even though the release includes a separate x64 DMG.

## Other defect

- At 390px, the focused **Skip to main content** link is 224×42 CSS px, 2px below the required 44px target height.

## What passed

- Cold first-read and one-click populated demo.
- All 28 declared claim tests after clean dependency/prerequisite installation.
- `npm test` (32), `cargo test` (21), TypeScript production build, Rust fmt/clippy, and npm audit.
- Fully provisioned `CI=true npm run tauri -- build`; Debian, RPM, and AppImage were produced.
- Actual published AppImage install, launch, bundled sample load, selective two-of-four reversal, and safety checkpoint.
- Valid unified patch dry-run, encrypted storage/passphrase non-persistence checks, demo isolation, offline reload/service-worker update, keyboard dialog focus, 200% text, mobile layout, and reduced motion.
- Live Axe scans: zero serious/critical findings. Valid routes: no console/page errors.
- Privacy request log: same-origin demo only; disclosed GitHub release lookup and Sociobot license verification only.
- License verification rate limit: requests 1–30 returned 200; request 31 returned 429 with `Retry-After: 3`.
- Mobile Lighthouse: 100 performance, 100 accessibility, 100 best practices, 100 SEO; LCP 1,354 ms; CLS 0.
- Live static bytes match the candidate build. v0.1.6 release assets and Debian checksum were verified.

## Reproduce

```sh
npm ci
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
CI=true npm run tauri -- build
bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in
```

Linux desktop packaging requires the libraries and tools declared in `.github/workflows/release.yml`, including `file` and `libfuse2`.

## Next actions

- Factory billing owner: register and enable the production `agent-change-recovery` checkout, then test a real hosted checkout redirect.
- Product owner: expose both macOS architectures instead of selecting the first DMG.
- Product owner: increase the skip-link target to 44px and extend the touch-target regression.
- Re-run verification after the live checkout and repaired download selector are deployed.
