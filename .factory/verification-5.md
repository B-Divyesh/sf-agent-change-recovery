# Independent product verification 5 — FAIL

- Candidate commit: `037b90b8c5729e384272244d1cdc0771c33ecc9b`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Verified: 2026-08-29 12:19 UTC
- Worktree: detached clean worktree at the candidate; pre-existing `graphify-out`
  changes in `/work/repo` were not used or modified
- Scope: every declared claim command, clean installs, full browser and native
  suites, static and Linux desktop production builds, packaged-app filesystem
  recovery, live desktop/mobile/accessibility/privacy/PWA checks, release
  artifacts, installer behavior, headers/caching/budgets, and hosted endpoint
  limits

## Release decision

**FAIL — do not promote this candidate.** The earlier static deployment repair
is live and works, and the core selective restore succeeds. However, a real
desktop reversal creates a safety checkpoint with zero selectable files, so
the safety checkpoint cannot undo a mistaken reversal. Buy Pro still returns
404. The Linux one-line installer downloads a non-executable AppImage to
`/tmp` instead of installing it. The privacy page promises an in-app ledger
deletion control that does not exist.

## Mandatory first checks

### Cold first-read: PASS

Fresh Chromium at `/` answered all three questions on the first screen:

- What: **“Reverse the wrong agent changes.”**
- For whom: **“For developers supervising long agent sessions who need to
  recover one change without discarding the rest.”**
- First action: **“Try it with sample data,”** followed by **“A loaded ledger
  opens next. Nothing is saved to your data.”**

The action reached `/demo` in one click. The first demo screen contained four
realistic files and four checkpoints. Its persistent banner said “Demo —
sample data, nothing is saved” and exposed Reset demo and Start for real.

### Claims gate: PASS after documented system installation

`.factory/claims.json` exists with 12 entries. From the detached clean
candidate worktree, `npm ci` passed. The first native invocations stopped in
dependency compilation because the base worker image lacked `glib-2.0.pc`.
The repository documents Tauri system prerequisites, and both CI workflows
install them. After installing the exact workflow packages
(`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`),
every exact command passed, including repeated commands:

| Claim | Exact command/result |
| --- | --- |
| `selective-reversal` | `npm test -- --grep @claim:selective-reversal` — PASS, 1 test |
| `patch-export` | `npm test -- --grep @claim:patch-export` — PASS, 1 test |
| `demo-isolation` | `npm test -- --grep @claim:demo-isolation` — PASS, 1 test |
| `local-privacy` | `cargo test --manifest-path src-tauri/Cargo.toml project_files_stay_within_the_chosen_folder` — PASS, 1 test |
| `offline-reload` | `npm test -- --grep @claim:offline-reload` — PASS, 1 test |
| `price` | `npm test -- --grep @claim:price` — PASS, 1 test |
| `free-history-limit` | `cargo test --manifest-path src-tauri/Cargo.toml free_history_stops_after_seven_checkpoints` — PASS, 1 test |
| `encrypted-export` | `cargo test --manifest-path src-tauri/Cargo.toml encrypted_export_has_versioned_header_and_hides_plaintext` — PASS, 1 test |
| `git-metadata-exclusion` | `cargo test --manifest-path src-tauri/Cargo.toml excludes_git_metadata_from_checkpoints` — PASS, 1 test |
| `chosen-folder-only` | the folder-boundary Cargo command above — PASS again |
| `large-file-skip` | `cargo test --manifest-path src-tauri/Cargo.toml skips_files_larger_than_two_megabytes` — PASS, 1 test |
| `free-safety-and-patch-export` | `npm test -- --grep @claim:free-safety-and-patch-export` — PASS, 1 test |

The claims manifest still has a governance defect: five native entries have no
`@claim:<id>` tag, contrary to the claims contract. Also, the privacy claim
tag in Playwright is not the command declared for `local-privacy`.

## Release-blocking findings

### Severity 0 — automatic safety checkpoints cannot undo a reversal

A packaged-app run exercised the real Rust filesystem path, not demo state:

1. Created `alpha.txt = "baseline alpha"` and
   `keep.txt = "keep baseline"` in a temporary project.
2. Captured “Baseline before agent.”
3. Changed both files to `wrong alpha` and `unrelated keep edit`, then captured
   “Agent changed both files.”
4. Selected only `alpha.txt` and chose Create checkpoint and reverse.

Selective restore itself worked: `alpha.txt` returned to `baseline alpha`,
`keep.txt` remained `unrelated keep edit`, and a third checkpoint directory
was written. The third manifest, however, was:

