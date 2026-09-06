# Verify safe agent-change recovery — verification 13

**Verdict: PASS.** This is an M1 acceptance verification. There are **zero
findings** at every severity and **zero untested public claims** in the current
claim ledger.

## Scope and candidate

- Controller stage reviewed: **M1 acceptance**.
- Implementation reviewed: `5c8c5c125f799610b0214495e8756f9455b45092`.
  This is the last commit that changed product source or verification code.
- Final-polish documentation commit: `e30ed37`.
- Documentation/plan commit in the clean checkout: `9caa92aea786676dbd50a7c930cdd0e923621010`.
- Live URL: <https://agent-change-recovery.sociobot.in>.

The production JavaScript served as `index-DI-lo-9r.js` has SHA-256
`71fc16f5cf14e005d464bbd45d527e1b5d669ea5ec38c2bda0f9502f5663650a`.
A fresh production build from the clean checkout produced the same named file
with the same digest. The live static product therefore matches the reviewed
implementation. The pre-existing modified `graphify-out/` files were not
changed or included.

The old post-deploy wrapper artifact,
`.factory/evidence/verification-6-verify-url/verify.json`, is not a product
failure. It records a 889 ms load, no errors, a title, `lang=en`, one H1, one
main landmark, and no missing image alternatives.

## First read and demo

Fresh desktop (1440×900) and phone (390×844) contexts opened the live landing
page before any scrolling.

| Required question | Live answer |
| --- | --- |
| Job | “Reverse the wrong agent changes” |
| Audience | Developers supervising long agent sessions who need to recover one change without discarding the rest. |
| First action | “Try it with sample data.” The adjacent result says that a loaded ledger opens and nothing is saved to the visitor’s data. |

Both viewports had no console errors or horizontal overflow. The first screen
also showed the three concrete facts: local encryption, offline demo after one
visit, and the published Pro price.

`/?demo=1` opened directly into a populated four-checkpoint ACME-WEB sample
with the persistent “Demo — sample data, nothing is saved” label. I selected
`src/auth/session.ts`, confirmed the safety checkpoint, and observed the new
safety record plus `src/auth/session.ts — restored`; the other sample files
remained available. Reset returned the sample to its initial state. A
pre-seeded `real:verify-13` local-storage sentinel remained unchanged through
recovery and reset. **Start for real** moved to `/app`, removed all `demo:`
keys, and removed the demo label while preserving that sentinel. This verifies
the sample does not change real browser data.

The complete browser suite also covers invalid and boundary paths: no selected
files disables recovery/export, dialog cancellation preserves selection,
keyboard focus remains trapped in the confirmation dialog and returns to its
trigger, and the browser preview does not impersonate desktop folder access.

## Live quality checks

- Routes `/`, `/demo`, `/app`, `/privacy`, and `/terms` returned HTTP 200 with
  their own title, exactly one H1, exactly one main landmark, and no console
  errors. All discovered site links were reachable; the checkout deliberately
  returned HTTP 303 and the downloadable AppImage deliberately returned a
  redirect.
- `/missing-verification-13` returned the expected HTTP 404 and rendered the
  designed shared-header/footer page with “Not found — Change Recovery Ledger”,
  one H1, and one main landmark. The browser's document-resource 404 message is
  expected for an intentional 404 and is not a defect.
- `scripts/verify-url.sh https://agent-change-recovery.sociobot.in` passed.
- Axe in fresh desktop and phone contexts found no violations, including no
  serious or critical issues, on all six routes above (including the 404).
- Keyboard smoke: Tab exposed the skip link, Enter focused `#main`, and the
  focus outline was `rgb(20, 92, 112) solid 4px`.
- Offline: after a first live visit, an offline reload of `/?demo=1` retained
  the sample, demo label, and offline notice.
- Reduced motion: in a `reducedMotion: 'reduce'` context, the media query
  matched, scroll behavior was `auto`, and no non-reduced transition or
  animation duration remained.
- Live requests stayed on the product origin plus the disclosed GitHub Release
  API and Sociobot product API. There was no analytics, third-party font, or
  script origin. Native capture was separately traced with `strace` and made
  zero network syscalls.

## Clean-checkout claim and artifact evidence

I cloned `main` into a new temporary directory, ran `npm ci`, then installed
the documented Tauri Linux prerequisites before native tests. The initial
native command correctly reported the missing `glib-2.0` system prerequisite;
after installing the documented prerequisite set, no claim command failed.

