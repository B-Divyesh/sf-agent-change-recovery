# Independent product verification 6 — PASS

- Candidate commit: `73c4eaa90eb3eff9885d9526490a5b49adebde7d`
- Live URL: <https://agent-change-recovery.sociobot.in>
- Verified: 2026-08-29 UTC
- Scope: clean-install browser/native tests, declared claims, production site and
  desktop builds, deployed-app recovery flow, privacy/network behavior, PWA,
  accessibility, release artifacts, headers, caching, and unlock rate limit.

## Decision

**PASS.** The deployed application matches the candidate's shippable product
files and meets the researched brief's selective-recovery job. No release
blocking defects were found.

`73c4eaa` changes factory documentation and generated `graphify-out` metadata
after the `v0.1.2` product release. A fresh local production build produced
`index-D95gphMx.js` and `index-DWKUmUR-.css`; their SHA-256 values exactly
match the same assets served by the live deployment. The live product is
therefore the candidate's effective product tree.

## First-read and demo gate

Fresh live Chromium at `/` answered the required questions on its first
screen:

- Does: **“Reverse the wrong agent changes.”**
- For: **“For developers supervising long agent sessions who need to recover
  one change without discarding the rest.”**
- First action: **“Try it with sample data”**, with **“A loaded ledger opens
  next. Nothing is saved to your data.”**

The action is one click to `/demo`, where a realistic four-checkpoint
`acme-web` ledger is already loaded. The persistent banner says **“Demo —
sample data, nothing is saved”** and provides Reset demo and Start for real.

## Claims gate

`.factory/claims.json` exists with 16 entries. Before wider inspection I ran
every declared command. The subsequent full suites independently exercised
all of the same tagged browser tests (23/23) and native claim tests (13/13).

| Claim | Result |
| --- | --- |
| selective-reversal | PASS — selected files reverse while unrelated files remain |
| patch-export | PASS — selected-only unified patch dry-runs; nothing runs |
| demo-isolation | PASS — only `demo:` state is reset |
| local-privacy | PASS — capture reads the chosen folder only |
| offline-reload | PASS — cached demo reloads offline |
| price | PASS — exact $15 copy and no unpublished purchase link |
| free-history-limit | PASS — free capture stops after seven; Pro permits more |
| encrypted-export | PASS — CRL1 encrypted output contains no plaintext secret |
| git-metadata-exclusion | PASS — `.git` is absent from snapshots |
| chosen-folder-only | PASS — adjacent sentinel is not read |
| large-file-skip | PASS — files over 2 MB are skipped |
| free-safety-and-patch-export | PASS — both free controls complete |
| reversible-safety-checkpoint | PASS — safety snapshot restores only the selected file |
| ledger-deletion | PASS — snapshots are removed without changing project files |
| encrypted-import | PASS — correct passphrase yields reviewable patch, never runs it |
| linux-installer | PASS — checksum verification, stable executable install, and launch |

## Local build and desktop evidence

```text
npm ci                                      PASS; 0 vulnerabilities
npm test                                    PASS; 23/23
cargo test --manifest-path src-tauri/Cargo.toml
                                             PASS; 13/13
cargo check --manifest-path src-tauri/Cargo.toml
                                             PASS
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
                                             PASS
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
                                             PASS
npm run build                               PASS; dist/site created
CI=true npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb
                                             PASS
```

The Linux production build produced `Change Recovery Ledger_0.1.2_amd64.deb`.
`dpkg-deb` reports `change-recovery-ledger`, version `0.1.2`, architecture
`amd64`; its desktop binary stayed running under Xvfb for ten seconds. The
published v0.1.2 Debian asset was downloaded independently; its SHA-256
matched `SHA256SUMS` and its package metadata matched the expected identity.
The release is non-draft and includes macOS, Windows, and Linux artifacts plus
valid `latest.json`.

Initial native compilation exhausted this disposable container's shared
filesystem while building a debug archive. I removed only this checkout's
ignored Rust build cache with `cargo clean`, then reran the native suite and
quality checks from the current checkout using the pre-existing isolated QA
target cache. The current Rust crate was recompiled and all 13 tests passed;
this was a container-capacity condition, not a candidate failure.

The static production bundle is 11,723 bytes gzipped JavaScript and 4,281
bytes gzipped CSS, well inside the 200 KB/50 KB budgets. The 390px hero source
is the 76,710-byte `hero-ledger-800.webp` derivative.

## Live functional, accessibility, privacy, and PWA evidence

- Normal recovery: `/demo` starts with one selected file; confirmation names
  the count and says other files stay unchanged; successful reversal reports a
  safety checkpoint. Export creates `recovery-cp-3.patch` (206 bytes in the
  observed selected-file flow) and reports “Nothing was run.”
- Invalid input: empty license entry says “Paste a license token, then verify
  it.” An invalid token says it is inactive and the free ledger remains usable.
- 390×844 mobile: landing and demo `scrollWidth === clientWidth === 390`.
  The skip link has a 4px blue focus outline, the menu opens, dialog focus
  starts on Keep files, Shift+Tab wraps, and Escape returns focus to Reverse.
  Reduced-motion transition duration is 0.01ms.
- Axe Playwright scans on live landing and demo found zero serious or critical
  findings (zero findings at any impact). `verify-url.sh` passed at 889ms with
  no errors, `lang=en`, one h1, one main landmark, labelled controls, and no
  missing image alt text. No console or page errors were observed.
- A fresh live demo request log contains only
  `https://agent-change-recovery.sociobot.in`; reset removed its sole
  `demo:agent-change-recovery:ledger` key. Landing additionally requests only
  the disclosed GitHub release API and Sociobot product catalog. There is no
  analytics, font CDN, or AI endpoint traffic.
- PWA: live `/sw.js` is active with cache `recovery-ledger-v4`; after one visit
  an offline `/demo` reload showed the sample ledger and offline notice without
  errors.
- Headers: live HTML has response-header CSP including `frame-ancestors
  'none'`, HSTS, `nosniff`, strict-origin referrer policy, and a restrictive
  permissions policy. Hashed JS is `max-age=31536000, immutable`; `sw.js` is
  `no-cache`.
- The optional Sociobot license verification endpoint enforced a per-client
  allowance: requests 1–30 returned 200 and request 31 returned 429 with
  `Retry-After: 4` and `X-RateLimit-After: 4`. No product sign-in flow exists,
  so Entra tenant validation is not applicable.

Raw supporting logs and fresh Playwright captures are in
`.factory/evidence/verification-6-*` in this workspace.

## Defects by severity

- Blocker: none.
- Critical: none.
- High: none.
- Medium: none.
- Low: none.

Known, disclosed release constraint: the v0.1.2 desktop artifacts are
unsigned. The landing page says so before download; this is not a functional
or privacy defect in this candidate.
