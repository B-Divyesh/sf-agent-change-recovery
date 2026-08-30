# Polish 2 — complete finding closure

Candidate repaired from `f8b272dda668583131aaceab841aaf6b67257894`. Release and live evidence use v0.1.12.

## Review 2 findings

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-2-1 | Native capture now runs under `strace` network-syscall recording with unique file, path, request, and command values. The fixture also proves an outside sentinel is absent. | `scripts/test-native-privacy.sh`; output: `zero network syscalls` |
| F-2-2 | The static 404 now mirrors all four header links, all three footer links, the external-link name, version, and build ID. | `the real 404 mirrors the shared header and footer structure`; `.factory/evidence/polish-2-live-404-mobile.png` |
| F-2-3 | Split the 23-word README request sentence into two short sentences. | `.factory/copy-audit.md`; banned/length audit |
| F-2-4 | Added a real native `compare_with_folder` command and wired **Compare with folder** to it. The native fixture mutates live files; the UI fixture asserts visible paths and diffs. | `claim_current_folder_comparison_reads_the_live_folder`; `@ui:current-folder-comparison` |
| F-2-5 | Removed the unproved unsigned-macOS statement and claim. | README/source search; `npm run test:claim-tags` |
| F-2-6 | Replaced configuration-only platform wording with a published-artifact claim. Its test downloads macOS, Windows, and Linux files and verifies their SHA-256 values and manifest entries. | `node scripts/verify-published-release.mjs`; v0.1.12 release |
| F-2-7 | The shipped PowerShell installer is executed on Windows. Valid bytes start once; a forced mismatch starts nothing. The release job also installs and launches the real candidate. | Quality job `windows-installer`; `node scripts/verify-windows-consumer-proof.mjs` |
| F-2-8 | Removed every merchant-of-record sentence. Checkout and license behavior remain stated and tested without naming an unproved merchant. | repository/live text search; `.factory/evidence/polish-2-live.json` |
| F-2-9 | The encryption claim uses a unique passphrase, scans every app-data file and log fixture, rejects a wrong passphrase, and requires the correct passphrase after reopen. | `claim_local_encryption_keeps_project_content_and_passphrase_out_of_storage` |
| F-2-10 | Renamed both Rust tags to `encrypted-recovery-export` and `encrypted-recovery-import`. Added a validator requiring exactly one matching tag per claim. | `npm run test:claim-tags` — 33/33 |
| F-2-11 | Added a one-click claim that starts on `/`, clicks once, and verifies the banner, four checkpoints, failure, request, files, and recovery controls. | `@claim:one-click-demo` |
| F-2-12 | Mac controls now read **Download for Apple silicon** and **Download for Intel Mac**. | `@claim:platform-download`; live JSON `macLabels` |
| F-2-13 | Replaced the dependent heading with “This recovery app does not replace Git.” | `.factory/copy-audit.md`; live landing screenshot |
| F-2-14 | Replaced landing “snapshot and manifest” jargon with “local checkpoint file.” | `.factory/copy-audit.md`; live landing screenshot |
| F-2-15 | Removed the subjective statement that the free plan “remains useful.” | README text audit |
| F-2-16 | Added an executable shell-installer claim for both mocked `arm64` and `x86_64` outcomes. | `@claim:macos-installer` |

## Review 1 findings rechecked

