# Venture plan — Change Recovery Ledger

**Plan status:** created 2026-09-05 after source, release, live-site, and QA audit.
**Current product milestone:** **M2 — commercial activation and release provenance, not yet accepted.**
**Next milestone:** finish M2; do not start M3 scope until M2 has independent evidence.

## Decision and status

Change Recovery Ledger is a local desktop recovery tool for developers who
supervise long agent sessions. It captures a chosen folder, keeps the request,
commands, changed files, and check result together, then lets the developer
reverse selected files after a safety checkpoint or export a patch for review.
It does not run an exported patch.

The public product has a real, useful M1 core. The repository contains a Tauri
2 desktop application, a browser-only sample, and desktop releases at v0.1.12.
The live site is available at
`https://agent-change-recovery.sociobot.in`.

The distinction below is deliberate:

| Area | Status | What the evidence proves | What it does not prove |
| --- | --- | --- | --- |
| M1 local recovery core | **Accepted** | Selected-file reversal, a preceding safety checkpoint, standard text-patch export, encryption, retention, path boundaries, the desktop sample, and the one-click browser demo pass behavioral tests. Published desktop files exist for macOS, Windows, and Linux. | A pilot developer's five-minute recovery outcome; this has not been measured. |
| M2 local persistence and Pro activation | **Implemented / partly demonstrated; not accepted** | Encrypted local ledger storage and fixture-backed license, price, retention, policy-note, encrypted recovery, and daily-verification flows pass. The live public catalog lists $15 USD and checkout returns a hosted HTTP 303 redirect. | A controlled buyer completing checkout and restoring an issued license in the current packaged desktop app. There is no evidence of accounts, tenant isolation, or a production transaction. |
| M3 second/third jobs and pilot proof | **Not accepted** | Current-folder comparison and encrypted recovery import/export have native tests. | A complete milestone outcome, user success-rate evidence, team collaboration, cloud backup, automatic command capture, or replay. None of those is a shipped claim. |

### Exact current blockers

1. **Current-source release parity is unverified.** `main` (`ae7f7ae`) is ahead
   of the `v0.1.12` tag (`7dc899d`). The delta includes a web history-state
   repair in `src/main.ts`; v0.1.12 desktop assets therefore cannot prove that
   they contain the current source. `scripts/verify-published-release.mjs`
   verifies published checksums and permits an ancestor release, not exact
   current-commit identity. Tag and release the current intended product
   commit, then verify target commit, hashes, manifest, and one installed
   artifact per platform.
2. **Paid entitlement is not end-to-end accepted.** On 2026-09-05 the public
   catalog and checkout redirect were reachable, but this audit did not and
   must not create a paid order or use production credentials. A controlled
   billing test must prove checkout return, device-local license storage, a
   valid verdict in the packaged app, daily-cache behavior, and revocation or
   expiry locking. Fixture tests are not that proof.
3. **The success measure is untested.** No evidence shows that pilot developers
   recover a seeded mistaken change in under five minutes in 80% of scenarios.
   The current claims prove mechanics, not this customer outcome.
4. **Distribution signing remains an operator decision.** The released macOS
   and Windows packages are unsigned. This is not a core local-recovery defect
   and is not claimed as completed; signing needs owner certificates and a new
   release verification.

## PRD

### Customer, situation, and promise

The customer is a developer supervising an agent across a long session. When
one file group becomes suspect, today's choices are Git reflog, hand-made
patches, resetting files, or discarding unrelated work. The promise is:

> Inspect and reverse the selected agent changes without discarding unrelated work.

### Jobs to nail

1. **Recover one bad file group:** capture a local checkpoint, inspect its
   intent/commands/files/check result, select affected files, create a safety
   checkpoint, and reverse only those files.
2. **Understand drift before acting:** compare a saved checkpoint with the
   current chosen folder and keep a readable command trail.
3. **Hand off a reviewed recovery:** export a standard patch, or where Pro is
   active, password-protect a recovery file. The application never applies or
   runs a patch.

### Monetisation and deliberate non-goals

The researched offer is **$15 per developer per month** for longer retained
history, a local team policy note, and encrypted recovery export. The public
Sociobot catalog presently advertises this price; M2 must prove the entitlement
path before treating subscription conversion as accepted.

Out of scope for M1–M3: cloud code backup, Git replacement, silently altering
Git history, running/replaying an agent, automatic patch application, hosted
project storage, shared workspaces, messaging, HMRC access, or product sign-in.
There is no current tenant model, so tenant isolation must not be claimed.

## Evidence and wedge

- HN discussion: <https://hn.algolia.com/api/v1/items/49444984> (2026-08-26)
  records developers dealing with much larger, more numerous agent-assisted
  PRs.
