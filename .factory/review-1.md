# Adversarial first-read review 1 — Change Recovery Ledger

**Verdict: FAIL**

Reviewed 2026-08-29 UTC against the live site and commit
`e473cfab3471e222a1131fa28fabe736ed823a66`, using fresh Chromium contexts at
390×844 and 1440×900. No product code was changed. PASS requires zero findings.

## Cold first read, before scrolling

At both sizes I understood the product as a way for developers supervising long
agent sessions to reverse the wrong files without discarding the rest. The first
click is **Try it with sample data**. The exact copy supplying those answers was
“Reverse the wrong agent changes”, “For developers supervising long agent
sessions who need to recover one change without discarding the rest”, and “Try
it with sample data”. The first-read blocking rule therefore does not trigger.

At 390×844, however, the viewport ended at the primary button. Its result note
and all three privacy/offline/price facts were below the fold (F-1-7).

## Findings

### Blocking

#### F-1-1 — Back navigation returns to the wrong part of the landing page

- Location: header **Privacy** → browser Back at 390×844.
- Evidence: `/privacy` opened at `scrollY=0`. Back restored `/` at
  `scrollY=4136` (also 5248 in a separate crawl), visibly landing on “A LOCAL
  SIDECAR”, while `document.activeElement` was the off-screen landing H1.
- Impact: URL/focus and the visible content disagree. This is broken History API
  behavior for keyboard and screen-reader users.
- Fix: use manual scroll restoration and restore/focus after native restoration.
  Test after a settling delay that Back puts the focused H1 inside the viewport
  and `scrollY === 0`.

#### F-1-2 — Leaving demo retains state despite the privacy promise

- Quote: `/privacy`, “Resetting or leaving the demo removes that state.”
- Evidence: after a live demo mutation and **Start for real**, `/app` still had
  `demo:agent-change-recovery:ledger`. Reset did remove it and preserved a
  seeded `real:review-sentinel`.
- Impact: the privacy statement is false; demo exit neither discards state nor
  offers the required explicit keep choice.
- Fix: clear all `demo:` keys on exit or ask whether to keep them. Extend
  `@claim:demo-isolation` to test exit as well as Reset.

#### F-1-3 — “Start for real” leads to a browser dead end

- Location: demo banner **Start for real** → `/app`.
- Evidence: `/app` disables all capture fields because a browser cannot read
  folders. It says “Download the app or inspect the sample ledger” but offers
  only another demo link, not a download.
- Impact: the required demo exit cannot start the real job and loops the visitor
  back to demo.
- Fix: make the exit **Download the desktop app** and resolve a real release, or
  add the same working download action to `/app`. Test demo exit through to a
  reachable asset.

#### F-1-4 — The desktop artifact has no one-click sample project

- Location: native first-run `/app` and `src-tauri`; no “Load sample project”
  control or bundled sample exists.
- Impact: the attached desktop demo contract requires a bundled, disposable
  sample. The browser facsimile does not make the actual desktop flow tryable
  without selecting a real folder.
- Fix: bundle a realistic project, add **Load sample project**, isolate and reset
  it, and test the packaged capture/reversal path with zero real-folder access.

#### F-1-5 — The paid plan is advertised but cannot be bought

- Quotes: README “Sociobot license purchase, restore, and daily verification
  flow”; landing “Pro checkout is being enabled”. The prior handoff confirms the
  product is absent from the Sociobot catalog.
- Impact: the README says purchase ships, while the live $15 plan has no purchase
  path.
- Fix: publish the exact Sociobot product and add an end-to-end checkout claim,
  or remove purchase/paid-availability language until it exists.

#### F-1-6 — The local-privacy claim test does not test egress

- Claim: “Project files stay on this device.”
- Evidence: `claim_local_privacy` only calls `read_project(&chosen)` and checks
  that a sibling file was not read. It duplicates `chosen-folder-only`; it does
  not observe network requests or sockets.
- Impact: the central privacy claim remains untested despite an exit-0 command.
- Fix: exercise native capture with unique fixture data while recording all
  WebView/native traffic; assert no contents, paths, commands, or intent leave.

### Minor

#### F-1-7 — Mobile hides the action result and all three facts

- Location: `/` at 390×844; the viewport ends at **Try it with sample data**.
- Fix: place the headline before or beside shorter art so the result note and
  three facts fit in the first viewport.

#### F-1-8 — The deployed 404 drops shared structure and metadata