| Finding | Change made | Evidence |
| --- | --- | --- |
| F-1-1 | Manual history state restores the landing heading and scroll position. | `every route has its own title and history navigation works`; live route audit |
| F-1-2 | Reset and exit remove every `demo:` key and preserve real storage. | `@claim:demo-isolation`; live JSON `resetKeys`/`exitKeys` |
| F-1-3 | Demo exit opens `/app`, clears demo data, and exposes the current desktop download. | `@claim:demo-isolation`; live JSON `downloadVisible` |
| F-1-4 | The native app loads and resets an isolated bundled project. | `claim_bundled_sample_project_is_resettable_and_isolated` |
| F-1-5 | Checkout appears only for the recorded published Sociobot product and exact price. | `@claim:pro-license`; `@claim:pro-price`; `npm run verify:paid-checkout` |
| F-1-6 | Replaced the disconnected listener with process-boundary network syscall recording. | `scripts/test-native-privacy.sh` |
| F-1-7 | The action result and three facts remain inside 390×844. | live JSON `factsBottom <= viewportHeight`; `.factory/evidence/polish-2-live-landing-mobile.png` |
| F-1-8 | Completed the 404 shared skeleton and metadata. | 404 structure test; live 404 screenshot |
| F-1-9 | Every SPA route updates title, canonical, OG, and Twitter metadata. | `route metadata updates title, canonical, Open Graph, and Twitter fields` |
| F-1-10 | Decorative recovery numbering remains absent. | copy/source audit |
| F-1-11 | Hero caption remains “Reverse one file / keep the rest.” | live landing screenshot |
| F-1-12 | Preview label remains “Loaded checkpoint preview.” | `.factory/copy-audit.md` |
| F-1-13 | Steps heading remains task-specific. | `.factory/copy-audit.md` |
| F-1-14 | Walkthrough heading remains “See one selected file reversed.” | `.factory/copy-audit.md` |
| F-1-15 | Unexplained “sidecar” language remains absent. | source/README text audit |
| F-1-16 | Preview action remains “Open sample recovery.” | browser copy test/full suite |
| F-1-17 | Recovery instructions remain split into short sentences. | README length audit |
| F-1-18 | Linux installer instructions remain short and concrete. | README length audit; `@claim:linux-installer` |
| F-1-19 | Release instructions remain split and candidate validation is registered. | `@claim:release-candidate-identity` |
| F-1-20 | Release-request text is now two short sentences. | README length audit; `@claim:release-request-privacy` |
| F-1-21 | README consistently says desktop app/tool. | terminology audit |
| F-1-22 | Demo wording states the concrete sample result. | README and `@claim:one-click-demo` |
| F-1-23 | Reviewer-only sandbox wording remains absent. | README text audit |
| F-1-24 | All four generated-folder exclusions remain named and tested. | `claim_generated_folder_exclusions` |
| F-1-25 | Download wording names exact current-version behavior. | `@claim:platform-download` |
| F-1-26 | Normal rollback uses “reverse”; undo uses “safety checkpoint.” | terminology audit; selective-reversal tests |
| F-1-27 | Request, commands, files, and check result are persisted and reopened. | `claim_checkpoint_record_keeps_request_commands_files_and_check_result` |
| F-1-28 | Implemented and tested current-folder comparison separately from prior-checkpoint comparison. | current-folder native and UI tests |
| F-1-29 | All 2/7/30/90 choices and retention pruning remain tested. | `@claim:retention-tiers`; `claim_retention_prunes_old_checkpoints_and_keeps_boundary_recovery` |
| F-1-30 | Removed the unsigned-artifact assertion instead of inferring it from workflow text. | README/claims audit |
| F-1-31 | Removed vague operating-system warnings. | README text audit |
| F-1-32 | Platform support now depends on downloaded, checksum-verified release artifacts. | `node scripts/verify-published-release.mjs` |
| F-1-33 | No app-data-location promise is made. | source/README audit |
| F-1-34 | `.git`, `node_modules`, `target`, and `dist` are all in one native fixture. | `claim_generated_folder_exclusions` |
| F-1-35 | Three captures prove each checkpoint compares with its predecessor. | `claim_checkpoint_comparison_uses_the_previous_snapshot` |
| F-1-36 | Browser selection covers Linux, Windows, Intel Mac, and Apple silicon. | `@claim:platform-download` |
| F-1-37 | Windows proof is behavioral and runs on `windows-latest`, including mismatch rejection. | quality/release Windows jobs; published consumer proof |
| F-1-38 | License request destination, encoding, and payload absence remain recorded. | `@claim:pro-license`; native recorded billing test |
| F-1-39 | Cached reload sends no second verification inside one day. | `@claim:license-daily-verification` |
| F-1-40 | Pre-checkout origins remain limited to first party, GitHub, and Sociobot. | `@claim:release-request-privacy` |
| F-1-41 | Metadata and actions say export, never replay. | route metadata test; source search |
| F-1-42 | Removed merchant and refund assertions. | repository/live text search |
| F-1-43 | No claim says packages are built only in GitHub Actions. | README/source audit |
| F-1-44 | No copy claims a confirmation count; filesystem deletion behavior remains tested. | `claim_ledger_deletion_removes_snapshots_not_project_files` |

## Final evidence locations

- Clean clone of `5c8c5c125f799610b0214495e8756f9455b45092`: all 33 declared claim commands, 39 browser tests, 23 native tests, build, and checkout check passed

- Live landing: `.factory/evidence/polish-2-live-landing-mobile.png`
- Live one-click demo: `.factory/evidence/polish-2-live-demo-mobile.png`
- Live 404: `.factory/evidence/polish-2-live-404-mobile.png`
- Machine-readable cold check: `.factory/evidence/polish-2-live.json`
- Lighthouse report: `.factory/evidence/polish-2-lighthouse.json` (99 performance; 100 accessibility, best practices, and SEO)
- Published release: `https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.12`
- Quality run: `https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33291862197` (success)