```json
{
  "intent": "Safety checkpoint before reversal",
  "files": [],
  "safety": true
}
```

Its snapshot folder contains the pre-reversal `wrong alpha` file, but the UI
shows “0 files” and disables Reverse and Export. There is no way to select the
stored file from this checkpoint. Therefore the supposedly reversible safety
step cannot recover from a mistaken reversal and can cause loss of the state
it claims to protect.

### Severity 1 — advertised paid checkout is unavailable

Fresh request on 2026-08-29:

```text
GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout
HTTP 404
{"error":"enabled factory product","status":404}
```

The landing page advertises Pro for $15 per developer each month and exposes
Buy Pro, but no buyer can reach checkout. This repeats the prior external
blocker and is independently confirmed.

The verification endpoint does enforce a per-client allowance: requests
1–30 returned 200 with an invalid-license verdict; request 31 returned 429
with `Retry-After: 3`. Observed allowance: **30 requests per client window**.

### Severity 1 — the Linux one-line installer does not install a runnable app

The live `/install.sh` is byte-identical to the candidate and verifies the
release checksum. Running it exited 0 and printed:

```text
Downloaded and verified Change.Recovery.Ledger_0.1.1_amd64.AppImage at
/tmp/recovery-ledger-Change.Recovery.Ledger_0.1.1_amd64.AppImage
Open the file to finish installation.
```

The downloaded file had mode `0644`, so it was not executable. The script did
not `chmod +x`, move the AppImage to a stable location or PATH, create a
desktop entry, or launch it. This fails the installable-software contract and
the script's purpose.

### Severity 1 — promised deletion of sensitive ledgers is absent

The landing page, privacy page, and README tell users to delete project
ledgers in the desktop app. Checkpoints may contain secrets. The UI exposes no
delete action, and the Rust command set contains only capture, restore, patch
export, and encrypted export. Source search found no ledger-deletion command.
This is both an unlisted/false claim and a missing privacy control.

### Severity 1 — encrypted recovery exports cannot be opened or imported

Pro advertises a passphrase-encrypted recovery export, and the dialog says the
passphrase is needed to open the `.crl` file. The app implements only
encryption/export. It contains no import, decrypt, or documented recovery
command. The unit test proves a `CRL1` ciphertext is written, but no user can
turn that export back into a patch with the shipped product.

### Severity 2 — mobile links miss the 44 px touch-target baseline

At 390 px, no route overflowed and the primary controls were usable. However,
measured visible link boxes included 18 px-high menu links, 15 px-high legal
links, a 32 px-high wordmark, and a 36 px-high “Try this recovery” link. This
fails the attached accessibility/design touch-target requirement even though
Axe reports no automated violation.

### Severity 2 — displayed build identity is stale

The live footer says `v0.1.0 · build 2026.08.28`, while the package, current
release, and application config are `0.1.1`. The candidate is a descendant of
the `v0.1.1` tag. The product assets are unchanged after that tag, but the
visible version is still inaccurate.

## Functional and recovery evidence

- Full browser suite: `npm test` — **20/20 passed**.
- Native suite: `cargo test --manifest-path src-tauri/Cargo.toml` — **9/9
  passed**.
- `cargo check`, `cargo fmt -- --check`, and
  `cargo clippy --all-targets -- -D warnings` — PASS.
- `npm audit --audit-level=high` — zero vulnerabilities.
- Exact static production build: `npm run build` — PASS; `dist/site` created.
- Exact Linux Tauri release build:
  `CI=true npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb`
  — PASS. The worker exports `CI=1`, which Tauri rejects as an invalid boolean;
  overriding it to GitHub Actions' `CI=true` allowed the documented build.
- Native selective reversal: PASS for one of two changed files; the unrelated
  file was preserved.
- Native patch export: contained only `alpha.txt` and passed
  `patch --batch --dry-run -p1` against the restored fixture.
- Browser demo boundaries: zero selected files disabled Reverse and Export;
  four selected files produced an explicit four-file confirmation.
- Demo reset removed only `demo:` keys and preserved a `real:sentinel` key.
- Invalid license input produced an actionable message, an invalid token
  returned a 200 invalid verdict, and the token was not retained.

## Live UX, accessibility, privacy, and PWA evidence

- Desktop and 390 px layouts: no horizontal overflow; 320 px smoke checks on
  `/`, `/demo`, and `/privacy` also had no overflow.
