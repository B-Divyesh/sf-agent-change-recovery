# Adversarial first-read review 2 — Change Recovery Ledger

**Verdict: FAIL**

Reviewed 2026-08-30 UTC against the live site and repository commit
`f8b272dda668583131aaceab841aaf6b67257894`. Fresh Chromium contexts used
390×844 and 1440×900 viewports. Claim commands ran from a clean local clone. No
product code was changed. PASS requires zero findings and no untested claim.

## Cold first read, before scrolling

At both widths, the first screen answered the three required questions:

- What it does: reverse the wrong files changed by an agent while keeping the
  rest.
- For whom: developers supervising long agent sessions.
- First click: **Try it with sample data**.

The exact text was “Reverse the wrong agent changes”, “For developers
supervising long agent sessions who need to recover one change without
discarding the rest”, and “Try it with sample data”. At 390×844, the action
result and all three facts ended at `y=723`, inside the first viewport. The
first-read blocking rule does not trigger.

Evidence: `.factory/evidence/review-2-cold-mobile.png` and
`.factory/evidence/review-2-cold-desktop.png`.

## Findings

### Blocking

#### F-2-1 — Reopened F-1-6: the local-privacy test still does not observe egress

- Quote: claim `local-privacy`, “Project contents stay on this device.”
- Location: `.factory/claims.json`; `claim_local_privacy` in
  `src-tauri/src/lib.rs`.
- Evidence: the passing test calls `read_project`, then opens an unrelated
  random local listener and confirms that nothing connected to it. The capture
  code is never routed through or instrumented against that listener. The test
  does not observe DNS, sockets, HTTP, WebView traffic, file paths, intent, or
  commands. A network call to any other endpoint would still pass.
- Why this fails: this was the central blocking issue in review 1. Adding an
  unconnected listener does not prove the promise.
- Concrete fix: run a real native capture with unique contents under a
  network-denied or fully recorded process boundary. Assert zero outbound
  connections and absence of the unique content, paths, commands, and request
  text in all traffic.

#### F-2-2 — Reopened F-1-8: the deployed 404 still does not share the site structure

- Location: live `/missing-sheet` and `public/404.html`.
- Exact differences: the normal header has **Demo**, **Open ledger**, **How it
  works**, and **Privacy**; the 404 has only **Demo** and **Privacy**. The normal
  footer links “Built by Param Factory” and shows `v0.1.11 · build 2026.08.30`;
  the 404 renders unlinked “Built by Param Factory” and no version/build ID.
- Why this fails: F-1-8 required the shared header/footer. Metadata and styling
  were added, but the shared structure remains half-fixed.
- Concrete fix: generate the 404 header/footer from the same source or mirror
  every normal navigation item, external-link label, and version/build field.
  Add assertions comparing the header and footer link sets on `/` and a real
  404 response.

#### F-2-3 — Reopened F-1-20: the README request sentence still exceeds 22 words

- Quote/location: `README.md:107`, “Before a visitor starts checkout, the
  browser landing page asks GitHub for current public release filenames and
  Sociobot whether Pro checkout is published.” — **23 words**.
- Why this fails: F-1-20 explicitly required this sentence to be split. A claim
  was added, but the plain-words defect remains.
- Concrete fix: “Before checkout, the landing page asks GitHub for release
  filenames. It asks Sociobot whether Pro checkout is published.”

#### F-2-4 — Reopened F-1-28: “current folder” is mapped to a different test

- Quote/location: landing “Compare the checkpoint with the current folder” and
  desktop action **Compare with folder**.
- Evidence: `checkpoint-comparison` claims and tests comparison with the
  *previous checkpoint*. Its fixture creates three snapshots and checks the
  third diff against the second. It never loads a checkpoint, changes the live
  folder afterward, selects **Compare with folder**, or checks the displayed
  result.
- Why this fails: the current-folder behavior remains an unlisted, untested
  claim. Renaming the old prior-snapshot claim did not cover F-1-28.
- Concrete fix: add a separate `current-folder-comparison` entry. In a native
  fixture, capture a checkpoint, mutate the project, invoke the same command as
  the UI action, and assert the visible file/diff result.

#### F-2-5 — Reopened F-1-30: the unsigned-build test does not inspect a build

- Quote/location: README, “macOS builds are unsigned during this release
  phase.”
