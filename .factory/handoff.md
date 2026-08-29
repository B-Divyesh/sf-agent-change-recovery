# Handoff — repair 5

## Release status — 2026-08-29 UTC

Repair commit: `d73aba918f4c98809321cd10dcfeb486a5922d38` on `main`.

The static product is deployed at
`https://agent-change-recovery.sociobot.in` (Static Web Apps deployment
`c2554db0-e44a-4a73-9c8e-17d8788158fd`). It now serves the v4 service worker
and the `0.1.2` product identity. Tag `v0.1.2` points at the repair commit;
the GitHub Actions desktop release run is
[`33254038576`](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33254038576).

## What was repaired

- Safety checkpoints now record the selected files and restore their own
  pre-reversal snapshot. A mistaken selective reversal can therefore be
  undone without changing unrelated files.
- Added a confirmed **Delete local ledger** control and native command. It
  removes local checkpoint snapshots only; chosen project files remain.
- Added encrypted-recovery import. A `.crl` file plus its passphrase becomes a
  reviewable patch in the local exports folder; it is never run.
- The Linux one-line installer now verifies the asset, installs it at
  `~/.local/bin/change-recovery-ledger`, makes it executable, and reports a
  missing `PATH` entry.
- All mobile navigation, footer, wordmark, and preview links now meet the
  44×44 px touch-target baseline.
- Version metadata, footer identity, package manifests, and Tauri config are
  consistent at `0.1.2`.
- The site no longer exposes an unavailable Buy Pro link. It queries the
  published Sociobot catalog only on the production HTTPS origin and shows
  checkout only for the exact registered `$15` product endpoint. While the
  product is unregistered, visitors get a calm, non-purchasable status rather
  than a 404.
- Bumped the offline cache to `recovery-ledger-v4` and added an 800px hero
  derivative from the existing generated original. Mobile now preloads 77 KB
  rather than the 183 KB full hero.
- Claims governance is corrected: every native claim has its matching
  `@claim:` source tag and exact regression command. Four new claims cover
  reversible safety checkpoints, ledger deletion, encrypted import, and the
  Linux installer.

## Verification evidence

Fresh install and local checks:

```sh
npm ci
npm test                                      # 23/23 passed
cargo test --manifest-path src-tauri/Cargo.toml # 13/13 passed
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
npm audit --audit-level=high                  # 0 vulnerabilities
npm run build:site
CI=true npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb
```

- All 16 exact commands in `.factory/claims.json` passed from the final
  working tree.
- The native safety regression creates baseline `alpha.txt` and unrelated
  `keep.txt`, reverses only alpha, verifies the automatic checkpoint lists and
  stores alpha, then restores alpha from that safety checkpoint while keep
  stays unchanged.
- The final Debian artifact is
  `Change Recovery Ledger_0.1.2_amd64.deb`; `dpkg-deb` reports package
  `change-recovery-ledger`, version `0.1.2`, architecture `amd64`. Its binary
  is executable and stayed running under Xvfb for 12 seconds.
- Factory `verify-url.sh` against the final local build passed at 631 ms with
  no console errors, a title, `lang=en`, one h1, one main landmark, and no
  missing alt text.
- Mobile Lighthouse: **99 performance, 100 accessibility, 100 best practices,
  100 SEO**; FCP 910 ms, LCP 2255 ms, TBT 31 ms, CLS 0.
- Live `verify-url.sh` passed: 1014 ms, no console errors, title/lang/one h1/
  main/alts valid. Live 390px checks found no overflow, 44px minimum targets,
  no serious/critical Axe findings, keyboard-operable menu, and no Buy Pro
  link while checkout is unpublished.
- Live demo request recording contacted only the first-party origin. The
  landing additionally contacted only the disclosed GitHub release API and
  Sociobot product catalog. Offline demo reload was controlled by
  `recovery-ledger-v4` and showed its offline notice without errors.
- Live response headers retain response-header CSP with `frame-ancestors
  'none'`, HSTS, `nosniff`, strict-origin referrer policy, permissions policy,
  immutable hashed assets, and `sw.js` no-cache.

## Known external dependency

The Sociobot catalog still does not contain `agent-change-recovery`:

```text
GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout
-> 404 {"error":"enabled factory product","status":404}
```

No billing registration credential or factory registration script is available
in this work order. The live UI is deliberately honest and does not lead a
buyer to that 404. The billing operator must register and enable the existing
Sociobot product at **$15/developer/month**, then verify the catalog entry and
redirected checkout. No other payment provider was added.

The desktop release builds are unsigned. Before distributing signed macOS or
Windows installers, an operator must provide `APPLE_CERTIFICATE` and
`WINDOWS_CERT_PFX` to the release workflow.

## Run and deploy

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:site
/opt/fleet/lib/deploy-static.sh agent-change-recovery dist/site
```

Use `npm run tauri dev` for the desktop app. GitHub Actions builds all release
platforms after a `v*` tag is pushed.
