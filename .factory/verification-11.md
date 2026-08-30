# Independent product verification 11 — FAIL

Verified 30 August 2026 (UTC).

- Candidate: `992041d3a16347c7f2352dbd2719ab03ab73d5f0`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Artifact: Tauri 2 desktop app, static landing site, and browser demo/PWA
- Decision: **FAIL — do not release or promote this candidate**
- Product code was not modified during verification.

The previously reported deployment blockers are repaired: v0.1.9 has complete desktop releases, the production checkout is live, the deployed static files exactly match a candidate build, and all declared claim commands pass. Fresh verification nevertheless found a release blocker in the shipped desktop app: Sociobot does not allow the Tauri production origin through CORS, so the installed app cannot discover checkout or verify a pasted license. The claim inventory also omits quantitative price and retention claims shown to visitors.

## Release-blocking findings

### P1 — the installed desktop app cannot buy or restore Pro

The browser site works because `https://api.sociobot.in` allows the deployed Sociobot origin. The installed Tauri app runs its web content from `http://tauri.localhost`; the same API does not return `Access-Control-Allow-Origin` for that origin.

Fresh evidence:

- A clean published v0.1.9 AppImage launched under Xvfb and rendered successfully, but its first screen said **“Pro checkout is not available yet.”** The production web page simultaneously showed **“Pro costs $15 per developer each month”** and a live Subscribe link.
- A browser reproduction at the Tauri origin logged `blocked by CORS policy: No 'Access-Control-Allow-Origin' header` for both `GET /api/v1/products` and `GET /api/v1/products/agent-change-recovery/verify?...`.
- The restore form then showed **“The license could not be activated. Check the token and try again.”** The request never became readable to the app.
- A direct request with `Origin: http://tauri.localhost` returned HTTP 200 and the expected JSON, but no `Access-Control-Allow-Origin` header. The same catalog request with the live site origin returned `Access-Control-Allow-Origin: https://agent-change-recovery.sociobot.in`.
- `npm run verify:paid-checkout` independently passed: the product is published at $15 USD and checkout returns HTTP 303. This isolates the fault to native-app access, not catalog availability.

This makes the paid desktop features unusable: a buyer cannot activate 30/90-checkpoint retention, the encrypted team policy note, or encrypted recovery export in the installed product. The mocked `@claim:pro-license` browser test passes because it supplies permissive CORS headers and does not exercise the packaged Tauri origin.

Required repair: allow the exact Tauri origins on the Sociobot API, or perform catalog/license requests through a narrowly scoped Tauri native command. Add a packaged-app integration test against a recorded response using the real production origin behavior.

### P1 — visitor-facing numeric claims are absent from `claims.json`

The live first screen states **“Pro costs $15 per developer each month.”** The landing page and README also state exact free/Pro retention choices of 2, 7, 30, and 90 checkpoints. No entry in `.factory/claims.json` states and tests those numbers. An untagged browser test checks mocked `$15` catalog copy, and the retention test exercises a value of two, but neither substitutes for a declared claim whose wording and test assert every published number.

The claims contract says an unlisted visitor-facing claim fails review. Add explicit price and retention-tier claims with tagged observable tests, or remove/narrow the numeric copy.

### P2 — the published AppImage logs host-library module failures on Ubuntu 24

The checksum-verified published AppImage stayed running and rendered, but stderr contained:

```text
libcurl-gnutls.so.4: undefined symbol: nghttp2_option_set_no_rfc9113_leading_and_trailing_ws_validation
Failed to load module: /usr/lib/x86_64-linux-gnu/gio/modules/libgiolibproxy.so
libdconfsettings.so: undefined symbol: g_assertion_message_cmpint
Failed to load module: /usr/lib/x86_64-linux-gnu/gio/modules/libdconfsettings.so
```

The fresh local Ubuntu 24 build did not emit those module failures, only expected headless EGL warnings, and that local package completed the sample workflow. The published app remained running and rendered, so this is not the primary blocker, but the release should be rebuilt or bundled to avoid host module conflicts.

