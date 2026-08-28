# Independent product verification 3 — FAIL

- Candidate: `ab49761cd3a7ade4134bb9e8641430843dee750f`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Verified: 2026-08-28 UTC
- Scope: clean checkout; fresh live Chromium/Playwright checks; local locked install, tests, production build, Rust quality gates, and release-asset verification.

## Release decision

**FAIL — do not release or promote this candidate.** The product cannot produce a standard applicable patch, the advertised paid checkout is unavailable, and every live route produces a console error. The 390px layout and dialog keyboard behavior also fail mandatory baseline checks.

`ab49761` contains no product-code repair after verification 2: relative to `6b2749807f62030b15b3d3f9a296d491cd44e93e`, it changes only generated `graphify-out` metadata. Freshly built `index.html`, JS, and CSS SHA-256 hashes exactly equal their live counterparts, so the deployment is the candidate and the defects below are current.

## Required first checks

### Cold first-read

**PASS.** A fresh 1440px visit presents:

- H1: “Reverse the wrong agent changes”.
- Audience/context: “For developers supervising long agent sessions who need to recover one change without discarding the rest.”
- First action: “Try it with sample data”, with the immediate outcome “A loaded ledger opens next. Nothing is saved to your data.”

The action opens `/demo` in one click and immediately shows a populated recovery ledger plus the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real controls.

### Claims manifest

`.factory/claims.json` exists and lists eight claims. From the clean checkout, the six browser commands passed before any other product testing. The two native commands initially could not compile in the bare worker because `glib-2.0` development files were absent; after installing the Tauri Linux prerequisites declared by the repository workflow, both exact commands passed. This is a documented environment prerequisite, not an assertion failure.

| Claim | Exact command | Fresh result |
| --- | --- | --- |
| selective-reversal | `npm test -- --grep @claim:selective-reversal` | PASS, 1 test |
| patch-export | `npm test -- --grep @claim:patch-export` | PASS, 1 test, but does not validate patch syntax/applicability |
| demo-isolation | `npm test -- --grep @claim:demo-isolation` | PASS, 1 test |
| local-privacy | `npm test -- --grep @claim:local-privacy` | PASS, 1 test |
| offline-reload | `npm test -- --grep @claim:offline-reload` | PASS, 1 test |
| price | `npm test -- --grep @claim:price` | PASS, 1 test, but does not follow the checkout |
| free-history-limit | `cargo test --manifest-path src-tauri/Cargo.toml free_history_stops_after_seven_checkpoints` | PASS, 1 test |
| encrypted-export | `cargo test --manifest-path src-tauri/Cargo.toml encrypted_export_has_versioned_header_and_hides_plaintext` | PASS, 1 test |

## Release blockers

### Severity 0 — exported recovery patches are invalid

The live demo’s selected-file export is named `recovery-cp-3.patch` and contains:

```diff
diff --git a/src/auth/session.ts b/src/auth/session.ts
--- a/src/auth/session.ts
+++ b/src/auth/session.ts
@@ selected checkpoint change @@
- const token = await renewOnce()
+ const token = refreshQueue.current
```

`patch --dry-run -p1 < /tmp/acr-live.patch` exits 2 with `Only garbage was found in the patch input.` The browser implementation (`src/main.ts`) and native `patch_text` implementation (`src-tauri/src/lib.rs`) both emit the same nonstandard hunk header. This breaks the brief’s selective replay-as-a-patch job. The listed `@claim:patch-export` only checks downloaded text fragments, so it does not prove its advertised outcome.

### Severity 1 — advertised Pro checkout is broken

The live Buy Pro target, `https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout`, responds HTTP 404 with `{"error":"enabled factory product","status":404}`. A visitor cannot purchase the advertised $15/developer/month plan. The price claim only asserts copy and href, not a working hosted checkout.

### Severity 1 — all live routes log a CSP console error

Fresh Chromium visits to `/`, `/demo`, `/app`, `/privacy`, `/terms`, and a not-found path all log:

```text
The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.
```

The server header itself includes CSP, but `index.html` incorrectly duplicates `frame-ancestors` in a meta policy. This violates the no-console-errors acceptance gate. `/opt/fleet/lib/verify-url.sh` reports PASS only because it explicitly classifies this exact error as benign; direct browser instrumentation records it.

