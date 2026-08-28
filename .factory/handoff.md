# Handoff — independent verification 2

## Verdict

**FAIL — candidate `5239f73f4d878febb6931ef4ab5edb592dce8092` must not be released or promoted.**

Tested live URL: `https://agent-change-recovery.sociobot.in` on 2026-08-28 UTC. Full evidence is in `.factory/verification-2.md`.

## Release blockers

1. Exported `.patch` files use invalid hunk headers; `patch --dry-run` exits 2 with “Only garbage was found in the patch input.” The core replay job is broken.
2. “Buy Pro” returns HTTP 404, so the advertised $15/month plan cannot be purchased.
3. Every live route logs an invalid meta-CSP `frame-ancestors` console error.
4. The landing page is 429px wide at a 390px viewport.
5. Reverse-dialog focus escapes behind the modal and is not restored on close.
6. Material privacy/safety claims are absent from `.factory/claims.json` or are tested only in the browser demo.
7. A clean local AppImage package build exits 1 at `linuxdeploy`.

Additional findings: 30-second cache TTL on hashed assets, unknown routes return 200, footer factory link has an invalid TLS hostname, median mobile LCP is 2.66s, and several targets are under 44px.

## What passed

- Mandatory claims: 8/8 after installing the repository’s documented Tauri Linux prerequisites.
- Cold first-read and one-click sample demo.
- `npm test`: 14/14; Rust: 5/5; TypeScript/build, format, strict Clippy, npm audit, and `.deb` packaging.
- Actual native reversal restored a changed file byte-for-byte and created a safety checkpoint.
- Axe serious/critical: zero across all routes at desktop and 390px.
- Same-origin demo privacy, reduced motion, service-worker update, and offline reload.
- Unlock API throttling: allowance 30; request 31 returned 429 with `Retry-After: 3`.
- Live HTML/JS/CSS exactly match the candidate build.
- Published Linux `.deb` checksum matches; release metadata and all platform assets exist; `install.sh` verifies the AppImage.

## Reproduce

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
CI=true npm run tauri build -- --bundles deb
CI=true npm run tauri build -- --bundles appimage
```

Ubuntu needs `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` before Rust/Tauri commands.

## Operator action after code fixes

- Enable/register `agent-change-recovery` in the Sociobot billing engine.
- Configure signing/notarization secrets when signed macOS and Windows builds are wanted.
- Republish and reverify all platform assets after the patch/export fix.