- Evidence: `@claim:unsigned-macos` only searches workflow source for a macOS
  runner and the absence of three strings. It never inspects a DMG or app
  signature. An ad-hoc signing command or a pre-signed bundle could still pass.
- Why this fails: review 1 required artifact signature inspection; the repair
  substituted configuration-text inspection.
- Concrete fix: download the claim fixture’s macOS artifacts and run
  `codesign -dv --verbose=4` plus `spctl -a -vv`; assert the exact unsigned
  state, or remove the claim from README.

#### F-2-6 — Reopened F-1-32: platform-build evidence is configuration-only

- Quotes: landing “Desktop builds are published for macOS, Windows, and Linux”;
  README “The release workflow builds desktop packages on macOS, Windows, and
  Linux runners.”
- Evidence: `@claim:release-platforms` only checks that workflow YAML contains
  runner names and metadata strings. It does not run the workflow, inspect a
  recorded successful run, or validate/launch macOS and Windows packages.
- Why this fails: source strings do not prove that packages build or are
  published. The earlier platform-support finding is only partly fixed.
- Concrete fix: test a recorded release manifest tied to the candidate commit,
  verify every named artifact and checksum, and add platform-native launch
  smoke results. Narrow the copy to “The workflow is configured to build…” if
  only configuration is tested.

#### F-2-7 — Reopened F-1-37: the Windows installer is not executed

- Quote: README, “The Linux and Windows scripts verify the published SHA-256
  checksum first.”
- Evidence: `@claim:windows-installer` only asserts that the strings
  `Get-FileHash` and `Start-Process` occur in that order in `install.ps1`. It
  does not parse or run PowerShell, force a bad checksum, or confirm that
  `Start-Process` receives the verified file.
- Why this fails: a syntactically broken script or bypass branch would pass.
  Review 1 requested a Windows sandbox equivalent to the Linux installer test.
- Concrete fix: execute `install.ps1` in a Windows CI fixture with mocked
  release responses. Assert a valid download starts once and a mismatch starts
  nothing.

#### F-2-8 — Reopened F-1-42: the merchant claim returned without a claim entry

- Quotes: landing “Sociobot is the merchant of record”; README “When checkout
  is available, Sociobot and Dodo are the merchant of record.”
- Evidence: no `.factory/claims.json` entry proves either sentence. The two
  sentences also name different merchants.
- Why this fails: F-1-42 was marked fixed by removing this assertion, but the
  live site and README now make it again. A buyer could rely on the merchant
  identity for receipts, disputes, and refunds.
- Concrete fix: use one accurate sentence and add a checkout-contract fixture
  that asserts the legal merchant shown to the buyer, or remove both claims.

#### F-2-9 — The passphrase-storage part of local encryption is untested

- Quote: claim `local-encryption`, “Project snapshots and manifests are
  encrypted locally with a ledger passphrase that is not stored.” README adds,
  “The app keeps that passphrase only in memory while the ledger is open.”
- Evidence: `claim_local_encryption` searches ledger files for project content
  and reopens data with the passphrase. It never searches disk, preferences,
  logs, browser storage, or restart state for the unique passphrase itself.
- Why this fails: the command passes without proving the final clause of its
  registered claim. This leaves a secret-handling claim untested.
- Concrete fix: use a unique passphrase, complete capture and close/reopen
  flows, inspect all app storage and logs for that value, and verify reopening
  requires re-entry.

### Minor

#### F-2-10 — Two claim IDs do not have their required matching tags

- Location: `.factory/claims.json` uses `encrypted-recovery-export` and
  `encrypted-recovery-import`; Rust comments use `@claim:encrypted-export` and
  `@claim:encrypted-import`.
- Why this fails: the claims contract requires exactly one
  `@claim:<claims.json id>` tag per claim. Both commands run, but automated tag
  discovery reports zero matches for the registered IDs.
- Concrete fix: rename both Rust tags to the exact JSON IDs and add a test that
  validates one matching tag for every ledger entry.

#### F-2-11 — “One-click sample” is an unlisted quantitative claim

- Quote/location: README, “Use the one-click sample at
  agent-change-recovery.sociobot.in/?demo=1.”
- Evidence: the live path works in one click, but no claims entry starts at the
  landing page and asserts that one click opens a populated failed checkpoint.
- Concrete fix: add a `one-click-demo` claim/test that clicks the landing CTA
  once and asserts the banner, four checkpoints, failed check, intent, files,
  and actions without setup; or remove “one-click”.

