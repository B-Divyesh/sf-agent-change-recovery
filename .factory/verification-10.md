# Independent product verification 10 — FAIL

Verified 29 August 2026 (UTC).

- Candidate: `e3449421e29444260713c32f31f0ab72e1994f10`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Artifact: Tauri 2 desktop app, static landing page, and browser demo/PWA
- Decision: **FAIL — do not release or promote this candidate**
- Product code was not modified during verification.

The recovery workflow, privacy model, accessibility, build, and live static site pass. Acceptance still fails because there is no v0.1.7 desktop release for the candidate, while the v0.1.7 live site installs v0.1.6. Production billing is also still unavailable.

## Required first checks

### Claims gate

`.factory/claims.json` exists with 28 entries. Every listed command was invoked individually before product inspection.

The literal first invocation from the unprovisioned clone could not load Playwright or compile Tauri because dependencies were not installed. After `npm ci` and the Linux packages declared by the repository's own release workflow were installed, all 28 exact commands were rerun individually: **28 passed, 0 failed**.

- Browser claims, 11/11: selective reversal, demo isolation, offline reload, Pro restore, daily license verification, platform selection, release-request privacy, Linux and Windows installers, unsigned macOS, and cross-platform release workflow.
- Native claims, 17/17: patch export/dry-run, local privacy/encryption, encrypted retention, retention recovery, policy-note encryption, encrypted recovery export/import, folder and symlink boundaries, file/folder exclusions, checkpoint records/comparison, reversible safety checkpoint, ledger deletion, and bundled sample isolation.

The declared release tests inspect fixtures and mocked GitHub data. They do not prove that the candidate tag and binaries were actually published. The absent candidate release below is therefore not contradicted by the green claims suite.

### Cold first-read gate

**PASS.** A fresh 1440×900 visit answers all three required questions in the first screen:

- What it does: **“Reverse the wrong agent changes.”**
- For whom: developers supervising long agent sessions who need to recover one change without discarding the rest.
- What to click: **“Try it with sample data.”** Adjacent copy says a loaded ledger opens and nothing is saved to the visitor's data.

The first screen also gives three plain facts: local encryption, offline demo use, and the honest current state that Pro purchase is unavailable. The action opens a populated ledger in one click with a persistent **“Demo — sample data, nothing is saved”** banner, **Reset demo**, and **Start for real**.

## Release-blocking findings

### P1 — candidate v0.1.7 has no published desktop release

The candidate identifies itself as v0.1.7, but no `v0.1.7` Git tag or GitHub release exists. The latest public release and successful release workflow are still v0.1.6:

```text
candidate                 e3449421e29444260713c32f31f0ab72e1994f10
candidate footer          v0.1.7 · build 2026.08.29
latest GitHub tag/release v0.1.6
latest release run        33274870954, success, head e86c6f1…
candidate release run     none
```

The live v0.1.7 page's **Download for Linux** action therefore links to `Change.Recovery.Ledger_0.1.6_amd64.AppImage`. This is not a metadata-only difference: product source changed between v0.1.6 and the candidate, including the billing-state repair. The installed public app still says **“Pro costs $15 per developer each month”**, while the candidate site correctly says purchase is unavailable.

The published v0.1.6 AppImage was freshly downloaded, checked against `SHA256SUMS`, installed with the live `install.sh`, and launched under Xvfb. That proves the stale download works; it does not make it the candidate. A desktop-app candidate cannot pass when visitors receive an older binary with older behavior.

### P1 — production Pro purchase remains unavailable

Fresh production evidence:

```text
GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout
HTTP 404
{"error":"enabled factory product","status":404}
```

The product is also absent from the public Sociobot product catalog. Candidate v0.1.7 handles this honestly by hiding the price and purchase action while keeping license restoration, but the researched contract calls for a `$15/developer/month` subscription. The paid tier cannot be purchased.

The stale v0.1.6 desktop release makes the mismatch worse: it still advertises the price even though its checkout is unavailable.

## End-to-end behavior

### Live browser demo

- Loaded four realistic checkpoints without setup.
- Zero selected files disabled **Reverse files**.
- Selected `auth/session.ts` and `editor/autosave.ts` while leaving `account/profile.ts` unselected.
- Exported `recovery-cp-3.patch`; it contained both selected paths and excluded the unrelated path.
- The confirmation named the safety checkpoint and stated that other files stay unchanged.
- Confirming reversal reported **“2 files were reversed. The safety checkpoint is in the ledger.”** Both selected rows changed to restored; the unrelated row did not.
- **Reset demo** returned the sample to its initial state.
- No external request occurred after entering the demo flow.

### Candidate native app

The locally built v0.1.7 AppImage was launched with fresh XDG data directories under Xvfb.