- Keyboard: Tab order reached skip link, wordmark, menu, and primary action;
  focused controls showed a 4 px process-blue outline. The mobile menu opened
  with Enter. Dialog focus began on Keep files, wrapped with Shift+Tab, and
  Escape restored focus to the Reverse trigger.
- Route navigation moved focus to the new `h1`; browser Back restored URL and
  title.
- Reduced motion: animation name `none`, animation/transition duration
  `0.01ms`, scroll behavior `auto`.
- Axe Playwright scans on `/`, `/demo`, `/app`, `/privacy`, and `/terms`:
  **zero violations at any impact**, including zero serious/critical.
- All five routes returned 200 with `lang=en`, one `h1`, one `main`, unique
  titles, and no console/page errors.
- Styled unknown route returned 404 with its own title, one `h1`, one `main`,
  zero serious/critical Axe findings, and a working 200 stylesheet. Chromium
  logged only the expected top-level 404 resource message.
- Factory `verify-url.sh`: PASS; 855 ms load, no console errors, title/lang/
  h1/main/alts/buttons all valid.
- Demo recovery request log: only
  `https://agent-change-recovery.sociobot.in`. Landing additionally contacted
  only the disclosed GitHub release API. Explicit license verification
  contacted only `api.sociobot.in`. No analytics, font CDN, Azure endpoint, or
  other third party was observed.
- Fresh PWA run: active `/sw.js`, controller present,
  `recovery-ledger-v3` contained `/` and `/demo`, `registration.update()`
  completed, and offline `/demo` reload showed the sample ledger plus offline
  notice without errors.
- Security headers: response-header CSP with `frame-ancestors 'none'`, HSTS,
  `nosniff`, strict-origin referrer policy, and restrictive permissions
  policy. Hashed assets are cached immutable for one year; `sw.js` is
  `no-cache`; HTML revalidates after 30 seconds.

## Performance and deployment identity

Mobile Lighthouse after a container-safe rerun:

- Performance **99**
- Accessibility **100**
- Best practices **100**
- SEO **100**
- FCP 956 ms; LCP 1,899 ms; TBT 24 ms; CLS 0

Production bundle:

- JS: 31.54 KB raw / 10.57 KB gzip
- CSS: 14.87 KB raw / 4.18 KB gzip
- Mobile hero: 41.1 KB; full hero: 182.4 KB; no font download
- Initial Lighthouse transfer: 312.3 KB total, including 10.7 KB script and
  4.3 KB stylesheet

Candidate build and live assets are byte-identical:

```text
JS  7352726154b47ba4ceb0f2b7795d926f51a6c780d583e9fd9fa550687d342f35
CSS 259da7398dab78a502b0c5ceb2c64a9b7326e8c52e21d603c26ee0b875113db2
```

`v0.1.1` targets `8198bfe724ae61f3039d366373c79f419c54bc18`. There
are no product-source changes between that tag and candidate `037b90b`; the
later commits change only factory evidence/handoff/analysis files. Candidate
GitHub checks `test` and `rust` both passed.

## Release artifact evidence

- `v0.1.1` is published, non-draft, and non-prerelease.
- Assets exist for macOS arm64/x64, Windows MSI/EXE, Linux AppImage/DEB/RPM,
  plus `SHA256SUMS` and valid `latest.json`.
- Downloaded Debian SHA-256:
  `814a9faedc2b2efad39a6a62cb521569a1d7082d5aeeb5aab049af9e425999b5`;
  exact match in `SHA256SUMS`.
- Debian metadata: package `change-recovery-ledger`, version `0.1.1`, amd64.
- Published Debian binary and locally built release binary each stayed alive
  for 12 seconds under Xvfb. Their only log was the expected headless X server
  DRI3 acceleration warning.
- The landing Linux download resolved to the real `v0.1.1` AppImage; the asset
  endpoint returned 200.

## Required remediation

1. Make a pre-reversal safety checkpoint expose the protected files and add a
   tested undo path; seed a real filesystem integration test for reverse →
   undo that preserves unrelated work.
2. Register/enable `agent-change-recovery` in Sociobot billing and verify a
   real hosted-checkout redirect.
3. Make `/install.sh` produce a runnable installed app (at minimum executable,
   stable location/PATH or desktop entry) and test from a clean consumer.
4. Add and test in-app ledger deletion, including confirmation and storage
   removal, or remove the privacy promise until it exists.
5. Add a documented/tested `.crl` import/decrypt path so encrypted exports are
   recoverable.
6. Increase every mobile interactive target to at least 44×44 CSS px.
7. Correct the visible version/build identity and align every native claim
   with one `@claim:<id>` test.