- Codex issue: <https://github.com/openai/codex/issues/9203> (2026-01-14) has
  a 461-reaction request for restoring `/undo` after unintended changes.

The wedge is semantic, selected-file recovery: Git stores history and editor
undo stores edits, but neither joins an agent request, command trail, file
group, check result, and a safety-first partial reversal in one local record.

## M1–M3 delivery contract

### M1 — local recovery core (accepted)

**Scope:** landing and isolated demo; desktop capture of a chosen folder;
encrypted checkpoints; prior/current comparison; selected-file reversal with a
safety checkpoint; non-executing text-patch export; bundled sample; accessible
local experience and cross-platform release workflow.

**Accepted definition of done:**

- A fresh visitor reaches `?demo=1` in one click, sees realistic checkpoints,
  can reset/leave without touching real browser state, and can use it offline
  after the first visit.
- In the native core, selected reversal preserves unselected files, blocks
  unsafe paths/symlink escapes, and creates the safety checkpoint before
  writing project files.
- Patch export is a standard unified text diff that GNU `patch --dry-run`
  accepts; binary selections are rejected; no action runs a patch.
- Local ledger content and settings are encrypted; passphrases and selected
  project contents do not leave the process in the native privacy test.
- Current public M1 claims pass from their exact commands in
  `.factory/claims.json`, particularly `one-click-demo`, `demo-isolation`,
  `offline-reload`, `selective-reversal`, `patch-export`, `local-privacy`,
  `local-encryption`, `chosen-folder-only`, `reversible-safety-checkpoint`,
  `checkpoint-record`, `checkpoint-comparison`,
  `current-folder-comparison`, and `bundled-sample-project`.

**Acceptance evidence:**

- `.factory/verification-12.md` — independent PASS of the earlier candidate
  and its v0.1.11 release.
- `.factory/polish-2.md` and `.factory/evidence/polish-2-live.json` — v0.1.12
  live demo, offline, mobile, metadata, and accessibility evidence.
- `.factory/evidence/polish-2-release.json` — v0.1.12 release jobs, checksum
  manifest, Linux AppImage smoke, and Windows install/launch evidence.
- Current audit on 2026-09-05: `npm test` (39 passed),
  `npm run test:claim-tags` (33 claims), `npm run build`,
  `npm run test:claims` (all 33 exact commands),
  `scripts/verify-url.sh https://agent-change-recovery.sociobot.in`, and
  `node scripts/verify-published-release.mjs` passed.

### M2 — commercial activation and exact release provenance (next; not accepted)

**Scope:** finish the already-present local persistence and Pro entitlement
path. This milestone does not add cloud accounts or a tenant service. It makes
the device-local license state and published desktop binary verifiable.

**Required work and definition of done:**

1. Release the intended current commit under an exact version/tag relationship.
   The GitHub release target must equal the intended source commit; its
   `SHA256SUMS` and `latest.json` must list all macOS arm64/x64, Windows, and
   Linux artifacts. The live static build and one downloaded desktop artifact
   must identify the same product version.
2. Use a factory-controlled billing test path, not production credentials, to
   complete checkout and return a test license. In the packaged desktop app,
   restore that license, verify Pro status once, reload inside 24 hours without
   another verification, then verify that a revoked/expired fixture locks Pro.
   Record only redacted result/status evidence; never log a license token.
3. Pro controls remain local: 30/90 retention, encrypted policy note, and
   password-protected recovery export/import must be gated by a verified
   entitlement in the packaged app. Free patch export and safety behavior stay
   ungated.
4. Rerun the current exact claims `pro-license`, `pro-price`,
   `license-daily-verification`, `retention-tiers`, `team-policy-note`,
   `encrypted-recovery-export`, `encrypted-recovery-import`,
   `release-candidate-identity`, `release-platforms`, and all installer claims.
   Add one packaged-app integration test that uses a recorded/redacted billing
   response and cannot pass merely because browser CORS is permissive.

**Acceptance criteria:** a verifier can trace current commit → release target →
checksums/manifest → installed app, and can observe a valid controlled license
unlock and a negative verdict relock without project data sent to billing.

**External gate:** Sociobot billing must supply/publish a controlled test
product and license-return evidence. The planner and product worker must not
request or handle production payment credentials.

### M3 — prove the remaining jobs with a pilot (pending; do not present as shipped)

**Scope:** validate the second and third jobs in realistic recovery scenarios,
then decide whether command capture needs an explicit local integration. The
product currently lets a developer type commands; it does not automatically
observe or run an agent.

**Required work and definition of done:**

1. Define at least five seeded scenarios with a mistaken subset and unrelated
  changes. Measure time from opening the checkpoint to a reviewed selected
  reversal or exported patch. At least 80% of pilot attempts must finish under
  five minutes without discarding unrelated work.