#### F-2-12 — Two Mac download controls do not name their result

- Location: landing Mac build selector; controls **Apple silicon** and **Intel
  Mac**.
- Why this fails: the labels name architectures, not the result of activating
  the controls.
- Concrete fix: **Download for Apple silicon** and **Download for Intel Mac**.

#### F-2-13 — A landing heading depends on an absent antecedent

- Quote: “It does not replace Git.”
- Why this fails: in a screen-reader heading list, “It” does not identify the
  subject or section.
- Concrete fix: “This recovery app does not replace Git.”

#### F-2-14 — Landing privacy copy exposes unexplained storage jargon

- Quote: “A passphrase encrypts every local snapshot and manifest.”
- Why this fails: “manifest” is an internal storage term and the page otherwise
  asks users to understand “checkpoint” and “ledger”.
- Concrete fix: “A passphrase encrypts every local checkpoint file.”

#### F-2-15 — README uses a marketing judgment instead of a fact

- Quote: “The free plan remains useful: it keeps 2 or 7 checkpoints and exports
  standard patches.”
- Why this fails: “useful” is subjective and adds nothing to the tested limits.
- Concrete fix: “The free plan keeps 2 or 7 checkpoints and exports standard
  patches.”

#### F-2-16 — The Mac architecture selection claim is unlisted

- Quote: README, “The shell installer picks the matching Apple silicon or Intel
  disk image.”
- Evidence: `platform-download` tests browser links, while `linux-installer`
  runs only on Linux. No claim entry executes `install.sh` under both macOS
  architectures.
- Concrete fix: add a macOS-installer claim with mocked `uname`, release JSON,
  checksums, and both architecture outcomes; or remove this sentence.

## Copy audit — live landing page

Counts treat contractions, possessives, hyphenated compounds, numbers, and a
URL as one word. These are all settled, visible prose sentences on the live
landing page; headings and controls follow separately.

| Words | Sentence |
| ---: | --- |
| 16 | For developers supervising long agent sessions who need to recover one change without discarding the rest. |
| 5 | A loaded ledger opens next. |
| 6 | Nothing is saved to your data. |
| 5 | Project files are encrypted locally. |
| 7 | The demo works offline after one visit. |
| 7 | Pro costs $15 per developer each month. |
| 10 | Each checkpoint shows the request, commands, files, and check result. |
| 10 | Selected recovery: reverse this file and keep the other three. |
| 6 | Write the agent’s request and commands. |
| 7 | The desktop app records the chosen project. |
| 7 | Compare the checkpoint with the current folder. **F-2-4** |
| 8 | Select only the files that went wrong. |
| 13 | Create a safety checkpoint, reverse selected files, or export a patch for review. |
| 4 | Patches never run themselves. |
| 9 | The ledger leaves Git data out of its checkpoints. |
| 6 | It records the folder you choose. |
| 5 | Checkpoint files can contain secrets. |
| 8 | A passphrase encrypts every local snapshot and manifest. **F-2-14** |
| 10 | Delete a local ledger when you no longer need it. |
| 6 | This keeps your project files unchanged. |
| 9 | The demo uses a separate `demo:` browser storage key. |
| 6 | Leaving the demo removes its data. |
| 16 | Pro keeps 30 or 90 local checkpoints, adds team policy notes, and exports password-protected recovery files. |
| 7 | Free plan: retain 2 or 7 checkpoints. |
| 6 | Sociobot is the merchant of record. **F-2-8** |
| 7 | The free plan still exports standard patches. |
| 9 | Desktop builds are published for macOS, Windows, and Linux. **F-2-6** |
| 6 | Check the release notes before installing. |
| 8 | Reverse selected agent changes without losing the rest. |

No landing sentence exceeds 22 words and no banned word appears.

### Landing headings, labels, and actions