## Mandatory first checks

### Claims gate

`.factory/claims.json` exists with 29 entries. Before product inspection, every listed command was invoked. The first native command initially stopped at dependency compilation because the clean worker lacked GLib/WebKit development packages; after installing the Linux prerequisites declared by the release workflow, every exact command was rerun independently so one result could not hide another.

- Result after declared prerequisites: **29/29 commands passed**.
- Browser claims passed: selective reversal, demo isolation, offline reload, Pro fixture restore, daily verification, exact platform download, release identity, request privacy, Linux/Windows installer behavior, unsigned macOS, and three-platform workflow.
- Native claims passed: patch dry-run, local privacy/encryption, encrypted retention, boundary recovery, policy-note encryption, encrypted export/import, folder and symlink boundaries, size/generated-folder exclusions, checkpoint contents/comparison, safety reversal, ledger deletion, and bundled sample isolation.

### Cold first-read gate

**PASS.** A fresh 1440×900 profile showed, above the fold:

- What it does: **“Reverse the wrong agent changes.”**
- For whom: developers supervising long agent sessions who need to recover one change without discarding the rest.
- What to click: **“Try it with sample data.”** Adjacent copy says a loaded ledger opens and nothing is saved to the visitor's data.

The action opens the populated ledger in one click. The persistent banner says **“Demo — sample data, nothing is saved”** and provides **Reset demo** and **Start for real**.

## End-to-end behavior

### Live browser demo

- Opened four realistic checkpoints from a fresh context.
- Unchecking the only selected file disabled both Reverse and Export.
- Selected `src/auth/session.ts` and `src/editor/autosave.ts` and left `src/account/profile.ts` unselected.
- Exported `recovery-cp-3.patch`; it contained both selected paths, excluded the unrelated path, and included a unified-diff hunk.
- The confirmation explicitly said other files stay unchanged and initially focused **Keep files**. Focus wrapped inside the dialog, Escape closed it, and focus returned to **Reverse 2 selected files** after the next animation frame.
- Confirming reported **“2 files were reversed. The safety checkpoint is in the ledger.”** Both selected files became restored and the unrelated file remained.
- Reset removed every `demo:` storage key.
- The complete demo flow requested only the product origin and produced no console or page errors.

### Native desktop app

- The exact production command built AppImage, `.deb`, and `.rpm` packages.
- A fresh locally built AppImage launched and showed **Desktop ready**.
- Loading the sample without a passphrase produced a specific recovery message.
- Entering a 21-character passphrase loaded the isolated sample and two checkpoints.
- The sample lived under app data, and encrypted ledger files were created as `manifest.enc`, `snapshot.enc`, `settings.enc`, and `key-check.enc`.
- A binary scan of app data did not find the passphrase or sampled secret strings.
- The native test suite independently exercised selected-file reversal, recovery from its safety checkpoint, standard patch dry-run, missing final newlines, binary rejection, wrong passphrases, retention boundaries, and symlink escape rejection.

## Accessibility, responsive behavior, and PWA

- `scripts/verify-url.sh` passed `/`, `/demo`, `/app`, `/privacy`, and `/terms` for title, language, one main, one h1, image alternatives, and console errors.
- Live Axe scans found **0 serious/critical violations** on those routes and the styled not-found page.
- Every valid route produced no console or uncaught page errors. `/missing-sheet` returned a real HTTP 404 with the designed fallback; Chromium's expected main-resource 404 message was the only error logged for that invalid URL.
- At 390×844, `scrollWidth` was exactly 390. The primary action and all three facts were in the first viewport.
- Keyboard Tab exposed the 224×44 skip link with a 4px blue focus outline; Enter moved focus to `#main`. Dialog focus behavior passed as described above.
- Reduced motion resolved the tested animation and transition to `0.00001s`.
- The service worker was activated and controlling the page from cache `recovery-ledger-v7`; update completed, and `/demo` reloaded offline with its sample and offline notice.
- All crawled internal links and static metadata returned 200; checkout returned 303 and the GitHub download navigation returned 302 to the asset.

