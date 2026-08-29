# Independent verification 7 — FAIL

Verified 2026-08-29 against candidate `dd6a9df194c12e6c1ca38880571d3272800024e6` and production `https://agent-change-recovery.sociobot.in`.

## Verdict

**FAIL.** The public demo, deployed web build, declared claims, accessibility checks, and released installers are in good shape. The desktop product still misses two explicit brief constraints: local checkpoint data is stored in plaintext and retention is neither configurable nor enforced. The claims ledger is also incomplete for several visible README/product promises.

## Required first-read result

**PASS.** Cold production landing page says it reverses wrong agent changes, names developers supervising long agent sessions as the audience, and provides **Try it with sample data** on the first screen. The adjacent sentence says that a loaded ledger opens and nothing is saved to user data. The first screen also states device-local files, offline demo, and no payment.

## Clean-clone test evidence

Created a fresh clone at `dd6a9df`, used `npm ci --include=dev`, and installed ordinary Linux Tauri prerequisites (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`). The base image initially omitted Playwright because of an environment production-dependency setting, and lacked GLib headers; both are runner setup issues, not product failures.

Every entry in `.factory/claims.json` passed using its exact command:

| Claim IDs | Result |
| --- | --- |
| `selective-reversal`, `patch-export`, `demo-isolation`, `offline-reload`, `no-payment` | PASS — one browser claim each |
| `local-privacy`, `generated-folder-exclusions`, `checkpoint-record`, `checkpoint-comparison`, `bundled-sample-project` | PASS — one native claim each |
| `platform-download`, `release-request-privacy`, `linux-installer`, `windows-installer`, `unsigned-macos`, `release-platforms` | PASS — one browser claim each |

Additional local gates:

- `npm test`: PASS — 29 Playwright tests (`test-results/.last-run.json` reports `passed`).
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS — 16 native tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: PASS.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: PASS.
- `npm run build`: PASS; `dist/site` created. JS is 34.50 KB / 10.96 KB gzip and CSS is 15.46 KB / 4.31 KB gzip.
- `npm run tauri build` under this runner's inherited `CI=1` fails before compilation because Tauri receives invalid `--ci 1`. With `CI=true`, the build compiles and creates Debian/RPM bundle output; the all-bundles AppImage stage cannot complete in this container because `/dev/fuse` is absent. This is a runner/package-build qualification, not the basis of the FAIL; the published AppImage exists.

## Live deployment evidence

- Candidate `dist/site/assets/index-M2FvZGkl.js` SHA-256 equals the live file: `d4b8691bd317268b3f74dce759cc3b13b0495b0876c6010ee3368c739b217c9d`.
- Candidate CSS SHA-256 equals the live file: `1203d3d18f496366b00b99adfd2f0997e4a746856e46a2926673f8f4f69b1ef9`.
- Release `v0.1.4` targets ancestor `0556716`; the candidate's later diff contains only factory documentation/evidence and Graphify output, no product runtime files. The deployment therefore matches the candidate product code.
- The release exposes macOS arm64/x64, Windows MSI/EXE, and Linux AppImage/DEB/RPM plus valid `latest.json` and `SHA256SUMS`. Downloaded `Change.Recovery.Ledger_0.1.4_x64-setup.exe`; its SHA-256 was `83cbc96c2b3b6905cdf855842d9b7502082081702f3696d9de8dd6ed801a5ddc`, matching `SHA256SUMS`.
- Live demo flow: selected `src/auth/session.ts` plus `src/editor/autosave.ts`, confirmed the safety checkpoint dialog, observed exactly those two files restored, and observed the other two files untouched. Reset then exported `recovery-cp-3.patch` (264 bytes) containing a unified diff only; no command ran.
- Live demo request log contained only `https://agent-change-recovery.sociobot.in`. Landing makes the disclosed additional request only to `https://api.github.com/repos/B-Divyesh/sf-agent-change-recovery/releases/latest` for public release filenames. No analytics, raw Azure/OpenAI, sign-in, product-unlock, or other backend endpoint exists to rate-limit; rate-limit/sign-in checks are N/A.
- Response headers are sound: CSP limits `connect-src` to self and GitHub, includes `frame-ancestors 'none'` as a response header, and sends HSTS, `nosniff`, Referrer-Policy, and Permissions-Policy. Hashed assets are `public, max-age=31536000, immutable`.
- Production `/demo` service worker became `activated`, cached `recovery-ledger-v4`, and reloaded the sample offline.
- `scripts/verify-url.sh` passed live `/`, `/?demo=1`, `/privacy`, and `/terms`. No console or page errors appeared.
- Desktop and 390px mobile were checked. Mobile had no horizontal overflow; the menu and demo action were reachable. Keyboard Tab first focuses the skip link with a visible `rgb(20, 92, 112) solid 4px` outline; Enter moves to main. Reduced-motion emulation yields `0.00001s` animation/transition duration.
- Live Axe scan found **0 serious/critical** findings. Lighthouse mobile rerun: performance **97**, accessibility **100**, LCP **1209 ms**, TBT **204.5 ms**, CLS **0**.

## Release-blocking defects

| Severity | Finding | Evidence and required repair |
| --- | --- | --- |
| P0 | Local checkpoint storage is not encrypted, despite the brief's explicit “Local encryption” constraint and the fact that captured project files may contain secrets. | `save_snapshot` writes every captured file's raw bytes directly to the app-data `files` directory (`src-tauri/src/lib.rs`, lines 206–214); `load_snapshot` reads those raw files (136–142). AES-GCM exists only for an optional exported `.crl` patch (620–697), not for the routine ledger. Encrypt manifests and snapshots at rest with an app-managed/keychain-protected key or explicit user passphrase; add a demo/native claim proving plaintext project contents do not appear in ledger storage. |
| P0 | Configurable retention is absent and requested retention is ignored. | The UI always invokes capture with `retention: 7` (`src/main.ts`, lines 508–514); the native command explicitly discards both `pro` and `retention` with `let _ = (pro, retention)` (`src-tauri/src/lib.rs`, lines 303–323). Add a user-visible retention setting, prune exact old snapshots safely, and cover boundary values/recovery in a claim test. |
| P1 | `.factory/claims.json` does not list every visitor-facing claim, violating the claims contract even though some related unlisted unit tests happen to exist. | README promises “Records only the project folder you choose,” “Skips files over 2 MB,” “Creates a safety checkpoint,” and “Deletes local checkpoint snapshots” (`README.md`, lines 15–22); the landing/privacy pages also promise Git exclusion and project-file-safe ledger deletion. None has a corresponding entry in the 16-item manifest. Add an entry and exact demo/native observable test for each, or remove the claim. |
| P1 | The brief specifies a `$15/developer/month` subscription for persistent history, team policy, and encrypted recovery export. The live release instead says “No payment is required in this release” and has no Sociobot paid unlock, restore-purchase path, or paid-tier explanation. | This does not meet the researched monetization acceptance contract. Implement the documented Sociobot billing flow and required copy/restore verification, or explicitly revise the brief and handoff to an approved free-only scope. |

## Non-blocking observations

- The release workflow/artifacts themselves are healthy. The local full AppImage build is limited by this container's missing FUSE device, while the checksum-verified release AppImage is present.
- No third-party fonts/scripts are loaded. Generated art is self-hosted and the visual system is distinct and consistent with `.factory/design.md`.

## Next steps

1. Implement encrypted local ledger snapshots/manifests and configurable, enforced retention.
2. Complete `.factory/claims.json` for all remaining public promises and add the exact tests.
3. Implement or explicitly re-scope the paid tier through Sociobot billing.
4. Re-run fresh-clone claims, native tests, package build, and this live verification before release.