- The first-run screen showed **Capture an agent turn** and **Load sample project**.
- Loading without a passphrase produced a clear recovery message requesting a local ledger passphrase.
- Supplying a passphrase loaded the isolated bundled sample and two checkpoints.
- The passphrase was absent from every runtime file inspected.
- Ledger state was stored as encrypted `manifest.enc`, `snapshot.enc`, `settings.enc`, and `key-check.enc` files.

Native tests additionally covered standard patch dry-run, missing final newlines, binary rejection, wrong passphrases, retention boundaries, a 2 MB-plus file, generated-folder exclusions, deletion without touching project files, and symlink-escape rejection.

## Accessibility, responsive behavior, and PWA

- `bash scripts/verify-url.sh` passed `/`, `/demo`, `/privacy`, and `/terms` for title, language, landmarks, heading, image alternatives, and console checks.
- Live Axe scans on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and the styled 404 found **0 serious or critical violations**.
- Valid routes produced no console errors or uncaught page errors. The missing route returned a real HTTP 404 and a styled recovery page.
- Keyboard focus first reached the 224×44 skip link with a visible 4px outline. Enter moved focus to `main`.
- The reversal dialog initially focused **Keep files**, wrapped focus, closed with Escape, and restored focus to its trigger.
- At 390×844, `scrollWidth` equaled 390; the primary action and all three facts fit in the first viewport. Body copy was 16px and checked controls met the 44px touch baseline.
- With reduced motion requested, animations and transitions resolved to 0.01ms with no meaningful movement.
- Service worker `recovery-ledger-v7` activated and controlled the page. `/demo` reloaded offline with its sample and offline notice, without console errors.

## Privacy, requests, headers, and limits

- The complete demo reversal/export flow requested only the product origin.
- The landing page additionally requested only `api.github.com` for public release metadata and `api.sociobot.in` for the disclosed product-publication check.
- No analytics, third-party scripts/fonts, Azure endpoint, or unrelated origin was observed.
- HTML uses `Cache-Control: public, must-revalidate, max-age=30`; hashed JS/CSS use one-year immutable caching; `sw.js` uses `no-cache`.
- Responses include HSTS, `nosniff`, strict-origin referrer policy, a restrictive permissions policy, and CSP `frame-ancestors 'none'` as a response header.
- The production license endpoint allowed **29 consecutive requests in the observed window**. Request 30 returned HTTP 429 with `Retry-After: 0` and `X-RateLimit-After: 0`. The endpoint therefore enforces a limit and supplies the required header.
- There is no sign-in flow, so Microsoft Entra authority validation is not applicable.

## Build and test gates

| Gate | Result |
| --- | --- |
| Every `.factory/claims.json` command after dependency installation | PASS; 28/28 |
| `npm ci` | PASS; 28 packages |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| `npm test` | PASS; 35/35 Playwright tests |
| `npm run build` | PASS; TypeScript and Vite, output in `dist/site` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 21/21 native tests |
| `CI=true npm run tauri -- build` with declared Linux prerequisites | PASS; `.deb`, `.rpm`, and AppImage v0.1.7 |
| `bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in` | PASS |

The first Tauri packaging attempt lacked host `file`/`libfuse2` support for `linuxdeploy`. After installing the exact prerequisites declared by `.github/workflows/release.yml` and using AppImage's supported extract-and-run mode in this container, the exact production command completed. This was a worker provisioning issue, not a reproduced product defect.

Static budgets pass: JavaScript 42.64 KB raw / 13.51 KB gzip; CSS 15.78 KB raw / 4.36 KB gzip; mobile hero 41.13 KB; no web fonts. Three fresh mobile Lighthouse runs scored performance 96/97/98, accessibility 100, best practices 100, and SEO 100. Median LCP was 2,387ms, TBT 112ms or less per run, and CLS 0.0028.

## Deployment and release identity

Fresh local production files exactly match the live static deployment:

```text
index.html SHA-256  7fd4d14f…
app JS SHA-256      5cf790022e3c…
CSS SHA-256         3be6a3a3…
sw.js SHA-256       c4bdd856d993…
```

Thus the static web deployment matches candidate `e344942`; the deployment-only failure is the missing desktop release, not stale static hosting.

Release v0.1.6 contains all platform assets, `SHA256SUMS`, and valid `latest.json`. The downloaded Linux AppImage was 82,958,840 bytes and matched published SHA-256 `2586b5f1…`. It launched and rendered, although Ubuntu 24 also logged GLib/GIO module symbol warnings from the published bundle. The locally built candidate v0.1.7 AppImage did not emit those application module warnings.

## Required remediation

1. Tag candidate `e3449421e29444260713c32f31f0ab72e1994f10` as v0.1.7, run the release workflow, verify every platform asset and checksum, and confirm the live detected-platform links resolve to v0.1.7.
2. Register and enable `agent-change-recovery` in the production Sociobot billing catalog, then verify the hosted checkout before offering Pro.
3. Smoke-test the published v0.1.7 AppImage on Ubuntu 24 and investigate any GLib/GIO module warnings before promotion.
