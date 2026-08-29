# Handoff — repair verification 8

## Delivered

Repair source commit: `8306be7` (`fix: close verification-8 release blockers`).

- Native selective reversal now rejects symlinked destination components before it records a safety checkpoint and uses descriptor-relative, no-follow file operations on Unix while restoring or deleting selected files. The exact reproduced case is retained as `reversal_rejects_replaced_symlink_parent_outside_project`.
- Patch export preserves missing-final-newline state with standard `\\ No newline at end of file` markers. It now checks every selected file and gives a clear error for binary content instead of silently omitting it. The regression test runs GNU `patch --dry-run` against both normal and no-final-newline fixtures.
- The mobile selected-diff `<summary>` is a 44px minimum target and is covered at a 390px viewport.
- The privacy/README retention-encryption statement is registered as `retention-settings-encryption` with a native encrypted-storage and reopen regression test.
- Removed the `RECOVERY / 001` decorative label. The risograph visual direction remains intact.
- AppImage packaging now installs `file`, clears only generated AppImage staging on Linux, verifies AppImage/deb/rpm outputs in CI, and prepares a checksum-pinned GTK helper whose module links are idempotent. The app/site release is `0.1.6`; the service-worker cache is `recovery-ledger-v6`.

## Verification

- Exact pre-repair reproduction on `b44965734cdf0054c60486659a33ae61e97f107d`: `cargo test --manifest-path src-tauri/Cargo.toml reversal_rejects_replaced_symlink_parent_outside_project -- --nocapture` failed because the outside sentinel was modified. The same command now passes.
- Clean install: `npm ci` passed with 0 audit vulnerabilities.
- Browser integration: `npm test` passed, **32 tests**. It includes desktop and 390px mobile layout, keyboard dialog focus, Playwright Axe serious/critical checks, demo isolation, privacy request policy, service-worker offline/update behavior, release lookup fallback, and console policy checks.
- Native: `cargo test --manifest-path src-tauri/Cargo.toml` passed; `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` passed.
- Claims: all **28** commands from `.factory/claims.json` passed from the clean install, including `patch-export`, `chosen-folder-only`, and `retention-settings-encryption`.
- Static production build: `npm run build` passed. It emits 40.20 KB JavaScript (12.72 KB gzip) and 15.58 KB CSS (4.32 KB gzip) in `dist/site`.
- Local URL verification: `/opt/fleet/lib/verify-url.sh http://127.0.0.1:4173` passed with title, `lang=en`, one H1, one main, image alts, no unlabeled buttons, and no console errors.
- Desktop package: `CI=true npm run tauri build` passed and emitted the Debian package, RPM, and `Change Recovery Ledger_0.1.6_amd64.AppImage`. Debian extraction exposed an executable `/usr/bin/change-recovery-ledger`; RPM metadata reports version `0.1.6`; the AppImage is a valid ELF AppImage with offset `944632`.

## Checkout registration boundary

The application and native verifier use the required production mapping:
`https://api.sociobot.in/api/v1/products/agent-change-recovery/checkout`.

On 29 August 2026, both that production URL and the matching pilot URL returned `404 {"error":"enabled factory product","status":404}`. The public product catalog contains no `agent-change-recovery` entry, and this worker has no product-registration credential or supported registration tool. No unrelated product checkout was substituted. The factory billing owner must register/enable the `agent-change-recovery` $15/developer/month product; then recheck that URL returns the hosted checkout before announcing Pro sales.

## Deployment and release

The source is ready for push, static deployment to `dist/site`, and the `v0.1.6` desktop release workflow. Update this section with the pushed commit, deployment identity, and release assets after those operations complete.

## Operator action

Desktop artifacts remain unsigned. A signed macOS release needs the Apple certificate/notarization configuration, and Windows needs an Authenticode PFX. No signing material is stored in this repository.
