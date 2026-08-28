# Independent verification — FAIL

- **Candidate:** `5239f73f4d878febb6931ef4ab5edb592dce8092`
- **Verified URL:** `https://agent-change-recovery.sociobot.in`
- **Date:** 2026-08-28
- **Method:** clean detached worktree at the candidate, `npm ci`, CI-equivalent Linux Tauri prerequisites, live Chromium/Playwright checks.

## Release decision

**FAIL. Do not release or promote this candidate.** The product's central replay/export promise is broken: its downloaded `.patch` is malformed and cannot be applied by the standard `patch` utility.

## Required first checks

### Claims (run first from the clean clone and demo entry point)

All eight declared claim commands passed.

| Claim | Command/evidence | Result |
| --- | --- | --- |
| selective-reversal | `npm test -- --grep @claim:selective-reversal` | PASS |
| patch-export | `npm test -- --grep @claim:patch-export` | PASS (only asserts text/download, not patch validity) |
| demo-isolation | `npm test -- --grep @claim:demo-isolation` | PASS |
| local-privacy | `npm test -- --grep @claim:local-privacy` | PASS |
| offline-reload | `npm test -- --grep @claim:offline-reload` | PASS |
| price | `npm test -- --grep @claim:price` | PASS |
| free-history-limit | `cargo test --manifest-path src-tauri/Cargo.toml free_history_stops_after_seven_checkpoints` | PASS |
| encrypted-export | `cargo test --manifest-path src-tauri/Cargo.toml encrypted_export_has_versioned_header_and_hides_plaintext` | PASS |

The aggregate browser claim run was also green: `npm test -- --grep @claim:` → **6 passed (16.9s)**. The two native claim commands were rerun after installing the same Ubuntu desktop packages declared by CI and both passed.

`.factory/claims.json` exists. There is no repository `verify-url.sh`; equivalent title/lang/main/alt/console checks were made in live Chromium. The missing script prevented that exact requested command from being run.

### Cold first-read test

PASS. On a fresh 1440px visit, the first screen says **“Reverse the wrong agent changes”**, names **developers supervising long agent sessions**, and has a visible **“Try it with sample data”** link that says a loaded ledger opens next and nothing is saved. It is one click to `/demo`.

## Blocking defects

### P0 — exported “patch” cannot be replayed

The brief requires selective recovery/replay as a patch, and the page promises “Export selected changes as a patch without running it.” On live `/demo`, exporting the preselected `src/auth/session.ts` produced `recovery-cp-3.patch` containing:

```diff
diff --git a/src/auth/session.ts b/src/auth/session.ts
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ selected checkpoint change @@
- const token = await renewOnce()
+ const token = refreshQueue.current
+   ?? renewOnce()
- refreshQueue.current = null
+ return token.value
```

`patch --dry-run -d /tmp/acr-patch-fixture -p1 < /tmp/acr-demo.patch` exited **2** with `patch: **** Only garbage was found in the patch input.` The hunk header is not unified-diff syntax (it has no ranges), so the exported artifact is not a replayable patch. The existing claim test only checks that a file downloads and contains a path/diff text; it does not apply it.

### P1 — live site logs a browser console error on every route

Fresh Chromium visits to `/`, `/demo`, `/app`, `/privacy`, `/terms`, and `/missing-sheet` each log:

```
The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.
```

The production response also sends CSP as a header, but the duplicated meta CSP still violates the no-console-errors quality gate.

### P1 — 390px landing page has horizontal overflow

At a 390px viewport, `/` has `document.documentElement.scrollWidth === 429`. The horizontal operation-card strip and the desktop-download content extend past the viewport (for example, the `Refactor session refresh` preview card spans x=240.7–451.3). This violates the required mobile check. `/demo` itself measured 390px wide.

### P1 — production caching misses the static-product budget policy

The deployed hashed JS, CSS, and WebP assets all return `Cache-Control: public, must-revalidate, max-age=30`, not long-lived immutable cache directives. This includes `/assets/index-DgskPM7x.js`, `/assets/index-E_O7yUjh.css`, and `/assets/hero-ledger.webp`.

### P1 — clean local AppImage production bundle fails

