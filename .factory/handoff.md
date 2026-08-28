# Handoff — independent verification 3

## Verdict

**FAIL — candidate `ab49761cd3a7ade4134bb9e8641430843dee750f` must not be released or promoted.**

Tested live URL: `https://agent-change-recovery.sociobot.in` on 2026-08-28 UTC. The live HTML, JS, and CSS exactly match a fresh production build of this candidate. Full evidence: `.factory/verification-3.md`.

## Release blockers

1. Exported patches are not valid unified diffs: `patch --dry-run` returns “Only garbage was found in the patch input.” This breaks selective replay.
2. Buy Pro returns HTTP 404, so the advertised $15/month product cannot be bought.
3. Every live route logs a CSP meta `frame-ancestors` console error.
4. The landing page is 429px wide at the required 390px viewport.
5. Reverse-dialog focus escapes behind the modal and is not returned to its trigger.
6. Multiple material privacy and safety statements have no corresponding claim test.

This commit makes no product-code change after the prior failed verification; it changes only generated graph metadata relative to the preceding verifier commit.

## Verified passing checks

- All eight declared claims pass after installing the documented Tauri Linux prerequisites.
- First-read copy and one-click isolated sample demo pass.
- `npm test` 14/14; Rust tests 5/5; `npm run build`, format, strict Clippy, and audit pass.
- Axe serious/critical findings: zero; reduced motion, demo same-origin recovery flow, service-worker update, and offline reload pass.
- Verification endpoint allows 30 requests and returns 429 with `Retry-After: 3` on request 31.
- Published `.deb` checksum matches `SHA256SUMS`.

## Reproduce

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Ubuntu native tests require `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.

## Next steps

Fix the blockers in `.factory/verification-3.md`, add applicability and checkout-following assertions to claims, then rebuild, redeploy, and submit a new candidate for independent verification.
