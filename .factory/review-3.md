# Review 3 — Reverse wrong agent changes

**Verdict: PASS — 0 findings and 0 untested claims.**

This is a fresh strict review for **M1 acceptance**. It does not accept the
venture plan's later M2 billing-lifecycle or exact source-to-packaged-release
gates.

## Scope and identity

- Live URL: <https://agent-change-recovery.sociobot.in>
- Implementation reviewed: `5c8c5c125f799610b0214495e8756f9455b45092`
- Documentation baseline reviewed: `65f78fefa165436003e2949ec9d5fa517f89eab5`
- Published desktop release exercised: `v0.1.12`, target `7dc899da2af1890bbf96ebe1373794940bbe42ed`
- Review date: 6 September 2026 UTC

The commits after `5c8c5c1` change factory plans, reports, evidence, and Graphify
output only. A clean build produced `/assets/index-DI-lo-9r.js` at 43,752 bytes
with SHA-256
`71fc16f5cf14e005d464bbd45d527e1b5d669ea5ec38c2bda0f9502f5663650a`.
The live file had the same name, bytes, and digest. The complete local and live
`index.html` files also matched byte for byte.

The v0.1.12 desktop tag predates the final web history-state change and later
test hardening. Exact current-source-to-packaged-release parity is an explicit
M2 gate in `.factory/plan.md`; it is not presented as an M1 result here.

## First read before scrolling

Fresh 1440×900 desktop and 390×844 phone contexts opened production with no
stored state.

| Question | Answer visible on the first screen |
| --- | --- |
| Job | **Reverse the wrong agent changes** |
| Audience | Developers supervising long agent sessions who need to recover one change without discarding the rest. |
| First action | **Try it with sample data.** The adjacent text says a loaded ledger opens next and nothing is saved to the visitor's data. |

The first-screen facts also state local encryption, offline demo use after one
visit, and the published $15 monthly Pro price. All text fit in both viewports;
the measured phone facts ended at 723 px in an 844 px viewport. Neither viewport
had horizontal overflow or console errors.

## One-click sample and recovery

One click opened `/?demo=1`. The page immediately showed four ACME-WEB
checkpoints, four changed files, a failed check, recorded intent, commands,
diffs, and recovery controls. The persistent label read **Demo — sample data,
nothing is saved**, with **Reset demo** and **Start for real**.

I reversed only `src/auth/session.ts`. The confirmation stated that a safety
checkpoint would be created and other files would stay unchanged. The result
reported one reversed file, added a fifth safety checkpoint, and marked only
that file restored. Reset returned the sample to four checkpoints. A seeded
`real:review-3-sentinel` value survived recovery, reset, and exit. Reset and
exit removed every `demo:` key. Exit opened `/app`, removed the demo label, and
showed the desktop download action.

Normal, invalid, and recovery paths passed:

- With no selected files, **Reverse files** and **Export selected patch** were
  disabled.
- Escape closed the confirmation, and focus returned to the reverse trigger.
- The dialog began on **Keep files** and trapped focus.
- Patch export contained only selected text files, was accepted by GNU
  `patch --dry-run`, and did not run the patch.
- Native tests rejected paths and replaced-parent symlinks outside the chosen
  folder, skipped generated and oversized files, rejected binary patch export,
  handled missing final newlines, rejected a wrong passphrase, and preserved
  unrelated project files.

## Fresh installed desktop proof

The live Linux installer ran with a new `XDG_BIN_HOME`. It downloaded the
v0.1.12 AppImage, verified its published SHA-256, installed an executable, and
printed its location. The installed file was 82,987,512 bytes with SHA-256
`7e3754a9e0542b21c77812c1317033d45004e186aaa2c45d7668f5bb2d03f1d5`.
It stayed open for the 12-second AppImage smoke with no incompatible host
library or module error.

I then launched that installed AppImage with a new consumer data directory,
opened the desktop ledger, entered a local ledger passphrase, and chose **Load
sample project**. The real packaged app created its isolated sample and two
encrypted checkpoints. I selected only `src/auth/session.ts`, confirmed the
reversal, and observed a third **Safety checkpoint before reversal**. The
selected file returned to its baseline `renewOnce()` content. The profile,
refresh-queue, and autosave files kept their changed contents. The ledger on
disk contained encrypted `manifest.enc`, `snapshot.enc`, `settings.enc`, and
`key-check.enc` files. No credential or real project was used.

