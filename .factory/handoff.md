# Handoff — repair 9

## Result

**PASS — verifier release blockers from `7f902b6138057c989590c39bd828d81a6ee6cd9c` are repaired in v0.1.7.**

Repair commit: `bc96569` (`fix: repair verifier release blockers`), pushed to `origin/main`.

This repair preserves the desktop Tauri application and static-site deployment class. It changes only the delivery, checkout-state, accessibility, documentation, and regression-test paths needed for the verifier findings. The original recovery workflow, local-first data model, demo, and every pre-existing claim remain intact.

## Repairs

1. **Unavailable Pro checkout:** the site no longer publishes a price or a **Subscribe to Pro** link merely because the URL can be constructed. It reads Sociobot's public catalog, requires the exact product, USD $15 price, and exact checkout URL, then HEAD-checks that checkout before showing a purchase action. On the current production catalog (where this product is absent and checkout returns 404), it gives the honest unavailable state and leaves license restoration available.
2. **Intel Mac download:** macOS release resolution now matches Apple-silicon and Intel assets separately. Intel is the default for an Intel browser; Apple silicon is the default for an ARM browser; both explicit choices remain visible. The macOS shell installer now uses `uname -m` and its matching DMG rather than the first DMG returned by GitHub.
3. **390 px skip-link target:** focused skip links on the application and 404 page are now inline-flex controls with a 44 px minimum height.
4. **Fresh client state:** the service-worker cache is versioned as `recovery-ledger-v7`, preventing cached v0.1.6 shell code from retaining the old behavior.

## Exact regression coverage

- The checkout test covers a valid-looking catalog whose checkout returns 404: it must show neither price nor purchase link; changing only that probe to 204 must reveal the exact `$15` link.
- Platform tests cover Intel and Apple-silicon user agents with both DMGs present; an installer test makes an ARM asset first in the release list and proves an x86_64 Mac still downloads and SHA-256-verifies the x64 DMG.
- The 390 px target test focuses the skip link and measures it with the other interactive controls.
- The release-request privacy claim now includes the disclosed Sociobot catalog probe, and the cache-update test covers v7.

## Verification

Run from a clean checkout:

```sh
npm ci
npm audit --audit-level=high
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
CI=true npm run tauri -- build
```

Executed for this repair on 29 August 2026:

- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm ci`: passed.
- `npm test`: **35 passed**. All 11 browser-declared claims were also run individually from their exact `.factory/claims.json` commands.
- All 17 native declared claim commands were run individually; each passed. The complete Rust suite passed **21 tests**.
- Production static build passed: 42.64 KB JS / **13.51 KB gzip**, 15.78 KB CSS / 4.36 KB gzip.
- Rust format check and `clippy -- -D warnings` passed.
- `CI=true npm run tauri -- build` passed and produced the v0.1.7 Linux `.deb`, `.rpm`, and `.AppImage` bundles.
- The Playwright/Axe integration found zero serious or critical violations on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and the 404 route. Keyboard dialog focus restoration, desktop browser flow, 390 px mobile behavior, offline reload, privacy request logging, and service-worker update are part of the green browser suite.
- Live mobile Lighthouse: performance **99**, accessibility **100**, best practices **100**, SEO **100**; FCP 0.9 s, LCP 2.2 s, TBT 30 ms, CLS 0.003, and no console-error audit finding.

## Deployment evidence

Deployed 29 August 2026 through `/opt/fleet/lib/deploy-static.sh` to the existing Azure Static Web App `sf-agent-change-recovery` (`yellow-field-06248de10.7.azurestaticapps.net`) and its custom domain:

`https://agent-change-recovery.sociobot.in`

- `bash scripts/verify-url.sh` passed on the landing, `/demo`, `/privacy`, and `/terms`: title, `lang`, exactly one `main`/`h1`, image alt attributes, and no browser console errors.
- Live response headers include the configured CSP with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, permissions policy, and HSTS.
- A fresh Intel-Mac browser received v0.1.6 `..._x64.dmg` as its primary download, with separate visible Apple-silicon `..._aarch64.dmg` and Intel links. A fresh ARM browser regression is covered by the automated suite.
- The live billing probe found no public product listing, so price stayed hidden and **Subscribe to Pro** links counted zero. The unavailable state is visible; no checkout 404 is exposed as an action.
- At 390 px, a focused live skip link measured 224.03 × **44** CSS px. Desktop and mobile browser sessions recorded no console or page errors.
- Live landing requests were limited to the product origin, `api.github.com` for the disclosed release lookup, and `api.sociobot.in` for the disclosed checkout-publication probe.

## Known state and next operator action

There is currently no public Sociobot catalog entry for `agent-change-recovery`; production and pilot checkout endpoints return 404. This is no longer presented as an available paid purchase. Existing issued licenses can still be restored.

If paid checkout is to be offered later, the factory billing owner must register and enable the product in Sociobot, then verify the hosted redirect. Once both the catalog listing and checkout probe succeed, this release exposes the price and Subscribe link automatically. No project data is ever sent with that request.

The GitHub release workflow should be run for tag `v0.1.7` to publish the corresponding cross-platform desktop artifacts. The static repair correctly selects the existing v0.1.6 platform artifacts in the meantime.
