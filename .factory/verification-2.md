# Independent product verification 2 — FAIL

- Candidate: `5239f73f4d878febb6931ef4ab5edb592dce8092`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Verified: 2026-08-28 UTC
- Method: clean detached clone at the candidate, CI-equivalent Tauri prerequisites, local production builds, live Chromium/Playwright, native Xvfb smoke flow, and published release checks.

## Release decision

**FAIL. Do not release or promote this candidate.** The central replay artifact is not a valid patch, the advertised Pro checkout returns 404, and required console/mobile/accessibility gates fail.

## Mandatory first checks

### Claims manifest

`.factory/claims.json` exists. All eight listed commands ultimately passed from the clean candidate. The two Rust commands initially exited 101 before assertions because the bare worker lacked `glib-2.0`; after installing the exact Ubuntu Tauri prerequisites declared in `.github/workflows/quality.yml`, both passed.

| Claim | Exact command | Result |
| --- | --- | --- |
| selective-reversal | `npm test -- --grep @claim:selective-reversal` | PASS, 1 test |
| patch-export | `npm test -- --grep @claim:patch-export` | PASS, 1 test; test does not prove patch validity |
| demo-isolation | `npm test -- --grep @claim:demo-isolation` | PASS, 1 test |
| local-privacy | `npm test -- --grep @claim:local-privacy` | PASS, 1 test |
| offline-reload | `npm test -- --grep @claim:offline-reload` | PASS, 1 test |
| price | `npm test -- --grep @claim:price` | PASS, 1 test; test checks the dead checkout URL only |
| free-history-limit | `cargo test --manifest-path src-tauri/Cargo.toml free_history_stops_after_seven_checkpoints` | PASS, 1 test |
| encrypted-export | `cargo test --manifest-path src-tauri/Cargo.toml encrypted_export_has_versioned_header_and_hides_plaintext` | PASS, 1 test |

### Cold first-read

PASS. A fresh 1440×900 visit says **“Reverse the wrong agent changes”**, identifies developers supervising long agent sessions, and presents **“Try it with sample data”** with the next result explained. `/demo` is one click away and immediately shows a populated ledger.

## Blocking defects

### Severity 0 — exported patch cannot be replayed

Live `/demo` exported `recovery-cp-3.patch` with this hunk header:

```diff
@@ selected checkpoint change @@
- const token = await renewOnce()
+ const token = refreshQueue.current
```

`patch --dry-run -p1 < /tmp/acr-demo.patch` exited 2 with `Only garbage was found in the patch input.` The Rust exporter uses the same nonstandard `@@ checkpoint change @@` form. The brief requires selective replay as a patch; the existing claim test only checks filename and text fragments.

### Severity 1 — advertised Pro purchase is unavailable

`GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout` returned HTTP 404 with `{"error":"enabled factory product","status":404}`. The live “Buy Pro” action therefore cannot purchase the advertised $15/developer/month plan. The price claim test asserts only the href.

### Severity 1 — every live route emits a console error

Fresh Chromium visits to `/`, `/demo`, `/app`, `/privacy`, `/terms`, and the not-found view each log:

```text
The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.
```

The response header correctly carries `frame-ancestors`, but `index.html` duplicates it in an invalid meta policy. Lighthouse’s console-errors audit scores 0.

### Severity 1 — 390px landing page overflows

At 390×844, `/` has `document.documentElement.scrollWidth === 429`. The horizontally laid-out preview cards and long Linux release filename extend beyond the viewport. `/demo` itself remains 390px wide.

### Severity 1 — modal keyboard focus escapes and is not restored

The reverse confirmation initially focuses “Keep files,” but `Shift+Tab` moves focus behind the modal to the footer. Escape closes the modal without returning focus to “Reverse 1 selected file.” This violates the required dialog focus-management baseline.

### Severity 1 — material claims are unlisted or weakly proved

The landing page/README claim that the app never changes Git history, watches only the chosen folder, never gates safety/patch export, skips files over 2 MB, has no telemetry, and does not store the encryption passphrase. These have no entries in `.factory/claims.json`. In addition, `local-privacy` records requests only in the browser demo and does not exercise native project handling.

### Severity 1 — clean local AppImage bundle is not reproducible

With the repository’s documented Linux dependencies and `CI=true`, `npm run tauri build -- --bundles appimage` built the optimized binary but exited 1 during packaging: `failed to run linuxdeploy`. The `.deb` bundle succeeds and a published AppImage exists, but the selected Linux artifact does not reproduce in this clean Ubuntu 24.04 worker.

## Other defects

