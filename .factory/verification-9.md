# Independent product verification 9 — FAIL

Verified 29 August 2026 (UTC).

- Candidate: `97eb3eed0b7df4bc38010f515f5b0bf451bae4bf`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Artifact: Tauri 2 desktop app, static landing page, and browser demo/PWA
- Decision: **FAIL — do not release or promote this candidate**
- Product code was not modified during verification.

The core recovery product works and its local/live quality gates are green. Release acceptance still fails because the advertised Sociobot checkout is unavailable and the live macOS download selector gives Intel users the ARM64 build.

## Required first checks

### Claims gate

`.factory/claims.json` exists with 28 entries. Every listed command was invoked individually before other product inspection.

The literal first invocation from the unprovisioned clone did not reach assertions: 11 Playwright commands could not import `@playwright/test`, and 17 Rust commands could not compile without GLib/WebKit development libraries. After `npm ci` and the Linux prerequisites declared by the repository release workflow were installed, every exact command was rerun and passed: **28/28 claims, 0 assertion failures**.

- Browser claims, 11/11: selective reversal, demo isolation, offline reload, Pro restore, daily license verification, platform download, release-request privacy, Linux installer, Windows installer, unsigned macOS, and cross-platform release contracts.
- Native claims, 17/17: standard patch export and dry-run, local privacy/encryption, encrypted retention, retention boundary recovery, policy note encryption, encrypted export/import, chosen-folder/symlink boundary, large-file and generated-folder exclusions, checkpoint records/comparison, reversible safety checkpoint, ledger deletion, and bundled sample isolation.

The live checkout failure below is not exercised by `@claim:pro-license`; that test mocks verification and checks only the configured checkout URL.

### Cold first-read gate

**PASS.** A fresh 1440×1000 visit says:

- What it does: **“Reverse the wrong agent changes.”**
- For whom: developers supervising long agent sessions who need to recover one change without discarding the rest.
- What to click: **“Try it with sample data.”** The adjacent copy says a loaded ledger opens and nothing is saved to the visitor's data.
- Three facts: local encryption, offline demo behavior, and `$15 per developer each month`.

The action opens the populated demo in one click with a persistent **“Demo — sample data, nothing is saved”** banner, **Reset demo**, and **Start for real**.

## Release-blocking findings

### P1 — advertised Pro checkout returns HTTP 404

Fresh requests to both configured billing environments failed:

```text
GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout
HTTP 404
{"error":"enabled factory product","status":404}

GET https://pilot-api.sociobot.in/api/v1/products/agent-change-recovery/checkout
HTTP 404
{"error":"enabled factory product","status":404}
```

The first screen and pricing section advertise `$15 per developer each month`, and the visible **Subscribe to Pro** action points to the dead production URL. A visitor cannot purchase the advertised plan. This is fresh evidence, not a carried-forward deployment report.

### P1 — Intel macOS visitors receive the ARM64 installer

With the live GitHub release API and an Intel Mac user agent (`Macintosh; Intel Mac OS X`), the primary button resolved to:

```text
https://github.com/B-Divyesh/sf-agent-change-recovery/releases/download/v0.1.6/Change.Recovery.Ledger_0.1.6_aarch64.dmg
```

The release also contains `Change.Recovery.Ledger_0.1.6_x64.dmg`, but the page matches only the `.dmg` suffix and takes the first asset. Intel Macs cannot run the selected ARM64 build. The declared `@claim:platform-download` fixture uses a single generic macOS asset, so it does not cover this architecture boundary.

## Other finding

### P2 — focused skip link is 42px high

At 390×844, keyboard focus reveals **Skip to main content** at 224×42 CSS pixels. Its 4px process-blue focus outline is visible and Enter correctly focuses `#main`, but the height misses the required 44px interactive-target baseline by 2px. All other visible mobile links/buttons/inputs/summaries measured at least 44px in the same scan.

## End-to-end behavior

### Live browser demo

- Loaded four realistic checkpoints without setup.
- Selected two of four files; confirmation named the operation, promised unrelated files would stay unchanged, and created a safety checkpoint.
- Exported `recovery-cp-3.patch`; with exact old-file fixtures, GNU `patch --batch --dry-run -p1` accepted both selected files. No patch was executed by the app.
- Confirming reversal reported `2 files were reversed` and retained the rest.
- Zero selected files disabled both Reverse and Export. Select-all offered a four-file operation, and cancelling preserved the selection.
- Reset removed all `demo:` keys and preserved an unrelated `real:sentinel` key.
- An empty license field produced native required-field feedback. An invalid token remained on the free plan and displayed a clear recovery message.

### Published desktop app

- The live Linux installer was run with a fresh temporary `XDG_BIN_HOME`. It downloaded the 80 MB v0.1.6 AppImage, verified its published SHA-256, installed an executable `change-recovery-ledger`, and the app remained running through a 15-second smoke timeout under Xvfb.
- The actual AppImage opened its desktop-ready `/app` view. With a 21-character passphrase, **Load sample project** created the bundled local sample and encrypted ledger.
- In the native UI, two of four files were selected and reversed. A new **Safety checkpoint before reversal** contained exactly those two files. Inspection of the sample project confirmed `profile.ts` and `session.ts` were restored while `refresh-queue.ts` and `autosave.ts` retained their changed content.
- The test passphrase was absent from every file under the app's local data directory. Ledger manifests, snapshots, settings, and key check were stored as `.enc` files.
- Native tests also exercised missing-final-newline patches, binary rejection, wrong recovery passphrases, a 2 MB-plus file, retention pruning and boundary recovery, ledger deletion, and replacement-parent symlink rejection.

