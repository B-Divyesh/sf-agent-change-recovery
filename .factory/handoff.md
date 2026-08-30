# Handoff — independent verification 11

## Result

**FAIL — do not release or promote candidate `992041d3a16347c7f2352dbd2719ab03ab73d5f0`.**

Verified live URL: `https://agent-change-recovery.sociobot.in` on 30 August 2026 UTC. Full evidence is in `.factory/verification-11.md`. Product code was not modified.

The earlier deployment-only blockers are repaired: the live static files exactly match the candidate product tree, v0.1.9 has complete cross-platform assets and checksums, the checkout is published at $15 USD, every one of the 29 declared claim commands passes after installing the repository's Tauri prerequisites, and the browser demo works end to end.

## Release blockers

1. **P1 — paid unlock is broken in the installed desktop app.** The production billing API omits `Access-Control-Allow-Origin` for `http://tauri.localhost`. A clean published AppImage therefore reports that checkout is unavailable, and its license restore request is blocked by CORS. The same API works from the deployed web origin. Paid desktop features cannot be activated.
2. **P1 — unlisted numeric claims.** The live page promises `$15 per developer each month`, and site/README copy promises retention choices of 2, 7, 30, and 90 checkpoints. `.factory/claims.json` does not declare and exactly test those quantitative claims.
3. **P2 — published AppImage host-library errors.** On Ubuntu 24 the checksum-verified release launches, but logs missing-symbol failures for `libgiolibproxy.so` and `libdconfsettings.so`. A fresh local package does not show those failures.

## What passed

- Cold first-read and one-click sample-data gate.
- All 29 declared claim commands; full `npm test` (36), Rust tests (21), formatting, warning-as-error lint, npm audit, static build, and exact Tauri production build.
- Live selective patch export and two-file reversal, safety confirmation, reset/isolation, keyboard dialog behavior, 390px layout, reduced motion, service-worker update, and offline reload.
- Zero serious/critical Axe findings and no console/page errors on every valid route.
- Privacy request log, security headers, caching, and bundle budgets.
- License API rate limit: 30 successful requests; request 31 returned 429 with `Retry-After: 3`.
- Lighthouse 13 mobile: performance/accessibility/best practices/SEO 100/100/100/100; LCP 1,452 ms, TBT 74 ms, CLS 0.
- Published AppImage SHA-256 and clean Linux installer flow.

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
npm run verify:paid-checkout
bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in
```

Linux needs the packages listed in `.github/workflows/release.yml`. Do not address the desktop CORS failure by weakening CSP or disabling web security; allow only the required Tauri origin or move the two billing requests behind narrow native commands.

## Workspace note

Pre-existing modified and untracked `graphify-out/` files were preserved and must not be included in this verification commit.
