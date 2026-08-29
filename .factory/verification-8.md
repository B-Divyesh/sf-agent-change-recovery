# Independent verification 8 — FAIL

Verified 29 August 2026 (UTC).

- Candidate: `b44965734cdf0054c60486659a33ae61e97f107d`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Artifact: Tauri 2 desktop app with a static landing page and browser demo
- Decision: **FAIL — do not release this candidate**
- Product code was not modified during verification.

The declared test suites are green and the deployed static files match the candidate, but fresh acceptance testing found three release-blocking product defects: selective reversal can escape the chosen project through a replaced parent symlink, ordinary no-final-newline files produce a patch that cannot be applied, and the live paid checkout is not registered and returns HTTP 404.

## First-read gate

**PASS.** A cold 1440×900 load states all three required facts in the first screen:

- What it does: “Reverse the wrong agent changes.”
- For whom: developers supervising long agent sessions who need to recover one change without discarding the rest.
- What to click first: **Try it with sample data**, followed by “A loaded ledger opens next. Nothing is saved to your data.”

The action opens `/?demo=1` in one click with a populated four-checkpoint ledger and a persistent “Demo — sample data, nothing is saved” banner, **Reset demo**, and **Start for real**. Evidence: [first-read-desktop.png](evidence/verification-8/first-read-desktop.png) and [live-mobile.png](evidence/verification-8/live-mobile.png).

## Release-blocking findings

### P0 — selective reversal can write outside the chosen project

The restore boundary validates only lexical components. `safe_relative` rejects `..`, roots, and Windows prefixes at `src-tauri/src/lib.rs:676-688`, but it does not reject or resolve a symlinked parent. `restore_files_in_store` then joins the accepted relative path and writes it with `fs::write` at lines 848-855, which follows parent symlinks.

Fresh reproduction:

1. A checkpoint contains `src/victim.txt` while `src` is a normal directory.
2. Replace `project/src` with a symlink to a directory beside the project.
3. The same accepted relative path resolves to the outside directory.
4. Writing `project/src/victim.txt`, exactly as the restore loop does, changed the outside sentinel to `restored outside boundary`.

This violates “Records only the project folder you choose” and the core promise that selective reversal preserves unrelated work. A wrong or hostile agent turn can create precisely this filesystem shape.

### P1 — exported patches fail for text files without a final newline

`patch_text` converts content with Rust `str::lines()` and always appends a newline (`src-tauri/src/lib.rs:1021-1081`). It never emits the required `\ No newline at end of file` markers. A representative one-line file containing `old` with no trailing newline generated the same patch shape; GNU `patch --batch --dry-run -p1` returned exit 1 with `Hunk #1 FAILED at 1`.

The declared `@claim:patch-export` test uses only a newline-terminated fixture, so it passes while this ordinary boundary case breaks the promised review/replay artifact.

### P1 — the live Pro checkout is dead

The visible **Subscribe to Pro** link points to the required Sociobot URL, but a fresh GET to:

`https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout`

returned HTTP 404 with `{"error":"enabled factory product","status":404}`. The product advertises `$15 per developer / month`, but a visitor cannot buy it. The `@claim:pro-license` test mocks verification and asserts only the checkout URL; it never checks that checkout works.

### P1 — exact all-target desktop production build fails locally

`npm run tauri build` first failed because this worker exports `CI=1` and Tauri accepts only a boolean string. With the standard `CI=true`, the optimized executable, `.deb`, and `.rpm` built, but the command still exited 1 at the required AppImage stage with `failed to run linuxdeploy`. This is a reproducible failure of the all-target desktop build in the supplied Ubuntu 24.04 verification environment. The separately published GitHub release does contain a checksum-valid AppImage built on Ubuntu 22.04.

### P2 — one mobile interactive target is only 18px high

At 390×844, the **Read selected file diff** `<summary>` measured 316×18 CSS pixels. It is an interactive touch target and misses the required 44×44 baseline. Checkbox inputs measured 22×44, but their enclosing labels provide the 44px hit area; the summary has no equivalent expansion.

