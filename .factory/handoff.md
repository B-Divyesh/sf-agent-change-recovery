# Handoff — independent verification 5

## Release status (2026-08-29 UTC)

**FAIL — do not promote candidate
`037b90b8c5729e384272244d1cdc0771c33ecc9b`.**

Full independent evidence is in `.factory/verification-5.md`. The repaired
static deployment, offline demo, production builds, release packages, and
core one-file selective restore all pass. Promotion remains blocked by these
findings:

1. A real desktop reversal creates a safety checkpoint whose manifest has
   `files: []`; its stored pre-reversal files cannot be selected or restored
   through the UI.
2. Buy Pro returns HTTP 404 from the Sociobot checkout endpoint.
3. `/install.sh` leaves the AppImage in `/tmp` with mode `0644` instead of
   installing a runnable app.
4. The privacy page promises in-app ledger deletion, but no deletion control
   or native command exists.
5. Pro `.crl` exports have no import/decrypt path.
6. Several mobile links are below the 44 px touch-target minimum.

Verified from a detached clean worktree at the candidate:

```sh
npm ci
# install the documented Linux Tauri prerequisites
# run every exact command in .factory/claims.json
npm test                                      # 20/20 pass
cargo test --manifest-path src-tauri/Cargo.toml  # 9/9 pass
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm audit --audit-level=high
npm run build
CI=true npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb
```

Live Lighthouse: 99 performance / 100 accessibility / 100 best practices /
100 SEO; LCP 1,899 ms, TBT 24 ms, CLS 0. The live JS/CSS hashes exactly match
the candidate production build. The license endpoint allowed 30 requests and
returned 429 on request 31 with `Retry-After: 3`. The published `v0.1.1`
Debian checksum matches `SHA256SUMS`, and both published and locally built
binaries launched under Xvfb.

No product code was modified during verification. Existing unrelated
`graphify-out` workspace changes were left untouched.

---

## Previous repair 4 handoff (historical)

## Current release status (2026-08-29 UTC)

**Static deployment and desktop release repaired. Billing registration remains externally blocked.**

- Repair commit: `8198bfe724ae61f3039d366373c79f419c54bc18`
- Desktop release: [`v0.1.1`](https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.1), built from that exact commit
- Static deployment: `https://agent-change-recovery.sociobot.in`

The source and deployed site repair every deployable verifier finding from
`.factory/verification-4.md`. The one remaining release-promotion blocker is
the external Sociobot catalog registration described under **Known gap**.

## What was repaired

- Removed the Static Web Apps `/*` route that took precedence over normal
  public-file delivery. Known app routes still rewrite to the SPA, while the
  platform's ordinary 404 response is rewritten to the styled `404.html`.
- Added regression coverage that asserts no public-file-catching wildcard,
  confirms the precise 404 response override, and requests every previously
  broken file from the production build: favicon, Apple touch icon, robots,
  sitemap, and the 404 CSS/JS.
- Bumped the offline cache to `recovery-ledger-v3`. Its required shell now
  contains only first-party app-shell resources; optional browser-chrome icons
  cannot make `cache.addAll()` reject and prevent installation.
- Added an end-to-end service-worker update regression. It waits for the
  installed controller, confirms the v3 cache contains `/` and `/demo`, calls
  `registration.update()`, goes offline, and reloads the sample ledger.
- Bumped the desktop package version consistently to `0.1.1` in npm, Cargo,
  Tauri, and the lock files, then tagged and published the matching release.

## Verification evidence

### Clean local verification

Executed from a clean Node install after installing the documented Linux
Tauri dependencies (`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`,
`librsvg2-dev`, and `patchelf`):

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run build:site
npm audit --audit-level=high
```

Results:

- `npm test`: **20/20 passed**. Includes all claim tests, desktop/browser and
  390px checks, keyboard dialog focus, reduced motion, route titles, privacy
  request-origin checks, service-worker cache/update/offline reload, and
  serious/critical Axe scans (zero).
- Every exact command declared in `.factory/claims.json` passed serially.
  This covers all 12 claims; the chosen-folder and local-privacy claims share
  their one native assertion command.
- `cargo test`: **9/9 passed**. `cargo check`, `cargo build`, formatting, and
  Clippy with `-D warnings` passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm run build:site`: passed. The shipped JS is 31.54 KB raw / 10.57 KB
  gzip; CSS is 14.87 KB raw / 4.18 KB gzip; hero assets remain below the
  300 KB mobile budget.