The release proof also downloaded macOS, Windows, and Linux artifacts and
matched them against `SHA256SUMS` and `latest.json`. The published Windows
consumer proof showed one start after a valid checksum, no start after a forced
mismatch, and a successful installed-app launch.

## Claims and clean-checkout commands

The clean clone was `65f78fefa165436003e2949ec9d5fa517f89eab5`. `npm ci`
installed the locked dependencies with zero audit vulnerabilities. The base
image initially lacked Tauri's native headers, so I installed the Linux
packages declared in `.github/workflows/quality.yml` before counting native
results.

`npm run test:claim-tags` verified 33 claims with exactly one matching tag
each. `npm run test:claims` then ran all 33 exact commands separately. Every
command passed:

| Claim group | Passed claim IDs |
| --- | --- |
| Recovery and sample | `selective-reversal`, `patch-export`, `demo-isolation`, `one-click-demo`, `offline-reload`, `reversible-safety-checkpoint`, `bundled-sample-project` |
| Local data and boundaries | `local-privacy`, `local-encryption`, `chosen-folder-only`, `large-file-skip`, `git-metadata-exclusion`, `generated-folder-exclusions`, `ledger-deletion` |
| Records and retention | `checkpoint-record`, `checkpoint-comparison`, `current-folder-comparison`, `retention-settings-encryption`, `retention-policy`, `retention-tiers` |
| Current Pro behavior | `pro-license`, `pro-price`, `license-daily-verification`, `team-policy-note`, `encrypted-recovery-export`, `encrypted-recovery-import` |
| Release and installers | `platform-download`, `release-candidate-identity`, `release-request-privacy`, `linux-installer`, `windows-installer`, `macos-installer`, `release-platforms` |

I compared the live landing page, demo, privacy and terms pages, README, and
installer copy with the ledger. No missing, false, incomplete, or untested
public claim remained.

## Build and quality results

| Check | Result |
| --- | --- |
| `npm run test:claim-tags` | PASS — 33/33 exact tags |
| `npm run test:claims` | PASS — all 33 exact commands |
| `npm test -- --reporter=line` | PASS — 39/39 browser tests |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS — 23/23 Rust tests |
| `scripts/test-native-privacy.sh` | PASS — capture completed with zero network syscalls |
| `npm run build` | PASS — `dist/site` created |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --bins -- -D warnings` | PASS for shipped Rust targets |
| `npm audit --audit-level=high` | PASS — zero vulnerabilities |
| `npm run verify:paid-checkout` | PASS — published $15.00 USD listing and hosted checkout HTTP 303 |
| `scripts/verify-url.sh https://agent-change-recovery.sociobot.in` | PASS |
| `node scripts/verify-published-release.mjs` | PASS — v0.1.12 platform artifacts, checksums, and manifest |
| `node scripts/verify-windows-consumer-proof.mjs` | PASS |
| Fresh Linux install and packaged-app recovery | PASS |

The production bundle contains 43.75 KB raw / 13.76 KB gzip JavaScript and
15.78 KB raw / 4.37 KB gzip CSS. The mobile hero is 41.13 KB. A fresh mobile
Lighthouse run scored 99 performance and 100 for accessibility, best
practices, and SEO. LCP was 2,178 ms, total blocking time 15 ms, and CLS 0.

An additional, undeclared all-target Clippy diagnostic reports the current
Rust 1.98 `clippy::drop_non_drop` lint in one test helper. The repository does
not declare all-target Clippy in README or CI, the shipped-target Clippy run is
clean, and every required test and build passes. This test-only toolchain lint
is not an M1 product or claim finding. If all-target Clippy becomes a declared
gate, remove the redundant `drop(crypto)` or pin the toolchain first.

## Live routes, access, privacy, and offline use

- `/`, `/demo`, `/app`, `/privacy`, and `/terms` returned 200 with route-specific
  titles, `lang=en`, one H1, one main landmark, shared navigation, and no
  console or page errors.
- `/missing-sheet` deliberately returned HTTP 404 and rendered the designed
  shared header, footer, metadata, H1, main landmark, and return-home action.
  The expected document 404 is not a defect.
- Every internal link returned 200. The GitHub release page and Param Factory
  link returned 200, the AppImage link returned its expected 302, and checkout
  returned its expected 303. The two `mailto:` links were explicit.
- Fresh phone and desktop Axe runs found no serious or critical issue. The full
  browser suite found no Axe violation on any route, including the 404.