- Location: cold `/missing-sheet` response; no header, footer, description,
  canonical, Open Graph, favicon, or apple-touch icon.
- Fix: use the shared skeleton and full metadata in `404.html`; retain the themed
  recovery-sheet treatment and test the deployed 404 response.

#### F-1-9 — Non-home routes retain landing social metadata

- Location: `/demo`, `/app`, `/privacy`, `/terms`; titles/descriptions/canonicals
  update, but OG/Twitter still say “Change Recovery Ledger — Reverse agent
  changes”.
- Fix: update OG/Twitter title and description from `routeMeta` on every render.

#### F-1-10 — Decorative brand lore carries no information

- Quote: CSS-generated “RECOVERY / 001”.
- Fix: delete it or use “Selective file recovery”.

#### F-1-11 — The hero caption uses a file metaphor

- Quote: “SELECT ONE STRIP / KEEP THE REST”.
- Fix: “REVERSE ONE FILE / KEEP THE REST”.

#### F-1-12 — Preview heading is unclear out of context

- Quote: “The ledger, loaded”.
- Fix: “Loaded checkpoint preview”.

#### F-1-13 — “Deliberate” adds mood, not information

- Quote: “Recover in three deliberate steps”.
- Fix: “Reverse selected changes in three steps”.

#### F-1-14 — “Safely” is an undefined quality claim

- Quote: “See one file recover safely”.
- Fix: “See one selected file reversed”.

#### F-1-15 — “Sidecar” is unexplained landing-page jargon

- Quote: “A local sidecar”.
- Fix: “What stays on your device”.

#### F-1-16 — Preview button does not name its result

- Quote: **Try this recovery**.
- Fix: **Open sample recovery**.

#### F-1-17 — README sentence exceeds 22 words

- Quote: line 49, 23 words: “With Pro, choose Open encrypted recovery, enter the
  `.crl` file path and its passphrase, and the app writes the decrypted patch for
  review.”
- Fix: “With Pro, choose **Open encrypted recovery**. Enter the `.crl` path and
  passphrase. The app writes a patch for review.”

#### F-1-18 — README Linux sentence exceeds 22 words

- Quote: line 53, 26 words.
- Fix: “On Linux, this command verifies the AppImage checksum and installs it at
  `~/.local/bin/change-recovery-ledger`. It warns you when that directory is not
  on `PATH`.”

#### F-1-19 — README workflow sentence is long and unlisted

- Quote: line 77, 30 words, beginning “Tag a release such as `v0.1.2`…”.
- Fix: split it into three sentences and register tests for the workflow matrix
  and fixture release manifest.

#### F-1-20 — README API sentence is long and unlisted

- Quote: line 81, 24 words, beginning “The landing page checks GitHub’s public
  API…”.
- Fix: “The landing page asks GitHub for current release filenames. It asks
  Sociobot whether checkout is published.” Add a request-log claim.

#### F-1-21 — README repeats unexplained “sidecar” jargon

- Quotes: “local desktop sidecar”; “recovery sidecar”.
- Fix: use “local desktop app” and “recovery tool”.

#### F-1-22 — README uses internal journey language

- Quote: “try the full recovery path with isolated sample data”.
- Fix: “reverse sample files and export a patch without changing your files”.

#### F-1-23 — README exposes reviewer jargon

- Quote: “Open `http://localhost:4173/demo` for the verifier sandbox.”
- Fix: “Open `http://localhost:4173/demo` to use the local sample.”

#### F-1-24 — README feature label is technical and unlisted

- Quote: “Rust snapshot core with generated-folder exclusions and path traversal
  checks.”
- Fix: “The app skips generated folders and blocks paths outside your chosen
  project.” Register one claim for each protection.

#### F-1-25 — README uses vague platform jargon and an unlisted claim

- Quote: “Static product site, legal pages, offline shell, and platform-aware
  release link.”
- Fix: name the pages and download behavior plainly; register platform selection.

#### F-1-26 — Normal reversal is also called “restore”

- Quotes: headline “Reverse selected agent changes…”; README “Selective restore
  that creates a safety checkpoint first.”
- Fix: use **reverse** for normal rollback, **restore safety copy** only for undo,
  and **verify license** for license entry.

#### F-1-27 — Checkpoint-content claim is unlisted

- Quote: “Each checkpoint keeps the intent, command trail, file group, and check
  result together.”