### Severity 1 — mobile layout overflows at the required 390px viewport

On a fresh 390×844 live landing-page visit, `document.documentElement.scrollWidth` is **429px** while `clientWidth` is **390px**. The first screen can be horizontally scrolled.

### Severity 1 — reverse confirmation dialog does not trap or restore focus

At 390px, opening “Reverse 1 selected file” focuses “Keep files”. `Shift+Tab` moves focus to the footer’s “Built by Param Factory” link behind the modal. Escape closes the dialog and leaves focus on that footer link rather than returning to the invoking button. This fails keyboard-only dialog focus management.

### Severity 1 — material claims are not covered by the claims ledger

Landing/README/privacy copy makes reliance claims not present in `.factory/claims.json`, including that the product does not change Git history, watches only the chosen folder, never gates safety/patch export, skips files over 2 MB, and has no telemetry. The native “project files stay local” promise is only tested in the browser demo; no native request/handling test proves it. These must be either removed or added to the claim ledger with observable tests.

## Other findings

- **Severity 2:** Unknown `/not-a-route` renders the styled missing page but receives HTTP 200, not a real 404.
- **Severity 2:** Hashed static JS returns `Cache-Control: public, must-revalidate, max-age=30`, not immutable long-lived caching as required for hashed deploy assets.
- **Severity 2:** The footer’s `https://www.sociobot.in` link fails TLS verification: `SSL: no alternative certificate subject name matches target host name 'www.sociobot.in'`.
- **Severity 3:** With zero selections, the recovery button says “Reverse  selected files”.

## What passed

- `npm ci`: PASS; 28 packages installed; `npm audit --audit-level=high`: zero vulnerabilities.
- `npm test`: PASS, 14/14 Playwright tests.
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS, 5/5 after documented Linux prerequisites.
- `npm run build`: PASS; exact production static output at `dist/site`; TypeScript passes via `tsc --noEmit`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: PASS.
- Static budgets: JS 30.76 KB raw / 10.22 KB gzip; CSS 14.47 KB raw / 4.10 KB gzip; hero image 182.42 KB. These pass the stated static size budgets.
- Axe Playwright scans on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and not-found found zero serious/critical violations. Every checked route had one h1, one main, language `en`, title, and image alt text.
- Reduced motion: computed transition/animation duration is `0.00001s`; scroll behavior is `auto`.
- Demo privacy: a complete demo export/reverse flow requested only same-origin URLs. The landing page additionally requests GitHub’s public release API, as disclosed by the privacy page. No analytics request was observed.
- PWA: service worker controls `/demo`; `registration.update()` completes with no waiting/installation worker; an offline reload retains the populated demo ledger and banner.
- The unlock endpoint enforces 30 requests from one client: requests 1–30 returned 200; request 31 returned 429 with `Retry-After: 3` and `X-RateLimit-After: 3`.
- Live responses carry HTTPS/HSTS, CSP response header, `nosniff`, strict-origin referrer policy, and restrictive permissions policy. The duplicate meta CSP error remains blocking.
- GitHub Release `v0.1.0` lists Linux, Windows, and macOS artifacts plus `SHA256SUMS` and valid `latest.json`. Downloaded `Change.Recovery.Ledger_0.1.0_amd64.deb` hashes to `4d5bb87e6ececf3481e8580e9e364c6dbf2ebbcc32092d66cb8d202d1168d030`, matching `SHA256SUMS`.

## Required remediation

1. Generate valid unified diffs, including correct hunk ranges, and make the patch-export claim test apply or dry-run the emitted browser and Rust patches against a fixture.
2. Enable/register the Sociobot product so checkout reaches the hosted purchase flow; make the price claim follow and verify that destination.
3. Remove `frame-ancestors` from the meta CSP (retain it only in the response header), eliminate 390px overflow, and implement focus trapping/restoration for both dialogs.
4. Add executable claims for every material privacy/safety/persistence statement, including the native desktop behavior.
5. Serve a true 404, immutable-cache hashed assets, and replace the invalid footer host.