- Keyboard checks passed for the visible 224×44 skip link, its 4 px focus ring,
  Enter-to-main behavior, menu activation, checkboxes, dialog focus trapping,
  Escape, and trigger focus restoration. All measured mobile controls were at
  least 44 px.
- Reduced motion produced `0.00001s` transitions and automatic scroll behavior.
- The service worker was active and controlling cache `recovery-ledger-v10`.
  After one visit, an offline demo reload retained the ledger, label, and
  offline notice. Its update path also passed the full suite.
- The full demo recovery/export flow requested only the product origin. The
  landing page additionally requested only the disclosed GitHub Release API
  and Sociobot product API. There was no analytics, external font/script,
  Azure endpoint, or unrelated request.
- Production sends HSTS, `nosniff`, strict-origin referrer policy, restrictive
  permissions policy, and a CSP with `frame-ancestors 'none'` in the response
  header. Hashed assets are immutable; HTML revalidates and `sw.js` is
  `no-cache`.

## Earlier findings

I reviewed `.factory/review-1.md`, `.factory/review-2.md`, every prior
`.factory/verification*.md`, and both polish reports. Fresh evidence confirms
the following disposition.

| Earlier finding set | Current disposition |
| --- | --- |
| Review 1 F-1-1 through F-1-44 | Closed. History/focus, demo exit, real download, native sample, checkout visibility, privacy tracing, phone first screen, 404/metadata, plain copy, claim coverage, terminology, comparison, retention, installers, and deletion all passed current checks. |
| Review 2 F-2-1 through F-2-16 | Closed. Native egress and encryption checks, shared 404, copy audit, real current-folder comparison, claim tags, artifact verification, Windows execution, Mac labels/architecture, and one-click sample proof all passed. Unsupported merchant and signing assertions remain absent. |
| Invalid/malformed patch and missing-final-newline findings | Closed. Native export passed GNU dry-run, missing-newline coverage, binary rejection, and non-execution checks. |
| CSP, console, caching, static-file, 404, mobile overflow, focus, touch-target, and offline findings | Closed by fresh live route, header, Axe, keyboard, 390 px, service-worker, offline, and Lighthouse evidence. |
| Unsafe symlink/path reversal and non-reversible safety-checkpoint findings | Closed by native boundary tests and by the fresh packaged-app selected reversal with its safety record. |
| Plaintext ledger, retention, deletion, and unusable encrypted-recovery findings | Closed by the current encrypted storage, retention-boundary, deletion, export, import, wrong-passphrase, and reopen tests. |
| Broken/stale checkout and installed-app CORS findings | Closed for current M1 promises. The catalog lists $15, checkout redirects, and the packaged path uses native requests with fixture-backed entitlement tests. A real issued-license lifecycle remains an explicit M2 gate. |
| Stale/missing releases, Linux installer, AppImage host-library, Windows consumer, Mac selection, and build-identity findings | Closed for M1. v0.1.12 artifacts and checksums passed, the clean Linux install and full sample reversal passed, Windows proof passed, and live release selection was correct. Exact current-source package parity remains M2. |
| Missing claim entries, mismatched tags, numeric price/retention, encryption wording, and plain-language findings | Closed. The 33-entry ledger has one exact tag per claim, all commands passed, and the current copy audit has no length or banned-word flag. |

No prior defect reopened.

## Milestone and external dependencies

The current controller stage is **M1 acceptance**. The local recovery core,
one-click sandbox, public site, and installable M1 desktop release pass.

| External dependency | Current evidence and boundary |
| --- | --- |
| GitHub Releases/API | v0.1.12 metadata and macOS, Windows, and Linux files were downloaded and checksum-verified. GitHub receives no project data. |
| Sociobot catalog and checkout | The public catalog lists $15.00 USD and checkout returns HTTP 303. No payment was created. |
| Sociobot license verification | Fixture-backed browser/native behavior passes. A controlled issued-license, daily-cache, expiry/revocation lifecycle in the packaged app is a separate M2 acceptance gate. |
| Platform signing | macOS notarization and Windows Authenticode require operator certificates. The product does not claim signed packages. |

There is no product backend, account service, hosted tenant data, health
endpoint, or server-side product state in M1. Tenant isolation, server restart
persistence, and product-backend 429 checks are therefore not applicable. The
desktop state is local and encrypted. No shared PostgreSQL or other product
service was accessed.

## Findings by severity

- Critical: none.
- High: none.
- Medium: none.
- Low: none.
- Untested public claims: none.

**Final verdict: PASS — 0 findings and 0 untested claims.**