- Fix: capture and reload all four fields in a native claim test.

#### F-1-28 — Folder-comparison claim is unlisted

- Quote: “Compare the checkpoint with the current folder.”
- Fix: add a native claim test that mutates the folder after capture and checks
  the comparison result.

#### F-1-29 — Configurable retention is only partly tested

- Quote: landing and README, “configurable retention”.
- Evidence: `free-history-limit` checks only the seven-checkpoint gate and Pro
  bypass; it never asserts 30, 90, or unlimited retention.
- Fix: add a retention claim for every offered setting.

#### F-1-30 — Unsigned-release claim is unlisted

- Quotes: “Release files are unsigned in v0.1”; “macOS downloads are unsigned
  disk images.”
- Fix: register artifact signature inspection or move the backed warning to
  release notes.

#### F-1-31 — Operating-system warning claim is vague and unlisted

- Quote: “Your system may ask you to confirm before opening them.”
- Fix: provide tested platform-specific instructions or delete the prediction.

#### F-1-32 — Desktop platform-support claim is unlisted

- Quote: “Tauri 2 desktop app for macOS, Windows, and Linux.”
- Fix: verify published, launchable artifacts for every named platform.

#### F-1-33 — App-data storage claim is unlisted

- Quote: “Local checkpoint manifests and file snapshots in the operating
  system’s app-data folder.”
- Fix: test the resolved app-data location and written files.

#### F-1-34 — Directory exclusions are only partly registered

- Quote: “It ignores `.git`, `node_modules`, `target`, and `dist`.”
- Evidence: the registered claim covers `.git`; the existing non-claim test covers
  only `node_modules`.
- Fix: register and test all four named exclusions.

#### F-1-35 — Baseline/comparison behavior is unlisted

- Quote: “The first capture establishes the baseline; later captures show
  changes from the previous snapshot.”
- Fix: test three captures and each displayed delta.

#### F-1-36 — Platform-selected download claim is unlisted

- Quote: “The landing page picks the current release for your platform.”
- Fix: test Linux, macOS, and Windows user-agent fixtures against exact assets.

#### F-1-37 — Windows installer claim is unlisted

- Quote: “On Windows, this command verifies the release checksum and starts the
  verified installer.”
- Fix: add a PowerShell sandbox claim equivalent to `linux-installer`.

#### F-1-38 — License-request privacy claim is unlisted

- Quote: “License verification sends only the pasted license token to
  `api.sociobot.in`.”
- Fix: log the request and assert destination and absence of project data. Avoid
  putting the license token in a URL query string.

#### F-1-39 — License persistence and daily checks are unlisted

- Quotes: README “daily verification flow”; `/privacy`, “It stores the token and
  latest result on this device.”
- Fix: add a clock-controlled claim for storage, the 24-hour refresh boundary,
  invalidation, and destination.

#### F-1-40 — Third-party request disclosure is unlisted

- Quote: `/privacy`, “GitHub and Sociobot receive normal request data, including
  your IP address.”
- Fix: register a landing request-log claim listing both permitted origins. The
  live observation did see only first-party, GitHub, and Sociobot origins.

#### F-1-41 — Metadata claims replay although the product never replays

- Quote: meta/social description, “Inspect, reverse, and replay selected agent
  changes without losing unrelated work.”
- Impact: the UI exports a patch and says it never runs it; no replay action or
  claim exists.
- Fix: say “inspect, reverse, and export”, or implement reviewed replay with a
  safety checkpoint and claim test.

#### F-1-42 — Merchant/refund claims are unlisted

- Quotes: “Sociobot is the merchant of record”; terms “Refunds and cancellations
  are handled through its checkout service.”
- Fix: register live product/checkout evidence and an end-to-end support path, or
  remove these statements until checkout exists.

#### F-1-43 — Build-location claim is unlisted

- Quote: “Desktop packages are built only in GitHub Actions.”
- Fix: register a release-workflow claim that fails if desktop packaging occurs
  outside the declared workflow or rewrite this as a maintainer instruction.

#### F-1-44 — Deletion-confirmation UI claim is unlisted

- Quote: “The confirmation names the checkpoint count”.
- Evidence: `ledger-deletion` proves filesystem behavior, not the native dialog
  text or count.
- Fix: add a native UI claim that creates multiple checkpoints and asserts the
  confirmation’s exact count before deletion.

## Demo and sandbox evidence

