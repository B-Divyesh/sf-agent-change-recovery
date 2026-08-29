# Independent product verification 4 — FAIL

- Candidate commit: `8bb190fbbf1bc2709908ba96439e20e72317a790`
- Live URL: `https://agent-change-recovery.sociobot.in`
- Verified: 2026-08-29 UTC
- Scope: clean dependency install, every declared claim test, full browser/native suite, production site build, fresh Chromium checks of the live deployment, headers/cache/network inspection, and release artifact inspection.

## Release decision

**FAIL — do not promote this candidate.** The source passes its local suite, and the deployed static JS/CSS exactly match its production build, but the live deployment cannot install its service worker or reload the demo offline. The paid checkout is unavailable, required public files are incorrectly served as 404, and the downloadable desktop release predates this candidate.

## Required first checks

### Cold first-read: PASS

A new Chromium context at the live URL showed:

- What: “Reverse the wrong agent changes.”
- For whom: “For developers supervising long agent sessions who need to recover one change without discarding the rest.”
- First action: “Try it with sample data,” followed immediately by “A loaded ledger opens next. Nothing is saved to your data.”

The action enters `/demo` in one click and presents a populated recovery ledger, plus the persistent “Demo — sample data, nothing is saved” banner, Reset demo, and Start for real controls. This meets the first-read and one-click-demo requirement.

### Claims manifest and exact commands: PASS locally

`.factory/claims.json` exists and defines 12 claims. Each exact command passed serially from the clean demo/native sandbox:

| Claim IDs | Exact command | Result |
| --- | --- | --- |
| `selective-reversal` | `npm test -- --grep @claim:selective-reversal` | PASS (1 test) |
| `patch-export` | `npm test -- --grep @claim:patch-export` | PASS (1 test; downloaded patch dry-runs against fixture) |
| `demo-isolation` | `npm test -- --grep @claim:demo-isolation` | PASS (1 test) |
| `local-privacy`, `chosen-folder-only` | `cargo test --manifest-path src-tauri/Cargo.toml project_files_stay_within_the_chosen_folder` | PASS each run |
| `offline-reload` | `npm test -- --grep @claim:offline-reload` | PASS locally (1 test) |
| `price` | `npm test -- --grep @claim:price` | PASS (copy and link) |
| `free-history-limit` | `cargo test --manifest-path src-tauri/Cargo.toml free_history_stops_after_seven_checkpoints` | PASS |
| `encrypted-export` | `cargo test --manifest-path src-tauri/Cargo.toml encrypted_export_has_versioned_header_and_hides_plaintext` | PASS |
| `git-metadata-exclusion` | `cargo test --manifest-path src-tauri/Cargo.toml excludes_git_metadata_from_checkpoints` | PASS |
| `large-file-skip` | `cargo test --manifest-path src-tauri/Cargo.toml skips_files_larger_than_two_megabytes` | PASS |
| `free-safety-and-patch-export` | `npm test -- --grep @claim:free-safety-and-patch-export` | PASS (1 test) |

The local `offline-reload` test is not representative of the deployed Static Web Apps routing; the live result below is a release blocker for that claim.

## Release-blocking findings

### Severity 0 — live offline demo claim is false

Fresh live `/demo` testing found no service-worker registration or controller after page load:

```json
{"hasRegistration":false,"installing":null,"waiting":null,"active":null,"controller":false}
```

The production `sw.js` precaches `/favicon.svg` and `/apple-touch-icon.png`. Both URLs return HTTP 404 in the live deployment. `cache.addAll()` therefore rejects during installation, and the app discards the registration. In a fresh live context, setting the browser offline and reloading `/demo` failed with `net::ERR_INTERNET_DISCONNECTED`.

This contradicts the visible and claimed “The demo works offline after one visit.” It also prevents the required service-worker update/offline-reload behavior.

### Severity 1 — the live catch-all blocks required public files and breaks the 404 page

The live deployment responds 404 for `/favicon.svg`, `/robots.txt`, `/sitemap.xml`, `/404.css`, and `/404.js`, despite those files being in `public/`. An unknown route returns the intended 404 page, but it requests `/404.css`, which itself is 404, and Chromium logs resource errors on that page. This fails the required 404, no-console-errors, favicon, robots, and sitemap delivery requirements.

