# Handoff — polish round 2

## Result

**PASS.** Every finding in `.factory/review-2.md`, every earlier review finding,
and the controller's additional evidence requirements are closed. The mapping
from each finding to its repair and evidence is in `.factory/polish-2.md`.

The production site is live at
`https://agent-change-recovery.sociobot.in`. The published desktop release is
v0.1.12 at
`https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.12`.

## What changed

- Rewrote the first screen in plain words while retaining the recovery-ledger
  visual system and its registration-mark interaction grammar.
- Added the direct `?demo=1` sandbox with realistic records, persistent demo
  banner, reset, exit, and a separate `demo:` storage namespace.
- Added a native current-folder comparison command and connected the desktop
  control to its real filesystem result.
- Strengthened native privacy and passphrase tests with network-syscall capture,
  unique fixture secrets, complete app-data scanning, and reopen checks.
- Published 33 claims with exactly one matching behavioral test each.
- Added route-specific titles and metadata, focus restoration, real history,
  a shared-shell HTTP 404, complete legal links, and mobile first-screen checks.
- Replaced configuration-only release claims with downloaded artifact,
  checksum, manifest, installer, and application-launch proof.
- Removed unproved signature, merchant, refund, and subjective marketing copy.
- Added a Windows consumer test that verifies the checksum, starts the actual
  installer, launches the installed app, and proves a mismatch starts nothing.

## Verification

Local final-tree gates:

- `npm test` — 39/39 Playwright unit, integration, browser, accessibility,
  routing, demo, privacy, offline, and installer tests passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 23/23 native tests passed.
- `scripts/test-native-privacy.sh` — the capture completed with zero network
  syscalls under `strace`.
- `npm run test:claim-tags` — 33/33 claims have exactly one matching tag.
- `npm run build` — passed; `dist/site` produced. Initial JS is 43.75 KB raw /
  13.83 KB gzip and CSS is 15.78 KB raw / 4.36 KB gzip.
- `npm run verify:paid-checkout` — the registered $15 checkout returned HTTP
  303 without sending project content.

Fresh-clone gate at implementation commit
`5c8c5c125f799610b0214495e8756f9455b45092`:

- Cloned `main` into a new empty directory and ran `npm ci`.
- `npm run test:claim-tags && npm run test:claims` — all 33 exact commands in
  `.factory/claims.json` passed, including native syscall privacy, current-folder
  comparison, published artifact checksums, and Windows consumer proof.
- `npm test` — 39/39 passed; `cargo test --manifest-path
  src-tauri/Cargo.toml` — 23/23 passed; `npm run build` and `npm run
  verify:paid-checkout` passed in that same clone.

GitHub evidence:

- Quality run `33292342032` for implementation commit `5c8c5c1` — success on
  Linux and Windows:
  `https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33292342032`.
- Release run `33291740902` — success for macOS arm64/x64, Windows x64,
  Linux x64, Linux AppImage launch, Windows install/app launch, checksums, and
  manifest:
  `https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33291740902`.
- `node scripts/verify-published-release.mjs` downloaded candidate macOS,
  Windows, and Linux assets and matched `SHA256SUMS` plus `latest.json`.
- `node scripts/verify-windows-consumer-proof.mjs` verified installer start=1,
  checksum-mismatch start=0, and installed-app launch=true. The recorded setup
  SHA-256 is
  `dec1af6deb28171969750e527335b176cfc4301e2e85259c29026c711912d84e`.

Production evidence:

- Cold route checks passed for `/`, `/?demo=1`, `/demo`, `/app`, `/privacy`,
  `/terms`, and a real HTTP 404. Each app route has one main/H1 and the correct
  title; the 404 mirrors the live header/footer and build ID.
- The cold demo used only the production origin, kept real storage untouched,
  reset cleanly, exited cleanly, and reloaded while offline under service-worker
  control.
- Mobile 390x844 checks found no horizontal overflow and kept the complete
  first-screen facts in the viewport. History back restored scroll 0 and focus
  to the landing H1.
- Playwright Axe found zero serious or critical issues. Browser console errors:
  zero.
- Lighthouse mobile: performance 99, accessibility 100, best practices 100,
  SEO 100; LCP 1.5 s, CLS 0, TBT 110 ms.
- Static deployment `f6c8c257` completed successfully.

Evidence files:

- `.factory/polish-2.md`
- `.factory/evidence/polish-2-live.json`
- `.factory/evidence/polish-2-release.json`
- `.factory/evidence/polish-2-lighthouse.json`
- `.factory/evidence/polish-2-live-landing-mobile.png`
- `.factory/evidence/polish-2-live-demo-mobile.png`
- `.factory/evidence/polish-2-live-404-mobile.png`

## Run it

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
scripts/test-native-privacy.sh
npm run test:claim-tags
npm run test:claims
npm run build
```

Use `npm run dev` for the site and `npm run tauri dev` for the desktop app.
The verifier/demo entry point is `http://localhost:4173/?demo=1` after preview,
or `https://agent-change-recovery.sociobot.in/?demo=1` in production.

## Known gaps and operator action

No review or acceptance finding remains open. Apple notarization and Windows
Authenticode are not configured or claimed because owner certificates were not
provided. Future signed distribution would require adding certificate import
and signing steps to the release workflow; that workflow currently expects no
signing secrets. No infrastructure, DNS, billing, or signing state was changed.

Pre-existing modified `graphify-out/` files were preserved and excluded from
all repair commits.

---

# Handoff — venture-plan audit (2026-09-05)

## What changed

- Added `.factory/plan.md`, the product's evidence-based M1–M3 venture plan.
  It distinguishes the accepted local-recovery core from fixture-only or
  incomplete commercial evidence.
- Wrote `/work/.evidence/venture-plan.json` with the next milestone,
  dependencies, accepted milestone evidence, demonstrated-only work, and
  blockers.
- No product source, deployment, billing configuration, or release state was
  changed.

## Verification run by this planner

- `npm ci` completed with 0 reported vulnerabilities.
- `npm test` passed: 39 tests.
- `npm run test:claim-tags` passed: 33 claims have exactly one tag.
- `npm run test:claims` passed: all 33 declared commands, including native
  filesystem/privacy, browser, installer, and published-release checks.
- `npm run build` passed and produced `dist/site` (43.75 KB raw JavaScript;
  15.78 KB raw CSS).
- After installing the Linux prerequisites already declared by the release
  workflow, `cargo test --manifest-path src-tauri/Cargo.toml` passed: 23 tests;
  `scripts/test-native-privacy.sh` passed with zero network syscalls.
- `scripts/verify-url.sh https://agent-change-recovery.sociobot.in` passed.
- `npm run verify:paid-checkout` confirmed the public $15 USD listing and a
  hosted checkout HTTP 303. This is redirect evidence only, not a completed
  purchase or issued-license proof.
- `node scripts/verify-published-release.mjs` confirmed v0.1.12 macOS,
  Windows, and Linux artifact checksums and `latest.json`.

## Pending work

The next milestone is M2, not M3. The current branch is ahead of the v0.1.12
desktop tag, so source-to-artifact identity for the current branch is not yet
proven. A controlled billing test must also prove checkout return and valid
license activation in the packaged app without using or requesting production
credentials. The five-minute/80% pilot outcome remains unmeasured. See
`.factory/plan.md` for the exact acceptance criteria and external boundaries.