## Privacy, headers, limits, and sign-in

- Fresh landing requests used only the product origin, `api.github.com`, and `api.sociobot.in`, matching the disclosed pre-purchase policy.
- The demo recovery/export flow used only the product origin. No analytics, third-party font/script, Azure endpoint, or unrelated origin was observed.
- HTML uses `Cache-Control: public, must-revalidate, max-age=30`; hashed JS/CSS use one-year immutable caching; `sw.js` uses `no-cache`.
- Responses include HSTS, `nosniff`, strict-origin referrer policy, restrictive permissions policy, and a CSP with `frame-ancestors 'none'` in the response header.
- In a fresh rate-limit window, the license verification endpoint allowed 30 requests from one client. Request 31 returned HTTP 429 with `Retry-After: 3`.
- There is no product backend or sign-in flow. Concurrency/health persistence and Microsoft Entra authority checks are therefore not applicable. The only server-side product call is the externally managed Sociobot billing endpoint tested above.

## Local quality gates

| Gate | Result |
| --- | --- |
| `npm ci` | PASS; 28 packages installed |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| Every `.factory/claims.json` command after Linux prerequisites | PASS; 29/29 |
| `npm test` | PASS; 36/36 Playwright tests |
| `npm run build` | PASS; TypeScript and Vite produced `dist/site` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 21/21 native tests |
| `CI=true APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri -- build` | PASS; AppImage, `.deb`, and `.rpm` generated |
| `npm run verify:paid-checkout` | PASS; $15 USD catalog item, checkout HTTP 303 |

Static budgets pass: JavaScript is 42.86 KB raw / 13.60 KB gzip, CSS is 15.78 KB raw / 4.36 KB gzip, the mobile hero candidate is 41.13 KB, and there are no downloaded fonts. A clean Lighthouse 13 mobile run scored performance 100, accessibility 100, best practices 100, and SEO 100; LCP was 1,452 ms, TBT 74 ms, and CLS 0.

## Deployment and release identity

Freshly built candidate files exactly matched production byte-for-byte:

```text
index.html  239137ec898eafdc380a1f9671addb52bb7fa5be5d6bf047b8c13f32b6914d39
app JS      354e803157c643647650ed5143edb46caa58388e267631026d0113ba8960a199
app CSS     3be6a3a3bb181eaf185babfb9e78e4eb132c3ccd6ad8b315e17399b9c78097c5
sw.js       03bb3089c98c2343b9f3644eb1343f1d2416ccf82d4628256b4dc11071aa0e62
```

Candidate `992041d3…` changes only factory evidence/handoff/graph output relative to released product tag v0.1.9; the product source tree is identical to tag commit `70daa47643390692d92339e8ede0619ac4237cb9`.

- GitHub Actions release run `33283161825` completed successfully for v0.1.9 at that commit.
- The public release contains nine desktop artifacts plus `SHA256SUMS` and valid `latest.json`.
- A fresh 82,967,032-byte AppImage download matched published SHA-256 `3e14f1ec3e779bcbd75f3564409d9e60385417031e5b27591cd55c95d92a1b7e` and launched.
- The live one-line Linux installer downloaded the release, verified its checksum, installed an executable into a clean `XDG_BIN_HOME`, and printed the installed path.

## Required remediation

1. Make the Sociobot catalog and license verification reachable from the packaged Tauri origin, then prove checkout discovery and valid-license restoration in an installed-app integration test.
2. Add declared claim entries and exact tagged tests for `$15/month` and the 2/7/30/90 retention quantities, or remove those numeric claims.
3. Rebuild/smoke-test the published AppImage on Ubuntu 24 and eliminate the bundled GIO/libcurl module errors.