| Words | Copy | Result |
| ---: | --- | --- |
| 3 | Change Recovery Ledger | Product name |
| 5 | Reverse the wrong agent changes | Clear H1 |
| 5 | Try it with sample data | Clear action |
| 6 | Reverse one file / keep the rest | Informative caption |
| 3 | Loaded checkpoint preview | Informative label |
| 7 | Inspect an agent turn before reversing it | Informative heading |
| 3 | Open sample recovery | Clear action |
| 3 | How it works | Clear section label |
| 6 | Reverse selected changes in three steps | Clear heading |
| 3 | Capture the turn | Clear heading |
| 4 | Inspect the file group | Clear heading |
| 3 | Reverse or export | Clear heading |
| 2 | Desktop walkthrough | Clear section label |
| 5 | See one selected file reversed | Clear heading |
| 5 | 1 / Select the suspect file | Clear step |
| 5 | 2 / Confirm the safety checkpoint | Clear step |
| 5 | 3 / Keep the recovery record | Clear step |
| 5 | What stays on your device | Clear section label |
| 5 | It does not replace Git | Ambiguous heading; **F-2-13** |
| 2 | Pro plan | Clear section label |
| 5 | Keep more encrypted recovery history | Understandable heading |
| 3 | Subscribe to Pro | Clear action |
| 5 | Have a license? Paste it | Clear form label |
| 2 | Restore license | Clear action |
| 2 | Desktop app | Clear section label |
| 6 | Choose the build for your computer | Clear heading |
| 3 | Download for Linux | Clear action |
| 2 | Apple silicon | Non-result control; **F-2-12** |
| 2 | Intel Mac | Non-result control; **F-2-12** |

## Copy audit — README

### Sentences and bullet statements

| Line | Words | Sentence or statement |
| ---: | ---: | --- |
| 3 | 8 | Reverse selected agent changes without losing unrelated work. |
| 5 | 14 | Change Recovery Ledger is a local desktop app for developers supervising long agent sessions. |
| 6 | 12 | It records the request, commands, files, and check result for each checkpoint. |
| 7 | 13 | Reverse selected files after a safety checkpoint, or export a patch for review. |
| 8 | 4 | Patches never run themselves. |
| 9 | 15 | Every desktop ledger uses a passphrase to encrypt snapshots, manifests, and retention settings on disk. |
| 11 | 6 | Use the one-click sample at agent-change-recovery.sociobot.in/?demo=1. **F-2-11** |
| 12 | 12 | It uses separate browser storage and removes sample changes when you leave. |
| 16 | 7 | Records only the project folder you choose. |
| 17 | 10 | Encrypts snapshots, manifests, retention settings, and Pro policy notes locally. |
| 18 | 7 | Skips `.git`, `node_modules`, `target`, and `dist` folders. |
| 19 | 5 | Skips files over 2 MB. |
| 20 | 7 | Compares each checkpoint with the previous checkpoint. |
| 21 | 18 | Lets you retain 2 or 7 recent checkpoints on the free plan, or 30 or 90 with Pro. |
| 22 | 8 | Creates a safety checkpoint before a selected-file reversal. |
| 23 | 8 | Exports a standard unified patch without applying it. |
| 24 | 9 | Loads a bundled sample project in the desktop app. |
| 25 | 8 | Deletes local checkpoint snapshots without changing project files. |
| 27 | 11 | The app is not Git and is not a backup service. |
| 28 | 6 | Keep normal version control and backups. |
| 32 | 5 | Requirements: Node.js 22 and npm. |
| 39 | 7 | Open `http://localhost:4173/?demo=1` to use the local sample. |
| 40 | 8 | Choose **Reset demo** for a clean browser sample. |
| 44 | 10 | Install the Tauri 2 system prerequisites for your operating system. |
| 51 | 10 | Choose **Load sample project** to try a disposable bundled project. |
| 52 | 7 | Choose **Reset sample project** to recreate it. |
| 53 | 13 | The desktop app never needs access to a real folder for that sample. |
| 54 | 12 | Enter a 12-character-or-longer local ledger passphrase before loading or opening a ledger. |
| 55 | 13 | The app keeps that passphrase only in memory while the ledger is open. **F-2-9** |
| 59 | 17 | Pro adds 30 or 90 checkpoint retention, an encrypted local team policy note, and password-protected recovery export. |
| 60 | 15 | The free plan remains useful: it keeps 2 or 7 checkpoints and exports standard patches. **F-2-15** |
| 61 | 10 | The published Pro plan costs $15 per developer each month. |
| 63 | 13 | Choose **Have a license? Paste it** to restore a purchase on another device. |
| 64 | 15 | The price and **Subscribe to Pro** action appear only after Sociobot publishes a working checkout. |
| 65 | 21 | The app verifies a saved license with Sociobot at most once each day and never sends project files with that request. |
| 66 | 12 | When checkout is available, Sociobot and Dodo are the merchant of record. **F-2-8** |
| 70 | 12 | The landing page selects a complete release that matches its own version. |
| 71 | 14 | It does not offer an older desktop build while the current release is publishing. |
| 72 | 17 | For macOS, it shows both Apple silicon and Intel downloads so you can choose the correct build. |
| 82 | 11 | The Linux and Windows scripts verify the published SHA-256 checksum first. **F-2-7** |
| 83 | 8 | macOS builds are unsigned during this release phase. **F-2-5** |
| 83 | 12 | The shell installer picks the matching Apple silicon or Intel disk image. **F-2-16** |
| 84 | 10 | Open the disk image, then move the app to Applications. |
| 85 | 10 | For an unsigned build, Control-click the app and choose **Open**. |
| 95 | 12 | `npm test` runs browser claims, routing, accessibility, mobile, privacy, and installer checks. |
| 96 | 10 | `npm run build` writes the static deployment output to `dist/site`. |
| 98 | 12 | The release workflow builds desktop packages on macOS, Windows, and Linux runners. **F-2-6** |
| 99 | 8 | Tag `v0.1.11` or later to start that workflow. |
| 100 | 11 | It publishes checksums and a release manifest with the desktop files. |
| 101 | 19 | Before the workflow passes, it verifies the exact tag, all desktop files, `SHA256SUMS`, and `latest.json` from the published release. |
| 102 | 14 | It also opens the Linux AppImage on Ubuntu 24.04 and rejects host-library module errors. |
| 106 | 11 | Project contents stay in the desktop app and encrypted ledger storage. **F-2-1** |
| 107 | **23** | Before a visitor starts checkout, the browser landing page asks GitHub for current public release filenames and Sociobot whether Pro checkout is published. **F-2-3** |
| 108 | 12 | It opens hosted checkout only after the visitor selects **Subscribe to Pro**. |
| 109 | 7 | See the in-product privacy policy and terms. |
| 113 | 1 | MIT. |
| 113 | 2 | See LICENSE. |