The immediate cause is the deployed Static Web Apps catch-all route taking precedence over public files not explicitly listed in `staticwebapp.config.json`.

### Severity 1 — paid checkout is unavailable

`GET https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout` returned HTTP 404 on 2026-08-29. The landing page advertises the $15/month Pro plan, but Buy Pro cannot reach the hosted Sociobot checkout. The local price claim only verifies the exact link and copy; it does not prove the destination works.

### Severity 1 — downloadable desktop release is not the candidate

The only release is `v0.1.0`, tagged at `dbd2d84f82973c815f0906ef363398887ba32b18`. It does not contain candidate `8bb190f` (`git tag --contains 8bb190f` returns no tag); the candidate is 12 commits after that tag and includes changes to `src-tauri/src/lib.rs` and the UI. Therefore the platform download links deliver an older desktop app, not the tested candidate. A new tagged release containing this candidate is required before desktop promotion.

## What passed

- `npm ci`: PASS; 28 packages installed; audit reported zero vulnerabilities.
- `npm run build`: PASS. TypeScript passes and `dist/site` is produced. JS is 31.54 KB raw / 10.57 KB gzip; CSS is 14.87 KB raw / 4.18 KB gzip; the 600px hero is 44 KB and full hero 180 KB.
- `npm test`: PASS, 19/19 Playwright tests.
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS, 9/9 tests.
- `cargo check`, `cargo build`, `cargo fmt -- --check`, and `cargo clippy --all-targets -- -D warnings`: PASS. No additional repository lint command exists.
- Native tests cover selected-folder scope, Git exclusion, generated folder exclusion, 2 MB skip, path validation, free checkpoint limit, encrypted output header/no plaintext, and a standard patch that dry-runs.
- A normal live demo flow has no outbound request beyond its own origin. The landing page additionally requests GitHub’s public releases API, as disclosed in Privacy; no analytics request was observed.
- Fresh Axe Playwright scans of `/`, `/demo`, `/privacy`, `/terms`, and the not-found route found zero serious or critical violations. Each had one `h1` and one `main`; the known routes have `lang=en`, route-specific titles, no console errors, and no mobile overflow at 390px.
- Keyboard check at 390px: the reverse button’s focused outline is `rgb(20, 92, 112) solid 4px`; the dialog initially focuses Keep files, Shift+Tab wraps to Create checkpoint and reverse, and Escape restores focus to `restore-selected`. Reduced-motion transition duration is `0.00001s`.
- `/opt/fleet/lib/verify-url.sh https://agent-change-recovery.sociobot.in /tmp/acr-verify-url`: PASS for the landing route (200, title, lang, one h1/main, image alts, no landing console errors).
- Live known-route headers include HSTS, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, restrictive permissions policy, and a response-header CSP with `frame-ancestors 'none'`. Hashed JS is immutable for one year; `sw.js` is no-cache.
- The live deployed JS and CSS are byte-identical to the candidate build:
  - JS SHA-256: `7352726154b47ba4ceb0f2b7795d926f51a6c780d583e9fd9fa550687d342f35`
  - CSS SHA-256: `259da7398dab78a502b0c5ceb2c64a9b7326e8c52e21d603c26ee0b875113db2`
- The license verify API enforced an observed allowance of 30 requests from one client; request 31 returned HTTP 429 with `Retry-After: 2`.
- GitHub release `v0.1.0` has macOS, Windows, and Linux artifacts plus valid `SHA256SUMS` and `latest.json`. Downloaded `Change.Recovery.Ledger_0.1.0_amd64.deb` SHA-256 was `4d5bb87e6ececf3481e8580e9e364c6dbf2ebbcc32092d66cb8d202d1168d030`, matching its checksum manifest. That artifact is nevertheless stale relative to this candidate.

## Required remediation

1. Adjust Static Web Apps routing so public static files are served normally while unknown application routes return the styled 404. Verify `/favicon.svg`, `/apple-touch-icon.png`, `/robots.txt`, `/sitemap.xml`, `/404.css`, and `/404.js` return 200.
2. Repeat a fresh live service-worker registration, update, and offline `/demo` reload test. Keep the claim test deployment-representative.
3. Register/enable `agent-change-recovery` in the Sociobot billing engine and verify Buy Pro reaches the hosted checkout.
4. Tag and publish a desktop release built from this candidate (or its approved successor), then re-check one downloaded artifact checksum and installed behavior.
