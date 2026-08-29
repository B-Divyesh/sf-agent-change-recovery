# Handoff — polish 1

## Delivered

- Repaired every F-1-1 through F-1-44 finding from `review-1.md`.
- Added direct `?demo=1` entry, persistent isolated-demo controls, exit cleanup, and a release-resolved real-app handoff.
- Added Tauri **Load sample project**, **Reset sample project**, and **Open local ledger** paths.
- Removed unavailable checkout and license claims from the release.
- Rewrote first-screen, product, legal, README, metadata, and 404 copy in plain language.
- Added route OG/Twitter updates, real static 404 metadata/skeleton, manual history restoration, and 390px first-screen coverage.
- Added claims ledger coverage for every remaining visitor promise.
- Updated the desktop release to `v0.1.4` and corrected Ubuntu AppImage workflow prerequisites.

## Commits and deployment

- Product repair: `34a462c`.
- CI/release repair: `c5a801d`, `0556716`.
- Pushed `main` and release tags `v0.1.3`, `v0.1.4` to `origin`.
- GitHub quality run `33261873620`: **success**.
- GitHub desktop release run `33261874466`: **success**. Release `v0.1.4` contains macOS arm64/x64, Windows MSI/EXE, and Linux AppImage/DEB/RPM assets plus `SHA256SUMS` and `latest.json`.
- Static deployment: deployed the freshly built `dist/site` to the configured Azure Static Web App `sf-agent-change-recovery` production environment. Live asset timestamp: 2026-08-29 16:16:43 UTC.

## Verification

- Clean clone at `34a462c`: `npm ci`, then every exact command in `.factory/claims.json` completed successfully.
- `npm test`: 29 browser tests passed locally. The GitHub fresh runner also passed this suite.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 16 native tests passed locally.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `npm run build`: passed; `dist/site` generated. Initial JavaScript gzip: 10.96 KB. CSS gzip: 4.31 KB.
- `scripts/verify-url.sh` passed for local production `/`, `/?demo=1`, `/privacy`, and `/terms` with title, language, main, H1, alt, and console checks.
- Playwright Axe scans are part of `npm test`; no serious or critical violations.
- Local evidence screenshots: `.factory/evidence/polish-1-landing-mobile.png` and `.factory/evidence/polish-1-demo-mobile.png`.
- Cold live checks passed on `https://agent-change-recovery.sociobot.in/`: `scripts/verify-url.sh` for `/`, `/?demo=1`, `/privacy`, and `/terms`; static files (`favicon`, Apple icon, robots, sitemap, 404 CSS/JS) all returned 200; `/missing-sheet` returned 404.
- Live demo controls appeared and exit removed all `demo:` storage keys before `/app`. Its observed network origins were only the product origin and `api.github.com`. A first-visit live demo also reloaded offline through the service worker.
- Live Playwright Axe scans at 390px found 0 serious or critical violations on `/`, `/?demo=1`, `/privacy`, `/terms`, and `/missing-sheet`.
- Live evidence screenshots: `.factory/evidence/polish-1-live-landing-mobile.png` and `.factory/evidence/polish-1-live-demo-mobile.png`.

## Packaging note

The container has no `/dev/fuse`, so its local linuxdeploy helper cannot complete an AppImage. The workflow now installs Ubuntu 22.04’s `libfuse2` and sets `APPIMAGE_EXTRACT_AND_RUN=1`; its Linux AppImage build passed in GitHub Actions.

## Working tree

Only pre-existing `graphify-out/` changes remain uncommitted. They were not modified or included in the repair.