### README headings

All headings name their section without metaphor: Change Recovery Ledger (3),
What it does (3), Run the site and demo (5), Run the desktop app (4), Pro plan
(2), Install a release (3), Test and build (3), Privacy (1), and License (1).

### Terminology

| Concept | Terms found | Result |
| --- | --- | --- |
| Selected rollback | reverse | Consistent |
| Undo copy | safety checkpoint | Consistent |
| Recorded operation | checkpoint | Consistent |
| Encrypted store | ledger | Consistent |
| Export for review | patch; password-protected recovery file for `.crl` | Distinct formats are clear |
| Internal stored data | snapshot, manifest | Unexplained on landing; **F-2-14** |
| Paid plan | Pro | Consistent |
| Merchant | Sociobot; Sociobot and Dodo | Inconsistent; **F-2-8** |

## Demo and sandbox

- PASS: one click from the landing page opened `/?demo=1` with H1 “Inspect the
  failed session change”. The first viewport already showed four realistic
  checkpoints, a failed session refactor, the recorded intent, and file-level
  recovery state.
- PASS: the persistent banner says “Demo — sample data, nothing is saved” and
  exposes **Reset demo** and **Start for real**.
- PASS: reversing `src/auth/session.ts` and `src/editor/autosave.ts` wrote only
  `demo:agent-change-recovery:ledger`; a seeded `real:review-sentinel` remained
  unchanged.
- PASS: **Reset demo** removed the demo key and kept the real sentinel.
- PASS: **Start for real** removed the demo key, kept the real sentinel, opened
  `/app`, and exposed the desktop download.
- PASS: the complete live demo flow requested only
  `https://agent-change-recovery.sociobot.in`. No analytics, billing, GitHub, or
  other origin was contacted in demo mode.
- PASS: `@claim:offline-reload` used its own context and reloaded the populated
  demo offline after service-worker activation.

Evidence: `.factory/evidence/review-2-demo-mobile.png` and
`.factory/evidence/review-2-demo-desktop.png`.

## Registered claims

All 31 exact commands were run independently from a clean clone. The first
native attempt identified missing host GTK/WebKit development packages. After
installing the same packages declared by `.github/workflows/quality.yml`, every
native command was rerun and passed. A passing command is not treated as proof
where the assertion does not cover the claim; those cases point to findings.