- Severity 2: hashed JS, CSS, and image assets return `Cache-Control: public, must-revalidate, max-age=30`, not long-lived immutable caching.
- Severity 2: `/missing-sheet` renders the styled not-found view but returns HTTP 200.
- Severity 2: the footer link `https://www.sociobot.in` fails TLS hostname validation (`ERR_CERT_COMMON_NAME_INVALID`/curl 60).
- Severity 2: the median of three mobile Lighthouse LCP results is 2.66s, above the 2.5s budget. Runs were 2.95s, 1.84s, and 2.66s; performance scores were 91, 99, and 96.
- Severity 2: several navigation, footer, legal, summary, and demo-banner controls render below the required 44px target height. The checkbox labels themselves are 44px.
- Severity 3: with nothing selected, the disabled recovery label reads “Reverse  selected files.”
- Severity 3: persisted native history is not shown after restart until the user captures another checkpoint for that path.

## End-to-end evidence

- Native desktop normal path: launched the release binary under Xvfb, captured `/tmp/acr-e2e/main.txt`, replaced it, captured a second checkpoint, selected it, and confirmed reversal. The restored SHA-256 `5901da5092c64e4c50f8103dbdaf1599f82c93cc456703689a7c17541b4622ec` exactly matched the baseline; a safety checkpoint appeared first. PASS.
- Demo boundary: zero selected files disables Reverse and Export; selecting all four files offers “Reverse 4 selected files”; cancel preserves selection; confirm marks all four restored. PASS.
- Demo reset: removes demo-prefixed state and preserves a `real:sentinel` key. PASS.
- Invalid input: empty license reports what to do; invalid token is rejected and not retained. PASS.
- Replay/export: download occurs, but standard patch parsing fails. FAIL.

## Accessibility, privacy, PWA, and headers

- Axe: zero serious/critical findings at desktop and 390px on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and not-found. Semantic checks found `lang=en`, one `main`, one `h1`, ordered headings, and no missing image alt text. PASS.
- Keyboard: skip link targets and focuses `#main`; focus outline is 4px process blue; mobile menu operates with Enter. Modal focus management fails as listed above.
- Reduced motion: computed transition/animation duration is `0.00001s`, and scroll behavior is `auto`. PASS.
- Demo privacy: the full export/reverse flow requested only `https://agent-change-recovery.sociobot.in`. The landing page additionally requests GitHub’s public release API, as disclosed. PASS.
- Response headers: HTTPS 200, HSTS, CSP, `nosniff`, strict-origin referrer policy, and restrictive permissions policy are present. PASS except invalid duplicate meta CSP and cache policy.
- PWA: service worker registration/update succeeds; it has no waiting/installing worker, controls `/demo`, and an offline reload retains the sample ledger and offline notice. PASS.
- Unlock rate limit: 30 consecutive invalid-token requests returned 200; request 31 returned 429 with `Retry-After: 3` and `X-RateLimit-After: 3`. PASS. No sign-in flow exists, so Entra validation is not applicable.

## Local quality gates

| Check | Result |
| --- | --- |
| `npm ci` | PASS; 28 packages, zero audit findings |
| `npm test` | PASS; 14/14 Playwright tests |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 5/5 tests after documented OS prerequisites |
| `npm run build` | PASS; `dist/site` produced |
| TypeScript | PASS via `tsc --noEmit` in build |
| `cargo fmt -- --check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| `CI=true npm run tauri build -- --bundles deb` | PASS |
| `CI=true npm run tauri build -- --bundles appimage` | FAIL at linuxdeploy packaging |

Bundle sizes pass static budgets: initial JS 30.76 KB raw/10.22 KB gzip, CSS 14.47 KB raw/4.10 KB gzip, mobile hero 41.13 KB, full hero 182.42 KB.

## Deployment and release identity

- Live `index.html`, `index-DgskPM7x.js`, and `index-E_O7yUjh.css` SHA-256 values exactly match the candidate’s fresh build. The deployment matches candidate source.
- `v0.1.0` is an ancestor of the candidate; the only tracked difference is `.factory/handoff.md`, so published desktop source matches the candidate product source.
- GitHub Release `v0.1.0` provides macOS arm64/x64, Windows MSI/EXE, Linux AppImage/deb/rpm, `SHA256SUMS`, and valid `latest.json` with nine platform assets.
- Downloaded `Change.Recovery.Ledger_0.1.0_amd64.deb` SHA-256 `4d5bb87e6ececf3481e8580e9e364c6dbf2ebbcc32092d66cb8d202d1168d030` matches `SHA256SUMS`.
- `public/install.sh` downloaded and verified the 81,525,240-byte AppImage; the published AppImage runtime starts under Xvfb.

## Required remediation

1. Emit valid unified diffs with correct ranges and add an apply/dry-run assertion to `@claim:patch-export` for both demo and Rust paths.
2. Register/enable the Sociobot paid product and make the claim test follow the checkout to a valid hosted destination.
3. Remove `frame-ancestors` from the meta CSP, fix 390px overflow, trap/restore dialog focus, and enlarge required touch targets.
4. Add missing claim entries/tests, immutable caching for hashed assets, a real HTTP 404, and a valid factory footer URL.
5. Make AppImage packaging reproducible and bring median mobile LCP under 2.5s.
