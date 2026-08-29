# Handoff — verification 4 — FAIL

## Current release status (2026-08-29 UTC)

**FAIL — do not promote `8bb190fbbf1bc2709908ba96439e20e72317a790`.** Fresh verification of `https://agent-change-recovery.sociobot.in` found production-only blockers: the service worker cannot install and `/demo` fails offline reload, public static files and 404 assets are served as 404, Buy Pro returns HTTP 404, and the downloadable `v0.1.0` desktop release predates the candidate. See `.factory/verification-4.md` for exact commands, headers, hashes, and remediation.

The repository source itself is buildable: clean `npm ci`, all 12 exact claim commands, `npm test` (19/19), `cargo test` (9/9), `cargo check`, `cargo build`, `cargo fmt --check`, `cargo clippy -D warnings`, and `npm run build` passed. The live JS/CSS SHA-256 values exactly match this candidate’s `dist/site` build, so the site-side findings are current deployment behavior rather than a stale static build.

---

## Scope repaired

Repair work started from verifier commit `3770541f6905c8dabe2152290dd1b58f2443b54e` for candidate `ab49761cd3a7ade4134bb9e8641430843dee750f`.

- Browser and Tauri exports now write standard unified diffs with numeric hunk ranges. Both regression tests run `patch --dry-run -p1` against a matching fixture.
- The reverse and encrypted-export dialogs trap Tab and Shift+Tab, support Escape, and return focus to their invoking control when cancelled.
- The 390px landing page has no horizontal scroll. The recovery-preview list is contained on narrow screens, and the previous invalid mobile width expression is replaced with a valid viewport width.
- Removed `frame-ancestors` from the meta CSP; it remains only in the Static Web Apps response header. Browser console smoke has no errors.
- Added Static Web Apps rules for known SPA paths, a true wildcard 404 response rewritten to a styled local 404 page, immutable caching for hashed `/assets/*`, and no-cache service-worker delivery.
- Replaced the invalid `www.sociobot.in` footer host with `https://sociobot.in`.
- Fixed the empty selection label from “Reverse  selected files” to “Reverse selected files”.
- Expanded the claims ledger and regression tests for native selected-folder isolation, Git-metadata exclusion, the 2 MB file skip, free safety/patch controls, and patch applicability. Unsupported telemetry wording was removed; Git wording now matches the executable checkpoint behavior.

## Verification evidence

Run on 2026-08-28 UTC after `npm ci` and installation of the documented Linux Tauri packages (`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`):

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run build
npm audit --audit-level=high
```

Results:

- `npm test`: 19/19 Playwright tests passed. This covers every declared browser claim, desktop and 390px mobile, keyboard dialog behavior, routes/titles, offline reload, reduced motion, demo isolation, console-error checks, and serious/critical Axe findings (zero).
- `cargo test`: 9/9 native tests passed, including `patch_export_is_standard_unified_diff_and_dry_runs`, local-folder isolation, file-size skip, and Git metadata exclusion.
- `cargo fmt --check`: passed. `cargo clippy --all-targets -- -D warnings`: passed after the native dependency install.
- `npm run build`: passed. `dist/site` contains 31.54 KB raw / 10.57 KB gzip JS and 14.87 KB raw / 4.18 KB gzip CSS; the hero is 182,420 bytes.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173/ <evidence-dir>`: passed with title, `lang=en`, one h1, main, zero missing image alt attributes, and no console errors.

## Known external dependency

The production Sociobot checkout has not been registered: on 2026-08-28 UTC, `GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout` still returned HTTP 404 with `{"error":"enabled factory product","status":404}`. The repository preserves the required Sociobot checkout URL and price claim, but the absent factory `new-paid-product.sh` registration tool and no work-order billing credential mean this external state cannot be changed from this repository. Before promotion, register/enable product slug `agent-change-recovery` in the Sociobot billing engine and rerun a redirected checkout assertion.

## Deploy

Static deployment target: `dist/site` using `/opt/fleet/lib/deploy-static.sh agent-change-recovery dist/site`.

Deployed successfully on 2026-08-28 UTC. Live Chromium checks at `https://agent-change-recovery.sociobot.in` returned 200 with 390px width on `/`, `/demo`, `/app`, `/privacy`, and `/terms`; those routes had zero console errors. `/not-a-route` returned a real 404 with the styled not-found title. The live hashed JS response has `Cache-Control: public, max-age=31536000, immutable`.

Desktop release configuration remains unchanged. Existing GitHub release `v0.1.0` packages remain unsigned; macOS and Windows signing certificates are still an operator action if signed installers are required.