| Claim | Command result |
| --- | --- |
| selective-reversal | PASS — `npm test -- --grep @claim:selective-reversal` |
| patch-export | PASS — `cargo test --manifest-path src-tauri/Cargo.toml claim_patch_export_is_standard_unified_diff_and_dry_runs` |
| demo-isolation | PASS — `npm test -- --grep @claim:demo-isolation` |
| offline-reload | PASS — `npm test -- --grep @claim:offline-reload` |
| pro-license | PASS — `npm test -- --grep @claim:pro-license` |
| pro-price | PASS — `npm test -- --grep @claim:pro-price` |
| license-daily-verification | PASS — `npm test -- --grep @claim:license-daily-verification` |
| local-privacy | PASS command; proof inadequate — **F-2-1** |
| local-encryption | PASS command; passphrase clause untested — **F-2-9** |
| retention-settings-encryption | PASS — exact command passed |
| retention-policy | PASS — exact command passed |
| retention-tiers | PASS — `npm test -- --grep @claim:retention-tiers` |
| team-policy-note | PASS — exact command passed |
| encrypted-recovery-export | PASS command; tag mismatch — **F-2-10** |
| encrypted-recovery-import | PASS command; tag mismatch — **F-2-10** |
| chosen-folder-only | PASS — exact command passed |
| large-file-skip | PASS — exact command passed |
| git-metadata-exclusion | PASS — exact command passed |
| generated-folder-exclusions | PASS — exact command passed |
| checkpoint-record | PASS — exact command passed |
| checkpoint-comparison | PASS command; does not prove current-folder copy — **F-2-4** |
| reversible-safety-checkpoint | PASS — exact command passed |
| ledger-deletion | PASS — exact command passed |
| bundled-sample-project | PASS — exact command passed |
| platform-download | PASS — `npm test -- --grep @claim:platform-download` |
| release-candidate-identity | PASS — `npm test -- --grep @claim:release-candidate-identity` |
| release-request-privacy | PASS — `npm test -- --grep @claim:release-request-privacy` |
| linux-installer | PASS — `npm test -- --grep @claim:linux-installer` |
| windows-installer | PASS command; outcome not exercised — **F-2-7** |
| unsigned-macos | PASS command; artifact not inspected — **F-2-5** |
| release-platforms | PASS command; builds not exercised — **F-2-6** |

The exact commands for the rows abbreviated as “exact command passed” are
recorded verbatim in `.factory/claims.json`; none was combined or skipped.

## Structure, accessibility, links, and identity

- PASS: `/`, `/demo`, `/app`, `/privacy`, `/terms`, and a real missing URL each
  have the route-specific title pattern, one H1, one main landmark, `lang=en`, a
  description, canonical, Open Graph fields, favicon, and apple-touch icon.
- PASS: `/missing-sheet` returns HTTP 404 and shows a designed recovery-sheet
  page with a home action. Its shared-structure mismatch is F-2-2.
- PASS: header **Privacy** followed by Back at 390 px restored `/` to
  `scrollY=0`, focused the landing H1, and kept it in view. Deep links and route
  announcements worked.
- PASS: all discovered first-party pages, anchors, the current Linux release,
  GitHub releases, Sociobot, and the checkout destination resolved. `mailto:`
  links were explicit exceptions. The missing page’s own skip link naturally
  retains its 404 status and is not a dead destination.
- PASS: live Playwright Axe scans at 390 px reported zero violations on all six
  routes. The standalone Axe CLI could not pair its bundled ChromeDriver 152
  with the preinstalled Chromium 145; the repository’s Playwright Axe
  integration ran against that preinstalled browser instead.
- PASS: `npm test` completed 38/38. `npm run build` produced `dist/site`; initial
  JavaScript is 43.03 KB raw / 13.69 KB gzip.
- PASS: `scripts/verify-url.sh` passed `/`, `/?demo=1`, `/app`, `/privacy`, and
  `/terms`. A real 404 contains valid title/lang/main/H1/alt data; Chromium also
  reports the expected failed-document 404 as a console resource error.
- PASS: the paper, risograph inks, taped evidence, clipped shapes, and
  registration marks are a distinct product identity, not a generic centered
  SaaS hero or three-card template.

## Earlier-finding verification

Every finding from `.factory/review-1.md` was rechecked against live behavior
and source. “Fixed” below means the original quoted issue is absent and the
replacement behavior was verified.