### P2 — public encryption wording exceeds the claim ledger

Privacy and README say retention settings are encrypted. The `local-encryption` claim lists snapshots and manifests, while `team-policy-note` covers policy text; no claim entry names or independently asserts encrypted retention settings. Under the supplied claims contract, this is an unlisted public claim. The files appear encrypted by implementation, but the contract requires the public statement itself to be listed and tested.

### P2 — a decorative first-screen label violates the plain-words contract

The generated `RECOVERY / 001` label is product lore rather than useful instruction. The supplied plain-words contract explicitly disallows decorative/invented labels. It does not prevent the first-read gate from passing, but it remains a contract defect.

## Mandatory claim gate

`.factory/claims.json` exists and contains 27 entries. Before other QA, every listed command was invoked from the checkout. The first unprovisioned invocation could not load `@playwright/test`, and native commands could not find GLib; after the required `npm ci` and documented Tauri Linux prerequisites were installed, every exact command was rerun individually.

Final result: **27 passed, 0 failed**.

- Browser claims: selective reversal, patch export, demo isolation, offline reload, Pro license restore, daily verification, platform download, release request privacy, Linux installer, Windows installer, unsigned macOS, and release platforms — 12/12 passed.
- Native claims: local privacy, local encryption, retention, policy note, encrypted export/import, chosen-folder scope, large-file skip, Git/generated-folder exclusions, checkpoint record/comparison, reversible safety checkpoint, ledger deletion, and bundled sample — 15/15 passed.

The independent boundary failures above demonstrate gaps in the declared claim fixtures; a green declared-claim run does not override them.

## Build and repository gates

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci` | PASS | 28 packages installed; 0 audit vulnerabilities |
| `npm test` | PASS | 30/30 Playwright tests |
| `npm run build` | PASS | TypeScript `--noEmit` and Vite production build; output in `dist/site/` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check` | PASS | No formatting differences |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | PASS | No warnings |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 19/19 native tests; 0 doc-test failures |
| `CI=true npm run tauri build` | **FAIL** | `.deb` and `.rpm` produced; AppImage `linuxdeploy` exited 1 |

There is no separate npm lint script. TypeScript checking and Rust clippy are the available lint/type gates.

Four tracked `graphify-out` files were already modified at the initial status check. They were not changed, reverted, or included in this verification commit.

## End-to-end behavior

### Browser demo

- Loaded the realistic four-checkpoint sample in one click.
- Selected two of four files, read the intent, diff, command trail, and failed-check result.
- Confirmation named the two-file operation and promised the other files would stay unchanged.
- Confirming produced “2 files were reversed. The safety checkpoint is in the ledger.” Only the two selected rows became restored, and a safety checkpoint appeared.
- Export downloaded `recovery-cp-3.patch` (264 bytes), included the selected file, excluded unselected files, and reported “Nothing was run.”
- Reset removed `demo:agent-change-recovery:ledger` and restored the sample. Direct demo traffic was same-origin only.
- Invalid license recovery returned the clear inactive-license message and remained on the free plan.

Evidence: [live-demo-after-recovery.png](evidence/verification-8/live-demo-after-recovery.png).

### Native and installer

- Native tests exercised captures, previous-checkpoint comparison, retention at two checkpoints, wrong recovery passphrase, encryption, selected-file reversal, safety re-restoration, invalid relative paths, deletion, and bundled-sample reset.
- GitHub release `v0.1.5` contains `.deb`, `.rpm`, AppImage, Windows `.exe`/`.msi`, Intel and ARM macOS `.dmg`/archives, `SHA256SUMS`, and valid `latest.json`.
- Downloaded `Change.Recovery.Ledger_0.1.5_amd64.deb`; published checksum passed: `8f199f3ed264acf9487ac115fc726da3d571bc55e38169c750b762e48256d8c2`.
- Extracting the package produced executable `/usr/bin/change-recovery-ledger`.
- The public `install.sh` ran in an isolated consumer home, downloaded and verified the AppImage, installed it as `change-recovery-ledger`, and the app remained running until the 15-second smoke-test timeout under Xvfb.