After installing the repository's CI Linux prerequisites, `CI=true npm run tauri build -- --bundles appimage` built the optimized desktop binary successfully but exited **1** while packaging: `failed to bundle project: failed to run linuxdeploy`. No final AppImage was created. The initial plain command also exposed a container/CLI compatibility quirk (`CI=1` is rejected as an invalid `--ci` value); using the standard `CI=true` got past that and exposed the bundler failure. The published release asset exists, but the required clean local production bundle is not reproducible in this verification environment.

### P2 — unlisted reliability claims

The live landing page and README make material claims that do not have matching entries/tests in `.factory/claims.json`, including that the ledger “does not commit, reset, rebase, or alter Git history,” watches only a chosen folder, and that free safety/patch export controls are never gated. The claims contract requires each visitor-relevant claim to be listed and observably tested.

### P2 — unknown route has HTTP 200

`/missing-sheet` renders the styled SPA not-found screen but returns HTTP **200**, not 404. The configured 404 override is not effective on the deployed host.

## Functional evidence

- Live demo normal path: default one-file reverse and two-file reverse both present a confirmation naming the safety checkpoint; cancel leaves both files selected; confirm marks only `src/auth/session.ts` and `src/editor/autosave.ts` restored while `src/account/profile.ts` and `src/auth/refresh-queue.ts` remain. PASS.
- Boundary/invalid UI paths: unchecking the only selected file disables both Reverse and Export; an empty license verify reports “Paste a license token, then verify it.” PASS.
- Demo privacy: a fresh `/demo` recovery/export flow made requests only to `https://agent-change-recovery.sociobot.in`. PASS.
- Offline/PWA: live service worker controlled the page; after one visit, an offline `/demo` reload returned the ledger and “You are offline. Saved ledgers and the demo still work.” PASS. The service worker has a versioned cache name and calls `skipWaiting`/`clients.claim`.
- Keyboard: skip link focuses `#main`; tab focus uses a visible `rgb(20, 92, 112) solid 4px` outline; the demo confirmation initially focuses its cancel action. PASS.
- Accessibility: live Axe scans at 390px found no serious/critical violations on `/`, `/demo`, `/app`, `/privacy`, `/terms`, or the not-found view; each had one `main` and one `h1`. The console-error defect remains.
- Reduced motion: the stylesheet has a `prefers-reduced-motion: reduce` rule that reduces transition/animation durations. PASS by inspection.
- No product server-side endpoints or sign-in flow were present, so no product request allowance/429 or Entra tenant check applied. The optional license request targets Sociobot's documented external billing API.

## Local quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 0 npm audit vulnerabilities |
| `npm test` | PASS; 14 Playwright tests |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 5 Rust tests after installing the exact CI system dependencies |
| `npm run build` | PASS; `dist/site` generated. JS 10.22 KB gzip, CSS 4.10 KB gzip |
| `CI=true npm run tauri build -- --bundles appimage` | FAIL; optimized binary built, then AppImage bundling exited 1: `failed to run linuxdeploy`. Plain `CI=1` is also rejected by this Tauri CLI as an invalid `--ci` value. |

## Deployment, headers, and release evidence

- The live JS (`index-DgskPM7x.js`) and CSS (`index-E_O7yUjh.css`) SHA-256 values exactly match the candidate’s fresh production build, establishing that deployment matches the tested candidate.
- Home response is HTTPS 200 with HSTS, `nosniff`, strict-origin referrer policy, CSP, and restrictive permissions policy. It has the console-error issue above.
- GitHub Release `v0.1.0` exists. Downloaded `Change.Recovery.Ledger_0.1.0_amd64.deb` SHA-256 was `4d5bb87e6ececf3481e8580e9e364c6dbf2ebbcc32092d66cb8d202d1168d030`, matching published `SHA256SUMS`. `latest.json` parses as version `0.1.0` with nine platform assets.

## Required remediation

1. Generate standards-compliant unified diffs with accurate hunk ranges, then add a `@claim:patch-export` test that runs `patch --dry-run` against a representative fixture and verifies selected-only output.
2. Remove the invalid meta CSP (retain the HTTP CSP header) so every route loads without a console error.
3. Eliminate the 390px page overflow, deploy immutable cache headers for hashed assets, and make clean Linux AppImage bundling reproducible (capture the underlying linuxdeploy error in CI/local logs).
4. Add tests for every remaining visitor-facing reliability claim, or remove/narrow those claims; make the deployed not-found route return HTTP 404.
