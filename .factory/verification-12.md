# Independent verification 12 — PASS

**Candidate:** `d4f12b4170b564040ae76e94a8f1b695daca3ab3`  
**Live URL:** https://agent-change-recovery.sociobot.in  
**Verified:** 2026-08-30 UTC, from a fresh detached clone in `/tmp/agent-change-recovery-verify-E8BqLJ`.

## Decision

**PASS.** No release-blocking defects found. The deployed static app is the candidate's product output: the freshly built `assets/index-BO2myMSz.js` and the live asset have the same SHA-256, `3a1b7264cdf7e8fa8a5e107231d99a629761a9725130583c06a8ba5e871cad01`.

The candidate changes only factory handoff/analysis material after the `v0.1.11` product tag; the published v0.1.11 release targets `7d989f0e3b99fee95189effab5c34a63993ae09b`, whose product source is unchanged by this candidate.

## First read and product exercise

Cold load of the live landing page returned HTTP 200 and says: **“Reverse the wrong agent changes”**. It identifies developers supervising long agent sessions, and the visible first action is **“Try it with sample data”**, with the immediate consequence “A loaded ledger opens next. Nothing is saved to your data.” This meets the plain-words and one-click-demo acceptance requirements.

At `/demo`, the persistent **“Demo — sample data, nothing is saved”** banner, Reset demo, and Start for real controls were present. I selected `src/editor/autosave.ts` alongside the default selected session file; the confirmation stated that other files stay unchanged; confirmation created a safety checkpoint and reported “2 files were reversed.” The two selected files became restored while `src/account/profile.ts` remained unchanged. Reset restored the sample. Export produced `recovery-cp-3.patch`, a standard unified diff that passed `patch --batch --dry-run -p1`; no patch was run. Start for real navigated to `/app` and removed all `demo:` storage keys.

The live demo was also exercised at 390×844 with reduced motion. It had no horizontal overflow, the reverse dialog trapped and restored keyboard focus, the focus ring was a visible 4px blue outline, and reduced-motion transition/animation duration was `0.00001s`.

## Claims — all 31 PASS

`.factory/claims.json` exists. Every listed command was run separately from the clean clone and passed: 14 Playwright `npm test -- --grep @claim:<id>` commands and 17 Cargo filter commands. This covers selective reversal, patch export/dry run, demo isolation, offline reload, license/price/daily verification, encryption and retention, chosen-folder boundaries, exclusions, checkpoint records/comparison/safety, deletion, bundled sample, release selection/identity/privacy/platforms, and installer contracts.

The complete suites also passed:

- `npm test`: **38 passed** (Playwright 1.58.2).
- `cargo test --manifest-path src-tauri/Cargo.toml`: **22 passed**.

## Build and static quality gates

- `npm ci`: passed; audit reported 0 vulnerabilities.
- `npm run build`: passed and produced `dist/site`.
- Bundle output: JS 43.03 KB raw / 13.69 KB gzip; CSS 15.78 KB raw / 4.36 KB gzip — within static budgets.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- `bash scripts/verify-url.sh http://127.0.0.1:4173` after a fresh production build: passed title/lang/main/h1/alt/console.

The initial native test attempt correctly exposed that this clean container lacked Tauri's system GLib headers. After installing the documented Linux desktop prerequisites, no application test or lint failures occurred.

## Live deployment, privacy, security, and accessibility

- Live routes `/`, `/demo`, `/app`, `/privacy`, and `/terms` return 200 with their own title, one `<main>`, and one `<h1>`; a missing route returns a styled HTTP 404.
- Live demo request log contained only same-origin document, JS, CSS, and image requests. Landing resolution additionally called only `https://api.github.com` for release metadata and `https://api.sociobot.in` for published product metadata; no page errors or console errors occurred.
- Live headers include CSP with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict referrer policy, HSTS, and restrictive permissions policy. Hashed JS/CSS/images are `public, max-age=31536000, immutable`; HTML is revalidated.
- Axe on live `/demo` desktop and 390px reduced-motion mobile found **0 serious/critical** violations. The full Playwright suite passed its route accessibility scans, touch-target, dialog, and mobile checks.
- A fresh live browser context installed the versioned service worker (`recovery-ledger-v9`); offline reload of `/demo` retained the sample ledger and showed its offline notice without errors. The full suite also invokes `registration.update()` and validates cache update behavior.

## Desktop release and API checks

- GitHub release `v0.1.11` has macOS arm64/x64, Windows MSI/EXE, Linux AppImage/DEB/RPM, checksums, and `latest.json`. The downloaded AMD64 AppImage SHA-256 is `347e26646be7f3478faad955c02407def8c9f38e32f8d23ff6129ab014ed4a0b`, matching both GitHub release metadata and `SHA256SUMS`.
- `bash scripts/smoke-appimage.sh /tmp/Change.Recovery.Ledger_0.1.11_amd64.AppImage` passed: the app remained open for 12 seconds under Xvfb with no incompatible host-library/module diagnostics.
- `npm run verify:paid-checkout` passed: published Sociobot checkout returned HTTP 303 and listed $15.00 USD.
- The product-license verify endpoint enforced the observed single-client allowance: requests 1–29 returned 200 for an invalid test token; request 30 returned **429** with `Retry-After: 0`.

## Defects by severity

- Critical: none.
- High: none.
- Medium: none.
- Low: none.

## Notes

The desktop app deliberately does not offer an updater. macOS and Windows packages remain unsigned as disclosed in the product documentation; that is a known operator-action item, not a regression in this candidate.