| Earlier ID | Result this round |
| --- | --- |
| F-1-1 | Fixed: mobile header Privacy → Back restores `scrollY=0` and focuses the visible H1. |
| F-1-2 | Fixed: reset and exit remove all `demo:` keys and preserve the real sentinel. |
| F-1-3 | Fixed: demo exit opens `/app` with a resolved desktop download. |
| F-1-4 | Fixed: bundled sample command, reset, isolated sentinel, and reversal test pass. |
| F-1-5 | Fixed: live Pro price and checkout action are present; checkout resolves HTTP 200. |
| F-1-6 | **Reopened as F-2-1:** the listener assertion does not observe capture egress. |
| F-1-7 | Fixed: action note and all facts fit inside 390×844. |
| F-1-8 | **Reopened as F-2-2:** 404 metadata is fixed, but shared header/footer remain inconsistent. |
| F-1-9 | Fixed: route render updates OG and Twitter title/description. |
| F-1-10 | Fixed: “RECOVERY / 001” is absent. |
| F-1-11 | Fixed: caption is “Reverse one file / keep the rest”. |
| F-1-12 | Fixed: label is “Loaded checkpoint preview”. |
| F-1-13 | Fixed: heading is “Reverse selected changes in three steps”. |
| F-1-14 | Fixed: heading is “See one selected file reversed”. |
| F-1-15 | Fixed: “sidecar” is absent from landing and README. |
| F-1-16 | Fixed: action is “Open sample recovery”. |
| F-1-17 | Fixed: the former 23-word recovery instruction is absent. |
| F-1-18 | Fixed: Linux instructions are split and under 22 words. |
| F-1-19 | Fixed: workflow prose is split and has a registered candidate-identity claim. |
| F-1-20 | **Reopened as F-2-3:** the replacement request sentence is still 23 words. |
| F-1-21 | Fixed: README uses “desktop app”, not “sidecar”. |
| F-1-22 | Fixed: “full recovery path” is absent. |
| F-1-23 | Fixed: “verifier sandbox” is absent. |
| F-1-24 | Fixed: generated folders are named plainly and all four are tested. |
| F-1-25 | Fixed: current-release selection is stated plainly and fixture-tested. |
| F-1-26 | Fixed: normal rollback consistently uses “reverse”. |
| F-1-27 | Fixed: checkpoint request, commands, files, and check result are registered and tested. |
| F-1-28 | **Reopened as F-2-4:** prior-checkpoint comparison does not test current-folder comparison. |
| F-1-29 | Fixed: all 2/7/30/90 retention options and pruning behavior are tested. |
| F-1-30 | **Reopened as F-2-5:** workflow string absence does not inspect artifact signatures. |
| F-1-31 | Fixed: vague OS warning was replaced with explicit macOS instructions. |
| F-1-32 | **Reopened as F-2-6:** runner-name inspection does not prove published working packages. |
| F-1-33 | Fixed: unsupported app-data location claim is absent. |
| F-1-34 | Fixed: all four directory exclusions are registered and tested. |
| F-1-35 | Fixed: three captures prove comparison with the previous snapshot. |
| F-1-36 | Fixed: browser download fixtures cover Linux, Windows, Intel Mac, and Apple silicon. |
| F-1-37 | **Reopened as F-2-7:** Windows script is inspected as text, not executed. |
| F-1-38 | Fixed: code sends only the encoded license in the exact Sociobot verification URL. |
| F-1-39 | Fixed: a cached reload test confirms one verification request per day window. |
| F-1-40 | Fixed: landing request log permits only first-party, GitHub, and Sociobot origins. |
| F-1-41 | Fixed: metadata and copy say “export”, not “replay”. |
| F-1-42 | **Reopened as F-2-8:** merchant language returned and is inconsistent/unlisted. |
| F-1-43 | Fixed: the unsupported “built only in GitHub Actions” statement is absent. |
| F-1-44 | Fixed: the untested confirmation-count statement is absent from README. |

## Missed leverage

No AI feature is expected here. Reversal and patch construction are
deterministic, high-risk operations where generated output would reduce trust.
The product already has patch export, password-protected recovery import/export,
and a local-only model; cloud sync would conflict with that stated boundary.
No missed-leverage finding is added.

## What would make this perfect

Close every finding above. In particular, replace configuration/source-string
checks with outcome-level native and release tests, prove native egress and
passphrase handling, add a real current-folder comparison claim, unify the 404
shell, remove or prove merchant language, and clear every copy flag. Then rerun
the entire cold-read, demo, claim, structure, accessibility, link, and history
checklist from a clean clone. There is not yet an honest “nothing left to do”
conclusion.
