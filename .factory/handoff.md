# Handoff — repair 10

## Result

**PASS — both independent-verifier release blockers are repaired and deployed.**

- The requested candidate `e3449421e29444260713c32f31f0ab72e1994f10` is now the exact `v0.1.7` tag and release. GitHub Actions run [33282024600](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33282024600) completed successfully with that exact head SHA.
- Production Pro billing is registered and published in Sociobot: **Change Recovery Ledger Pro**, **$15 USD per developer/month**. Its public catalog entry supplies the product checkout URL; the server-side readiness probe receives the hosted-checkout `303`.
- The follow-up repair is commit `70daa47643390692d92339e8ede0619ac4237cb9` (`v0.1.9`). It prevents the landing page from prefetching the hosted Dodo checkout: before an explicit **Subscribe to Pro** click it contacts only the disclosed GitHub release API and Sociobot product catalog. The final static site is deployed at `https://agent-change-recovery.sociobot.in`.

Full final evidence: `.factory/evidence/repair-10-final.json`.

## Root causes and repairs

1. **Missing candidate release.** The verifier correctly found that candidate v0.1.7 had no tag, workflow run, or desktop release, so the live site selected stale v0.1.6 assets. The exact candidate has been tagged `v0.1.7` and released. The repair additionally makes the site offer a download only when the latest release has the app's own version and all required desktop assets; otherwise it links to the releases page. The workflow now downloads the published release after upload and validates its tag target, every desktop artifact, `SHA256SUMS`, and `latest.json`.
2. **Unavailable paid checkout.** The Sociobot production catalog did not contain this product. It is now published at the contracted price. `scripts/verify-paid-checkout.mjs` is the regression check: it verifies the exact catalog entry, USD 1500 minor-unit price, and hosted-checkout redirect without initiating a purchase.
3. **Follow-up privacy issue found during repair.** Once checkout became live, the old reachability probe followed its Dodo redirect on landing-page load. `resolveCheckout` now uses the published Sociobot catalog as the availability signal and creates only a normal anchor to checkout. The new Playwright regression test asserts that no checkout request occurs until the visitor clicks; the request-privacy claim asserts the complete allowed pre-purchase origin set.

## Verification performed

From a clean dependency install:

```sh
npm ci
npm audit --audit-level=high                 # 0 vulnerabilities
npm test                                     # 36 passed
npm run build                                # dist/site
npm run verify:paid-checkout                 # $15 USD, HTTP 303
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml  # 21 passed
CI=true APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri -- build
```

The v0.1.9 site build is 42.86 KB raw / 13.60 KB gzip JavaScript and 15.78 KB raw / 4.36 KB gzip CSS. The exact local Linux package produced v0.1.9 `.AppImage`, `.deb`, and `.rpm`; the AppImage remained running for 12 seconds under Xvfb with `APPIMAGE_EXTRACT_AND_RUN=1` and emitted no GLib/GIO module warnings.

Production checks:

- `bash scripts/verify-url.sh https://agent-change-recovery.sociobot.in` passed title, language, single `main`, single `h1`, image alternatives, and console checks.
- Playwright Axe scans found zero serious/critical violations on `/`, `/demo`, `/app`, `/privacy`, and `/terms`; each valid route had no console or page errors. `/missing-sheet` returns a real 404 with the styled fallback.
- At 390 px, the landing and demo had no horizontal overflow. Reduced motion was honored; inspected targets were at least 44 px; keyboard navigation opened the menu, checked a file with Space, trapped the reverse-confirmation dialog, and restored focus after Escape.
- A fresh service-worker context loaded `/demo`, went offline, and reloaded the sample with the offline notice and no errors.
- Request logging before purchase observed only `agent-change-recovery.sociobot.in`, `api.github.com`, and `api.sociobot.in`; it observed no Dodo request. The published checkout anchor remains exact. The live catalog lists USD 1500; `verify:paid-checkout` observes its expected `303` only in the explicit server-side readiness check.
- Release [v0.1.9](https://github.com/B-Divyesh/sf-agent-change-recovery/releases/tag/v0.1.9) has 11 assets: nine desktop artifacts plus `SHA256SUMS` and `latest.json`. GitHub Actions run [33283161825](https://github.com/B-Divyesh/sf-agent-change-recovery/actions/runs/33283161825) succeeded for both macOS targets, Windows, Linux, and the manifest verification job. A fresh download passed `scripts/verify-release.py`: `release verified: v0.1.9 at 70daa4764339 with 9 desktop artifacts`.
- Fresh Linux, Windows, Intel macOS, and Apple-silicon macOS browser contexts each received the corresponding v0.1.9 published release asset.

## Deploy and reproduce

The static site was deployed with:

```sh
npm run build
/opt/fleet/lib/deploy-static.sh agent-change-recovery dist/site
```

To reproduce release validation after a tag:

```sh
python3 scripts/verify-release.py v0.1.9 <tag-target-commit> <release-json> <downloaded-assets-dir>
```

## Needs operator action

Desktop releases are intentionally unsigned. To sign/notarize future desktop builds, configure the release workflow with the owner's macOS signing/notarization credentials (`APPLE_CERTIFICATE`, signing identity and notarization credentials) and Windows certificate (`WINDOWS_CERT_PFX`). No product data, telemetry, or analytics work remains.

## Workspace note

Pre-existing modified `graphify-out/` files were preserved and are not part of the repair commits.