2. Exercise **Compare with folder** and patch/recovery handoff in those
  scenarios. Record whether the command trail and check result were sufficient
  to make the selection; do not substitute a static demo for this result.
3. If pilots show missing agent context, add only a local, explicit import of
  an agent transcript/command log. Show the exact data before saving it,
  encrypt it in the same local ledger, and retain the no-auto-run rule.
4. Add outcome tests and a repeatable pilot fixture. Any new visitor-facing
  claim must be added to `.factory/claims.json` with exactly one tagged test.

**Acceptance criteria:** the success measure is met with documented seeded
evidence, current-folder comparison guides a selective recovery, and recovery
handoff remains non-executing. Team sharing, cloud sync, accounts, and agent
execution remain out of scope unless new research changes this plan.

## Architecture and data boundaries

### Current architecture

- **Desktop:** Tauri 2. Rust owns filesystem capture, encryption, comparison,
  reversal, patch/recovery generation, and the narrow billing requests. Vite +
  TypeScript renders the desktop UI and static public site.
- **Public site/demo:** static Vite output plus a service worker. The browser
  demo is a sample only; browser code cannot capture a real project folder.
- **Release:** GitHub Actions builds macOS arm64/x64, Windows, and Linux
  desktop files, then publishes checksums and `latest.json`.
- **No product backend:** there is no API, shared PostgreSQL, hosted project
  database, background job, email, analytics pipeline, sign-in, or tenant
  directory. `/data` and SQLite are therefore not used by this desktop-local
  product. If a future product backend is authorised, it must use product-owned
  SQLite on `/data`; it must not repurpose the local recovery ledger into shared
  storage without a new privacy and tenancy design.

### Data ownership and flow

| Data | Owner/location | Boundary |
| --- | --- | --- |
| Chosen project files, request, command trail, file metadata, checkpoints, retention, Pro policy | User device; OS app-local ledger store | Read only from the selected project. Checkpoint/snapshot/settings files are encrypted with a local passphrase. No claim of a shared tenant boundary. |
| Safety checkpoint and patch/recovery exports | User device; app-local exports | Explicit user action. A patch is written for review and never executed by the app. |
| Bundled desktop sample | User device; separate `sample-project` under app data | Reset recreates it; it does not read a real project folder. |
| Browser demo | Browser `localStorage` key `demo:agent-change-recovery:ledger` | Separate from real desktop state; reset/exit removes demo keys. |
| Release cache, license token, daily verdict cache | Browser local storage on the public/desktop UI | Only license state is sent to Sociobot for verification. Project contents, commands, paths, and patches must not be sent. |

### External dependencies (separate from implementation status)

| Dependency | Current evidence | Dependency boundary |
| --- | --- | --- |
| GitHub Releases/API | Current v0.1.12 artifacts and checksums verified on 2026-09-05. | Needed to resolve/download desktop files. It does not store project data. |
| Sociobot product catalog and hosted checkout | Public product listed at $15 USD; checkout returned HTTP 303 on 2026-09-05. | Needed for display and checkout navigation only. A redirect does not prove an order, subscription, or issued license. |
| Sociobot license verification | Code and mocked/recorded tests exist. | Needed to activate Pro on a device. A real valid-license packaged-app proof is still an M2 gate. |
| macOS notarization / Windows Authenticode | Not configured. | Optional trust/distribution work; requires owner certificates. Do not claim signed packages. |

No messaging provider, HMRC integration, identity/sign-in provider, analytics
service, shared database, or cloud file storage is implemented or required for
M1–M3.

## Design and quality system

The recorded visual system is the risograph recovery sheet in
`.factory/design.md`: warm paper, ink/orange/blue/moss tokens, heavy system
display type with monospace utility type, 8px rhythm, registration-mark motion,
and a single explicit light treatment. It uses original locally generated art
with provenance in that document. The product retains semantic routes,
landmarks, focus restoration, 44px controls, a skip link, visible focus,
reduced-motion handling, and a local service-worker demo.

Every current visitor-facing statement remains governed by the 33 entries in
`.factory/claims.json`. New M2/M3 claims are not considered shipped until they
have one exact behavioral command and a clean execution result.

## Verification ledger and handoff rules

Before accepting M2 or M3, a worker must preserve the existing repair and
verification evidence, run the exact claim commands from a clean clone, run
`npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, native privacy,
build, accessibility/URL checks, and release verification, then write a new
milestone handoff. A demo, a mocked catalog, a fixture license, a checksum, or
a visible button cannot by itself prove a real billing lifecycle, sign-in, or
tenant isolation.

The current handoff remains `.factory/handoff.md`; its historical PASS applies
to the evidence recorded there, not automatically to a later source commit or
future milestone.