| Check | Result |
| --- | --- |
| `npm run test:claim-tags` | PASS — 33 claims, exactly one matching tag each |
| Every exact command in `.factory/claims.json` via `npm run test:claims` | PASS — 33/33 |
| `npm test -- --reporter=line` | PASS — 39/39 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — 23/23 |
| `scripts/test-native-privacy.sh` | PASS — zero network syscalls |
| `npm run build` | PASS — `dist/site`; 43.75 KB raw / 13.83 KB gzip JavaScript and 15.78 KB raw / 4.36 KB gzip CSS |
| `npm run verify:paid-checkout` | PASS — published $15.00 USD listing and intentional hosted-checkout HTTP 303 |
| `node scripts/verify-published-release.mjs` | PASS — v0.1.12 macOS, Windows, and Linux artifacts match `SHA256SUMS` and `latest.json` |
| `node scripts/verify-windows-consumer-proof.mjs` | PASS — verified launch starts once; forced checksum mismatch starts zero times; installed app launches |
| Fresh Linux consumer smoke | PASS — downloaded v0.1.12 AppImage matched its published checksum and remained running for 12 seconds under Xvfb without host-library/module errors |

This covers normal recovery, invalid/empty selection, selected-file boundary,
safety-checkpoint recovery, patch non-execution, demo reset/exit, privacy,
offline/update behavior, routes, legal pages, downloads, and desktop artifact
launch. This product has no backend, account service, tenant store, health
endpoint, persistent server, or live rate-limit endpoint. Tenant isolation,
restart persistence, `/health`, and 429/`Retry-After` tests are therefore not
applicable to M1; the local desktop ledger tests cover filesystem boundaries,
encrypted local storage, and safe recovery instead.

## Earlier findings

I reviewed every item in `.factory/review-1.md`, `.factory/review-2.md`, the
earlier verification reports, and `.factory/polish-1.md`/
`.factory/polish-2.md`.

| Finding set | Current disposition and fresh proof |
| --- | --- |
| F-1-1 through F-1-44, including minor findings | **Closed.** The Polish 2 mapping was rechecked. Fresh browser coverage re-proved history/focus, mobile layout, route metadata, shared 404, demo namespace/reset/exit, terminology/copy, selected reversal, current-folder comparison UI, retention, release selection, and installer behavior. Fresh native coverage re-proved chosen-folder boundaries, exclusions, checkpoint comparison/record, encrypted data, deletion, patch export, and bundled sample isolation. |
| F-2-1 and F-2-9 | **Closed.** `scripts/test-native-privacy.sh` now observes process-boundary egress and passed with zero network syscalls; the native encryption test passed with unique content/passphrase storage scanning and reopen checks. |
| F-2-2 through F-2-4 | **Closed.** The live 404 shared structure, copy audit, and the real current-folder native/UI behavior passed. |
| F-2-5 through F-2-8 | **Closed.** Unsupported unsigned/merchant assertions remain absent; published artifact and behavioral Windows installer checks passed. |
| F-2-10 through F-2-16 | **Closed.** Claim tags are exact, one-click sample behavior passed, platform labels/download selection passed, wording remains plain, and the Mac installer claim passed its architecture/checksum fixture. |
| Earlier failed release/deployment checks | **Closed for M1.** The current live static output matches source, v0.1.12 release checksums/manifest passed, Windows consumer proof passed, and a fresh Linux AppImage smoke passed. |

No earlier defect reopened. No public claim was missing from
`.factory/claims.json`, and every declared claim command was run after the
documented setup.

## Current milestone and external dependencies

The controller stage is **M1 acceptance**, and the M1 local recovery core
passes. The venture plan's later M2 work is not represented as accepted here:
it needs an exact current-source-to-desktop-release relationship and a
controlled, real checkout-return/license lifecycle in a packaged app. Those
are future milestone acceptance gates, not M1 defects or untested M1 claims.

| External dependency | Evidence and boundary |
| --- | --- |
| GitHub Releases/API | v0.1.12 release metadata and platform files verified. GitHub is used only to resolve/download desktop releases; it does not receive project data. |
| Sociobot public product/checkout | The live $15 listing and HTTP 303 hosted checkout were verified. This does not prove a purchase, issued license, revocation, or subscription lifecycle. |
| Sociobot license verification | Fixture/native tests cover the device-local behavior. A controlled valid-license proof in a packaged app is an explicit M2 external gate and was not claimed as M1 acceptance. |
| Signing certificates | macOS notarization and Windows Authenticode remain an operator decision. Packages are not claimed signed. |

**Final result: PASS — 0 findings, 0 untested claims.**