## Live deployment identity and routing

- `/`, `/demo`, `/privacy`, and `/terms` return 200. `/missing-sheet` returns the styled 404 with HTTP 404.
- `scripts/verify-url.sh` passed all four product routes for title, language, one main, one H1, alt text, and console errors.
- Local and live SHA-256 matched for `index.html`, hashed JS, hashed CSS, service worker, web manifest, robots, sitemap, 404 HTML/CSS/JS, and both installer scripts.
- Live JS hash: `e2f123ff35c7c00d80c547e5594f106e16508c057edbde5771ed86b132c7df63`.
- Candidate differs from release tag `v0.1.5` only in browser test/handoff/generated analysis files; no shipped product source differs. The live product therefore matches the candidate’s shipped code.

## Privacy, requests, and headers

- Fresh direct `/demo` export/reversal traffic used only `https://agent-change-recovery.sociobot.in`.
- Landing adds only the disclosed GitHub release request. Invalid license restore adds only the documented Sociobot verification request. No analytics, CDN font/script, Azure OpenAI, or other request was observed.
- Main response: HTTPS 200; `Content-Security-Policy` includes `frame-ancestors 'none'` and only the declared connect origins; HSTS; `X-Content-Type-Options: nosniff`; strict-origin referrer policy; restricted permissions policy.
- HTML caches for 30 seconds with revalidation. Hashed JS/CSS cache for one year and are immutable. `sw.js` is `no-cache`.
- The license verification endpoint allowed 30 consecutive requests from one client. Request 31 returned HTTP 429 with `Retry-After: 3` (observed allowance: 30 requests/window).
- There is no sign-in flow, so the Entra tenant requirement is not applicable.

## Accessibility, responsive layout, motion, and PWA

- Playwright Axe: 0 serious/critical findings on live landing and demo; the complete local suite also scans `/`, `/demo`, `/app`, `/privacy`, `/terms`, and `/missing-sheet`.
- Keyboard order begins with a working visible skip link. Focus rings are 4px process blue. The recovery dialog traps focus, Escape closes it, and focus returns to the trigger after the animation frame.
- No horizontal overflow at 390px; the first action and all three facts are in the first 844px viewport.
- Simulated 200% root text produced no horizontal overflow and kept action buttons visible.
- Reduced-motion media query matched and no animations remained running.
- Service worker `recovery-ledger-v5` activated, updated, controlled the page, and reloaded `/demo` offline with its offline notice.

## Performance

- JS: 40,195 bytes raw / 12,665 bytes gzip (budget ≤200 KB).
- CSS: 15,626 bytes raw / 4,356 bytes gzip (budget ≤50 KB).
- Mobile hero: 41,134 bytes (budget ≤300 KB).
- Mobile Lighthouse: performance 100, accessibility 100, best practices 100, SEO 100; FCP 926 ms, LCP 1,258 ms, TBT 12.5 ms, CLS 0, interactive 1,262 ms, total transfer 143,976 bytes.

Lighthouse evidence: [lighthouse-mobile.json](evidence/verification-8/lighthouse-mobile.json).

## Required next fixes

1. Resolve and verify every restore destination without following symlinks outside the canonical project root; add a native claim regression with an outside sentinel.
2. Generate valid unified diffs for missing-final-newline text and explicitly handle or reject binary selections; extend `@claim:patch-export` to dry-run both boundaries.
3. Register/enable the product in the production Sociobot billing engine and make a real checkout reach the hosted payment page.
4. Make the documented all-target desktop build succeed in the verification environment, or provide a repository command that deterministically builds each supported target.
5. Expand the `<summary>` touch target to at least 44px and reconcile public encryption wording with `claims.json`.
