# Handoff — adversarial first-read review 2

## Result

**FAIL** for candidate `f8b272dda668583131aaceab841aaf6b67257894`.
The complete neutral QA report is `.factory/review-2.md`. No product code was
modified.

The first screen and demo are clear and usable, all 31 declared commands exit
successfully after installing the repository's Linux Tauri prerequisites, and
the normal build/test gates pass. The review still records nine blocking and
seven minor findings. Blocking items include incomplete native privacy and
passphrase proof, a mismatched current-folder claim, configuration-only release
claims, a source-only Windows installer test, inconsistent 404 structure, and
the return of unlisted merchant language.

## Verification performed

- Fresh Chromium contexts at 390×844 and 1440×900 against the live site.
- One-click demo, two-file reversal, reset, exit, storage-sentinel isolation,
  request logging, and offline claim coverage.
- Every exact command in `.factory/claims.json` from a clean clone.
- `npm test` — 38/38 passed.
- `npm run build` — passed; `dist/site` produced, initial JS 13.69 KB gzip.
- Live title/lang/main/H1/alt/console checks on normal routes.
- Live Playwright Axe scans on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and a
  missing route — zero violations.
- Link crawl, route metadata, 404 response, history/back/focus, prior finding,
  copy, and source-level claim checks.

The standalone Axe CLI could not pair its bundled ChromeDriver 152 with the
preinstalled Chromium 145. The same Axe engine was run through the repository's
pinned Playwright integration instead.

## Evidence

- `.factory/review-2.md`
- `.factory/evidence/review-2-cold-mobile.png`
- `.factory/evidence/review-2-cold-desktop.png`
- `.factory/evidence/review-2-demo-mobile.png`
- `.factory/evidence/review-2-demo-desktop.png`
- `.factory/evidence/review-2-404-mobile.png`

## Workspace note

Pre-existing modified `graphify-out/` files were preserved and excluded from
the review commit.