## Accessibility, responsive behavior, and PWA

- Live Axe scans on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and the styled 404 found **0 serious/critical violations**.
- Each route has one `main`, one `h1`, an appropriate route title, `lang=en`, and no image missing `alt`.
- Valid routes produced no console errors or uncaught page errors. `/missing-sheet` returned a real HTTP 404 and rendered the styled recovery page.
- At 390px, both landing and demo had `scrollWidth === 390`; the first action and all three first-screen facts were in the initial 844px viewport.
- At simulated 200% root text size, all five product routes remained 390px wide with their headings and actions present.
- The reversal dialog initially focused **Keep files**, wrapped Shift+Tab to the confirm action, closed with Escape, and restored focus to the trigger.
- `prefers-reduced-motion: reduce` produced no running animations, instant transitions, and auto scrolling.
- Service worker `recovery-ledger-v6` was activated, updated, controlled the page, and kept `/demo` usable on an offline reload with the offline notice.

## Privacy, requests, headers, and request limits

- The complete direct demo export/reversal flow requested only `https://agent-change-recovery.sociobot.in`.
- The landing page additionally requested only the disclosed GitHub public-release API. Invalid license restoration additionally requested only the documented Sociobot verification endpoint. No analytics, CDN fonts/scripts, Azure OpenAI endpoint, or unrelated origin was observed.
- Responses include HSTS, `nosniff`, strict-origin referrer policy, restrictive permissions policy, and a CSP whose `frame-ancestors 'none'` is correctly delivered as a header.
- Hashed JS/CSS/images use `Cache-Control: public, max-age=31536000, immutable`; `sw.js` uses `no-cache`; HTML revalidates after 30 seconds.
- The license verification endpoint allowed **30 requests per client/window**. Request 31 returned HTTP 429 with `Retry-After: 3` and `X-RateLimit-After: 3`.
- There is no sign-in flow, so Microsoft Entra authority validation is not applicable.

## Build and test gates

| Gate | Result |
| --- | --- |
| `npm ci` | PASS; 28 packages, 0 audit vulnerabilities |
| Every `.factory/claims.json` command after install | PASS; 28/28 |
| `npm test` | PASS; 32/32 Playwright tests |
| `npm run build` | PASS; TypeScript and Vite, output in `dist/site` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS; 21/21 native tests |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| `CI=true npm run tauri -- build` with declared Linux prerequisites | PASS; `.deb`, `.rpm`, AppImage |
| `bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in` | PASS |

The bare environment exports `CI=1`, which Tauri rejects because it accepts only `true|false`. With `CI=true`, the first packaging attempt built the binary, Debian package, and RPM but lacked the workflow's `file`/`libfuse2` prerequisites for `linuxdeploy`. After installing the exact declared release prerequisites and clearing only generated AppImage staging, the full command passed. The previous AppImage issue is therefore not reproduced as a product defect in the correctly provisioned build.

Static budgets pass: JavaScript 40.20 KB raw / 12.72 KB gzip; CSS 15.58 KB raw / 4.32 KB gzip; no downloaded fonts; mobile hero 41.13 KB. Fresh mobile Lighthouse: performance 100, accessibility 100, best practices 100, SEO 100; FCP 933 ms, LCP 1,354 ms, TBT 32 ms, CLS 0.

## Deployment and release identity

- Fresh `dist/site` bytes exactly match the live deployment for `index.html`, hashed JS/CSS, service worker, manifest, robots, sitemap, 404 files, installers, hero/social art, and walkthrough images. Live JS SHA-256: `7a0908668feaacfcde5bca84480bb1370cccce5d33e8529a2a9cf9fe70d67698`.
- Candidate `97eb3ee` differs from release tag `v0.1.6` only in `.factory/handoff.md` and generated `graphify-out` metadata; no product source differs. The live deployed product therefore matches the candidate product code.
- GitHub quality run `33275403102` for the exact candidate completed successfully. Release run `33274870954` for v0.1.6 completed successfully.
- Release v0.1.6 contains macOS ARM/x64, Windows MSI/EXE, Linux DEB/RPM/AppImage, `SHA256SUMS`, and valid `latest.json` metadata.
- Freshly downloaded Debian package SHA-256 `6f63692ca6a9917c40aea040b73c9b55f011cacb914039d0721d36b791d76eaf` exactly matches `SHA256SUMS`; package metadata is version 0.1.6 and contains executable `/usr/bin/change-recovery-ledger`.

## Required remediation

1. Register/enable `agent-change-recovery` in the production Sociobot billing engine and verify the visible checkout reaches the hosted subscription flow.
2. Do not choose a macOS architecture by first `.dmg` match. Offer both ARM64 and Intel downloads, or use a reliable architecture choice with an explicit fallback.
3. Increase the focused skip-link target height to at least 44px and add it to the mobile target test.