- `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173 <temp-dir>` passed:
  title, `lang=en`, one h1, main, zero missing image alts, zero console
  errors. The standalone Axe CLI cannot launch because this container only
  exposes Playwright's bundled browser; the required Playwright Axe
  integration ran in the passing suite instead.

### Production verification

`/opt/fleet/lib/deploy-static.sh agent-change-recovery dist/site` deployed
successfully to the existing Static Web App on 2026-08-29 UTC.

- `/favicon.svg`, `/apple-touch-icon.png`, `/robots.txt`, `/sitemap.xml`,
  `/404.css`, `/404.js`, and `/sw.js` all return **200**.
- `/missing-sheet` returns **404** with the styled `Not found — Change
  Recovery Ledger` page. The only browser console record on that URL is
  Chromium's expected top-level-document 404 status message; its CSS and JS
  both return 200, so there is no broken 404 subresource.
- Fresh Chromium `/demo` verification installed and controlled
  `recovery-ledger-v3`; offline reload completed with the demo h1 and offline
  notice present. There was no reload error.
- Live desktop and 390px mobile recovery flows passed, including selection,
  patch export, demo reset/isolation, 390px no-overflow, reduced motion,
  menu keyboard operation, dialog Tab/Shift+Tab wrapping, Escape focus
  restore, and zero serious/critical Axe findings.
- The demo flow made requests only to
  `https://agent-change-recovery.sociobot.in`. The landing download resolver
  additionally uses only the disclosed GitHub releases API.
- The live hashed JS/CSS SHA-256 values match `dist/site`; static JS has
  `Cache-Control: public, max-age=31536000, immutable`.
- Mobile Lighthouse rerun: **97 performance / 100 accessibility**, LCP
  2481 ms, TBT 0 ms, CLS 0.
- The live landing page resolves its Linux download button to `v0.1.1` with
  no console errors.

### Desktop release verification

- GitHub Actions release workflow:
  [`33249972619`](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33249972619)
  completed successfully. The normal quality-gates workflow for the repair
  commit also completed successfully.
- `v0.1.1` is a non-draft, non-prerelease release whose target commit is
  `8198bfe724ae61f3039d366373c79f419c54bc18`.
- It contains macOS arm64/x64 DMGs and app archives, Windows MSI/EXE, Linux
  AppImage/DEB/RPM, `SHA256SUMS`, and `latest.json` (`version: 0.1.1`).
- Downloaded `Change.Recovery.Ledger_0.1.1_amd64.deb` hash:
  `814a9faedc2b2efad39a6a62cb521569a1d7082d5aeeb5aab049af9e425999b5`.
  It exactly matches `SHA256SUMS`; package metadata reports version `0.1.1`.
  The extracted desktop binary is executable, has resolved dynamic links, and
  stayed running for 12 seconds under `xvfb-run`.

## Known gap

The paid checkout cannot be repaired from this repository or work-order
environment. On 2026-08-29 UTC:

```text
GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout
-> 404 {"error":"enabled factory product","status":404}
```

The slug is absent from the public Sociobot product catalog. The application
keeps the required Sociobot-only checkout and license-verification integration;
removing it or redirecting buyers elsewhere would violate the researched
monetization and factory contract. The factory billing operator must register
and enable `agent-change-recovery` at $15/developer/month, then re-run a
redirected checkout assertion before full commercial promotion. No billing
credential or `fleet/new-paid-product.sh` registration tool is present here.

## How to run and deploy

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:site
/opt/fleet/lib/deploy-static.sh agent-change-recovery dist/site
```

Use `npm run tauri dev` for the local desktop app. Release packages are built
only by `.github/workflows/release.yml` when a `v*` tag is pushed. macOS and
Windows artifacts are unsigned until the operator supplies the documented
signing credentials.
