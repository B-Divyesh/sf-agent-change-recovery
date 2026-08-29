# Polish 1 — review finding closure

Candidate repaired from `e473cfab3471e222a1131fa28fabe736ed823a66`. Local and cold-production evidence is recorded below.

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-1-1 | Manual history scroll state restores the route heading at the saved position. | `every route has its own title and history navigation works` |
| F-1-2 | Demo exit removes every `demo:` key before opening `/app`. | `@claim:demo-isolation` |
| F-1-3 | Browser real mode now exposes a release-resolved desktop download action. | `@claim:demo-isolation`, `@claim:platform-download` |
| F-1-4 | Tauri adds isolated **Load sample project** and **Reset sample project** commands. | `@claim:bundled-sample-project` |
| F-1-5 | Removed unavailable checkout, price, merchant, refund, and license copy; this release states no payment is required. | `@claim:no-payment` |
| F-1-6 | Native privacy fixture checks chosen-folder data, outside sentinel, and untouched local listener. | `@claim:local-privacy` |
| F-1-7 | Mobile keeps copy before art and fits action result plus facts in 390×844. | `mobile first screen shows the action result and all three facts` |
| F-1-8 | Static 404 now has the shared header/footer, metadata, icons, and home route. | `route metadata updates title, canonical, Open Graph, and Twitter fields` |
| F-1-9 | Route rendering now updates OG and Twitter metadata. | `route metadata updates title, canonical, Open Graph, and Twitter fields` |
| F-1-10 | Removed the `RECOVERY / 001` label. | `copy-audit.md` |
| F-1-11 | Rewrote hero caption to “Reverse one file / keep the rest.” | `copy-audit.md` |
| F-1-12 | Renamed the preview label “Loaded checkpoint preview.” | `copy-audit.md` |
| F-1-13 | Rewrote the steps heading with the exact task. | `copy-audit.md` |
| F-1-14 | Rewrote walkthrough heading without an undefined quality claim. | `copy-audit.md` |
| F-1-15 | Replaced unexplained “sidecar” wording. | `copy-audit.md` |
| F-1-16 | Renamed preview action “Open sample recovery.” | `copy-audit.md` |
| F-1-17 | Split README encrypted-recovery text; removed inactive paid instructions. | `copy-audit.md` |
| F-1-18 | Rewrote README Linux installation text as short sentences. | `copy-audit.md` |
| F-1-19 | Split README release-workflow text and added workflow claim. | `@claim:release-platforms` |
| F-1-20 | Rewrote README release-request text and added request-log claim. | `@claim:release-request-privacy` |
| F-1-21 | Replaced README “sidecar” terminology. | `copy-audit.md` |
| F-1-22 | Rewrote README demo text as a concrete sample action. | `copy-audit.md` |
| F-1-23 | Replaced reviewer wording with “local sample.” | `copy-audit.md` |
| F-1-24 | Rewrote technical README label and tested all four exclusions. | `@claim:generated-folder-exclusions` |
| F-1-25 | Rewrote static-site wording to explain current release selection. | `@claim:platform-download` |
| F-1-26 | Uses “reverse” for selected rollback and “safety checkpoint” for undo copies. | `copy-audit.md`, `@claim:selective-reversal` |
| F-1-27 | Registered and tested checkpoint request, command, file, and check fields. | `@claim:checkpoint-record` |
| F-1-28 | Registered and tested comparison against the prior snapshot. | `@claim:checkpoint-comparison` |
| F-1-29 | Removed unpublished retention offer and its UI. | `copy-audit.md` |
| F-1-30 | Kept the required unsigned macOS disclosure and tested absent signing configuration. | `@claim:unsigned-macos` |
| F-1-31 | Replaced vague system-warning language with explicit macOS opening instructions. | `copy-audit.md` |
| F-1-32 | Kept platform statement only with a release-workflow assertion. | `@claim:release-platforms` |
| F-1-33 | Removed the unsupported app-data location claim. | `copy-audit.md` |
| F-1-34 | Registered all named generated-folder exclusions together. | `@claim:generated-folder-exclusions` |
| F-1-35 | Added a three-capture prior-snapshot comparison test. | `@claim:checkpoint-comparison` |
| F-1-36 | Added exact Linux, macOS, and Windows asset-selection fixtures. | `@claim:platform-download` |
| F-1-37 | Added installer ordering assertion for checksum before Windows launch. | `@claim:windows-installer` |
| F-1-38 | Removed inactive license-verification request and disclosure. | request log in `@claim:release-request-privacy` |
| F-1-39 | Removed inactive license storage and daily-check copy. | source and `copy-audit.md` |
| F-1-40 | Narrowed disclosed third-party traffic to GitHub and logged it. | `@claim:release-request-privacy` |
| F-1-41 | Changed metadata and copy from “replay” to “export.” | `route metadata updates title, canonical, Open Graph, and Twitter fields` |
| F-1-42 | Removed inactive merchant, checkout, and refund assertions. | `@claim:no-payment` |
| F-1-43 | Kept the release-workflow statement only with a workflow assertion. | `@claim:release-platforms` |
| F-1-44 | Removed the untested README deletion-confirmation statement; the native dialog still names the count. | `claim_ledger_deletion_removes_snapshots_not_project_files` |

## Broader regression coverage

- Browser: `npm test` — 29 passing tests, including Axe scans, keyboard dialog focus, mobile overflow/touch targets, reduced motion, offline reload, routing, metadata, installers, and every browser claim.
- Native: `cargo test --manifest-path src-tauri/Cargo.toml` — 16 passing tests, including the bundled sample and all native claims.
- Build: `npm run build` — static output in `dist/site`; initial JavaScript gzip is under 11 KB.
- Native release package: local Linux AppImage packaging is blocked by the disposable container’s absent `/dev/fuse`; GitHub release run `33261874466` passed all macOS, Windows, and Linux builds and published v0.1.4 assets.

## Evidence files

- Local 390px landing: `.factory/evidence/polish-1-landing-mobile.png`.
- Local 390px demo: `.factory/evidence/polish-1-demo-mobile.png`.
- Release: `https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.4`.
- Cold live static re-check (2026-08-29): `scripts/verify-url.sh` passed for `/`, `/?demo=1`, `/privacy`, and `/terms`; all static public files return 200 and `/missing-sheet` returns 404.
- Cold demo re-check: demo banner and reset controls appear at `/?demo=1`; **Start for real** removes all `demo:` keys and opens `/app`. A fresh live browser made requests only to the product origin and `api.github.com`.
- Cold offline re-check: after the first live demo visit and service-worker activation, an offline reload retained the demo banner and title.
- Live accessibility: Playwright Axe found 0 serious or critical violations on `/`, `/?demo=1`, `/privacy`, `/terms`, and `/missing-sheet` at 390 px.
- Live 390px landing: `.factory/evidence/polish-1-live-landing-mobile.png`.
- Live 390px demo: `.factory/evidence/polish-1-live-demo-mobile.png`.