- One click opened `/demo` with H1 “Inspect the failed session change”.
- The first screen showed four realistic checkpoints, a failed session-refactor
  checkpoint, a selected source file, intent, test failure, and file changes.
- The persistent banner contained the required message, Reset, and exit actions.
- Reversing two files wrote only `demo:agent-change-recovery:ledger`; the seeded
  real sentinel remained unchanged. Reset removed only the demo key.
- A direct fresh `/demo` visit made same-origin requests only. After service
  worker control, offline reload restored the sample and banner without errors.
- Exit failures are F-1-2 and F-1-3.

## Registered claims

The first clean clone lacked Linux Tauri libraries. After installing the
README-linked prerequisites, every exact command ran from that clean clone and
exited 0. F-1-6 remains because its passing test does not prove its claim.

| Claim | Result |
| --- | --- |
| selective-reversal | PASS — `npm test -- --grep @claim:selective-reversal` |
| patch-export | PASS — `npm test -- --grep @claim:patch-export` |
| demo-isolation | PASS — `npm test -- --grep @claim:demo-isolation` |
| local-privacy | PASS command; proof inadequate — `cargo test --manifest-path src-tauri/Cargo.toml claim_local_privacy` |
| offline-reload | PASS — `npm test -- --grep @claim:offline-reload` |
| price | PASS — `npm test -- --grep @claim:price` |
| free-history-limit | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_free_history_limit` |
| encrypted-export | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_encrypted_export` |
| git-metadata-exclusion | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_git_metadata_exclusion` |
| chosen-folder-only | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_chosen_folder_only` |
| large-file-skip | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_large_file_skip` |
| free-safety-and-patch-export | PASS — `npm test -- --grep @claim:free-safety-and-patch-export` |
| reversible-safety-checkpoint | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_reversible_safety_checkpoint` |
| ledger-deletion | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_ledger_deletion_removes_snapshots_not_project_files` |
| encrypted-import | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_encrypted_import_opens_a_patch_without_running_it` |
| linux-installer | PASS — `npm test -- --grep @claim:linux-installer` |

Additional clean-clone gates: Playwright 23/23, Rust 13/13, site build PASS,
main JavaScript 11,723 bytes gzip.

## Copy audit — landing page

Counts treat contractions, possessives, hyphenated terms, and `$15` as one word.

### Sentences

| Words | Sentence |
| ---: | --- |
| 16 | For developers supervising long agent sessions who need to recover one change without discarding the rest. |
| 5 | A loaded ledger opens next. |
| 6 | Nothing is saved to your data. |
| 6 | Project files stay on this device. |
| 7 | The demo works offline after one visit. |
| 4 | Free for 7 checkpoints. |
| 7 | Pro costs $15 per developer each month. |
| 13 | Each checkpoint keeps the intent, command trail, file group, and check result together. |
| 10 | Selected recovery: reverse this file and keep the other three. |
| 6 | Write the agent’s intent and commands. |
| 7 | The desktop app records the project files. |
| 7 | Compare the checkpoint with the current folder. |
| 7 | Select only the files that went wrong. |
| 13 | Create a safety checkpoint, restore selected files, or export a patch for review. |
| 4 | Patches never run themselves. |
| 9 | The ledger leaves Git data out of its checkpoints. |
| 6 | It records the folder you choose. |
| 5 | Checkpoint files can contain secrets. |
| 9 | They stay in the desktop app’s local data folder. |
| 10 | Delete a local ledger when you no longer need it. |
| 6 | This keeps your project files unchanged. |
| 9 | The demo uses a separate `demo:` browser storage key. |
| 8 | Leaving the demo does not copy its data. |
| 16 | Pro adds longer history, configurable retention, and passphrase-encrypted recovery export that opens back into a patch. |
| 5 | Your free ledger keeps working. |
| 6 | Check back after checkout is published. |
| 6 | Sociobot is the merchant of record. |
| 4 | See terms and privacy. |
| 7 | Release files are unsigned in v0.1. |
| 10 | Your system may ask you to confirm before opening them. |
| 8 | Reverse selected agent changes without losing the rest. |

No landing prose exceeds 22 words. F-1-10 through F-1-16 cover its other
plain-language failures.

### Headings, labels, and actions

| Words | Copy |
| ---: | --- |
| 3 | RECOVERY / 001 |
| 5 | Reverse the wrong agent changes |
| 6 | SELECT ONE STRIP / KEEP THE REST |
| 3 | The ledger, loaded |
| 7 | Inspect an agent turn before reversing it |
| 5 | Recover in three deliberate steps |
| 3 | Capture the turn |
| 4 | Inspect the file group |
| 3 | Reverse or export |
| 2 | Desktop walkthrough |
| 5 | See one file recover safely |
| 5 | 1 / Select the suspect file |
| 5 | 2 / Confirm the safety checkpoint |
| 5 | 3 / Keep the recovery record |
| 3 | A local sidecar |
| 5 | It does not replace Git |
| 2 | Pro recovery |
| 3 | Keep longer histories |
| 2 | Desktop app |
| 6 | Choose the build for your computer |
| 5 | Try it with sample data |
| 3 | Try this recovery |
| 2 | Verify license |
| 3 | Download for Linux |

Other visible UI fragments: Change Recovery Ledger (3), Menu (1), Demo (1), Open
ledger (2), How it works (3), Privacy (1), ACME-WEB / 4 CHECKPOINTS (3), LOCAL
(1), Keep draft after sign-in (4), Refactor session refresh (3), Update account
help text (4), 2 tests failed (3), Selected recovery (2), Have a license? (3),
Pro checkout is being enabled (5), Terms (1), and Built by Param Factory (4).
The preview’s diff lines are source-code examples rather than prose sentences.

## Copy audit — README

Headings: Change Recovery Ledger (3); What ships (2); Run the site and demo (5);
Run the desktop app (4); Install a release (3); Test and build (3); Privacy and
security (3); License (1).

| Line | Words | Sentence or bullet statement |
| ---: | ---: | --- |
| 3 | 8 | Reverse selected agent changes without losing unrelated work. |
| 5 | 14 | Change Recovery Ledger is a local desktop sidecar for developers supervising long agent sessions. |
| 5 | 11 | It records project snapshots with the agent’s intent and command trail. |
| 5 | 20 | You can inspect a file group, create a safety checkpoint, restore selected files, or export selected changes as a patch. |
| 5 | 12 | Git metadata is excluded from checkpoints, and exported patches never run themselves. |
| 7 | 13 | The public site is at agent-change-recovery.sociobot.in. |
| 7 | 18 | Open `/demo` to try the full recovery path with isolated sample data. |
| 11 | 9 | Tauri 2 desktop app for macOS, Windows, and Linux. |
| 12 | 10 | Rust snapshot core with generated-folder exclusions and path traversal checks. |
| 13 | 12 | Local checkpoint manifests and file snapshots in the operating system’s app-data folder. |
| 14 | 8 | Selective restore that creates a safety checkpoint first. |
| 15 | 13 | A safety checkpoint that can restore a mistaken reversal of its selected files. |
| 16 | 8 | Selected-file patch export that never executes the patch. |
| 17 | 10 | Passphrase-encrypted recovery export and import back into a reviewable patch. |
| 18 | 10 | A confirmed local-ledger deletion control that leaves project files unchanged. |
| 19 | 9 | Offline browser demo under a separate `demo:` storage key. |
| 20 | 8 | Sociobot license purchase, restore, and daily verification flow. |
| 21 | 11 | Static product site, legal pages, offline shell, and platform-aware release link. |
| 23 | 6 | The first seven checkpoints are included. |
| 23 | 7 | Pro costs $15 per developer each month. |
| 23 | 10 | It adds longer history, configurable retention, and passphrase-encrypted recovery export. |
| 23 | 11 | Safety checkpoints and patch export are included in the free controls. |
| 27 | 6 | Requirements: Node.js 22 and npm. |
| 34 | 9 | Open `http://localhost:4173/demo` for the verifier sandbox. |
| 34 | 7 | Demo changes use only `demo:agent-change-recovery:ledger`. |
| 34 | 7 | Choose Reset demo for a clean state. |
| 38 | 18 | Install the Tauri 2 system prerequisites for your operating system, then run. |
| 45 | 8 | The desktop app accepts an explicit project path. |
| 45 | 8 | It ignores `.git`, `node_modules`, `target`, and `dist`. |
| 45 | 6 | Files over 2 MB are skipped. |
| 45 | 14 | The first capture establishes the baseline; later captures show changes from the previous snapshot. |
| 47 | 13 | Choose Delete local ledger after loading a project to remove its local snapshots. |
| 47 | 16 | The confirmation names the checkpoint count, and it does not change files in the project folder. |
| 49 | **23** | With Pro, choose Open encrypted recovery, enter the `.crl` file path and its passphrase, and the app writes the decrypted patch for review. |
| 49 | 5 | It never runs the patch. |
| 53 | 10 | The landing page picks the current release for your platform. |
| 53 | **26** | On Linux, this command verifies the AppImage checksum, installs an executable at `~/.local/bin/change-recovery-ledger`, and tells you if that directory is not on `PATH`. |
| 59 | 13 | On Windows, this command verifies the release checksum and starts the verified installer. |
| 65 | 6 | macOS downloads are unsigned disk images. |
| 65 | 19 | Open the downloaded image and move the app to Applications; macOS may ask you to confirm before opening it. |
| 75 | 16 | `npm test` starts the built site and runs the Playwright claim, accessibility, mobile, and routing suite. |
| 75 | 14 | The exact static deploy output is `dist/site`, with `index.html` at that root. |
| 77 | 8 | Desktop packages are built only in GitHub Actions. |
| 77 | **30** | Tag a release such as `v0.1.2`; `.github/workflows/release.yml` builds macOS arm64 and x64, Windows x64, Linux AppImage and deb targets, then publishes `SHA256SUMS` and `latest.json`. |
| 81 | 9 | Project contents are not sent by the desktop core. |
| 81 | 12 | License verification sends only the pasted license token to `api.sociobot.in`. |
| 81 | **24** | The landing page checks GitHub’s public API for current release filenames and the Sociobot product catalog to show checkout only when it is published. |
| 83 | 5 | Checkpoint data can contain secrets. |
| 83 | 13 | Use the in-app Delete local ledger control when snapshots are no longer needed. |
| 83 | 16 | Keep normal Git history and backups; this product is a recovery sidecar, not a backup service. |
| 85 | 19 | See the in-product privacy policy and terms. |
| 89 | 1 | MIT. |
| 89 | 3 | See LICENSE. |

## Terminology

| Concept | Current terms | Required term |
| --- | --- | --- |
| Normal selected-file rollback | reverse, restore, recovery | reverse |
| Undo from automatic pre-change copy | restore, restore safety copy | restore safety copy |
| Recorded agent operation | checkpoint, snapshot | checkpoint; reserve snapshot for stored bytes in developer docs |
| Product role | sidecar, app, tool | desktop app |
| Exported review file | patch, recovery | patch; “encrypted recovery” only for `.crl` |
| Sample mode | demo, verifier sandbox, recovery path | demo |

## Structure, accessibility, links, and identity

- PASS: normal routes have route titles, one H1/main, `lang=en`, descriptions,
  canonicals, icons, shared header/footer, deep links, and route-change focus.
- PASS: every discovered internal, release, and Sociobot link returned 200;
  `mailto:` links were explicit exceptions.
- PASS: injected live Axe checks found zero serious/critical violations on all
  routes at 390px. Local tests passed keyboard, dialog focus, touch targets,
  mobile overflow, and reduced motion.
- PASS: the risograph paper/ledger identity is distinct, not a generic SaaS
  template.
- FAIL: Back, 404, and social metadata are F-1-1, F-1-8, and F-1-9.

## History verification

No earlier `.factory/review-*.md` or `.factory/polish-*.md` exists. The prior
handoff was checked item by item:

- Confirmed: reversible safety checkpoint, deletion, encrypted import, and Linux
  installer claims pass.
- Confirmed: 390px overflow/touch targets pass; `0.1.2` metadata is consistent.
- Confirmed: no unavailable **Buy Pro** link; service worker v4, 800px hero, and
  offline demo work.
- Confirmed: all registered commands pass with documented prerequisites.
- Re-raised: the handoff’s known unpublished billing gap is F-1-5.
- The prior “no defects” conclusion missed F-1-1 through F-1-44.

## Missed leverage

No AI feature is warranted for this deterministic, high-risk recovery tool.
Patch export and encrypted import cover the obvious exchange workflow, and the
brief does not require cloud sync. The missing leverage is the bundled native
sample project in F-1-4.

## What would make this perfect

Resolve every finding: correct Back scroll; make demo exit truthful and useful;
ship the native sample; enable checkout or stop advertising it; prove privacy
with network evidence; register every claim; rewrite flagged copy; and complete
404/social metadata. Then rerun this entire review from fresh contexts and a
clean clone. There is not yet an honest “nothing left to do” conclusion.
