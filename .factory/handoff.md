# Handoff — Change Recovery Ledger v0.1.0

## What was built

- Tauri 2 desktop app with a Rust snapshot core and a Vite/TypeScript interface.
- Local project checkpoints grouped by intent, command trail, changed files, and check state.
- File comparison against the previous checkpoint, with generated folders and files over 2 MB excluded.
- Selective reversal that creates a full safety checkpoint before touching selected files.
- Plain patch export that never executes the patch.
- Pro flow through Sociobot checkout and license verification. A cached active license permits more than seven checkpoints, retention of 30, 90, or all checkpoints, and AES-256-GCM recovery export. Export keys use Argon2 and a user passphrase that is not stored.
- One-click `/demo` with four realistic checkpoints, isolated `demo:` storage, reset, offline reload, selective reversal, and patch download.
- Risograph tactile collage identity, generated hero art, three-frame product walkthrough, responsive 390px layout, reduced-motion treatment, legal pages, 404, release detection, PWA shell, and installer scripts.
- GitHub Actions workflows for quality checks and unsigned macOS arm64/x64, Windows x64, Linux AppImage/deb release builds. The release workflow also publishes `SHA256SUMS` and `latest.json`.

## How to run and verify

```sh
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:site
```

Static deploy output: `dist/site` with `dist/site/index.html` at its root.

Desktop development:

```sh
npm run tauri dev
```

Linux needs the normal Tauri WebKit 4.1 development packages listed in the CI workflow.

## Verification completed on 2026-08-28

- `npm test`: 14/14 Playwright tests passed.
- Claim suite: selective reversal, patch export, demo isolation, same-origin demo requests, offline reload, and exact paid price passed.
- Accessibility: automated Axe checks reported no serious or critical findings on `/`, `/demo`, `/app`, `/privacy`, `/terms`, and the 404 state.
- Native tests: 5/5 passed, including path traversal rejection, ignored generated folders, free limit, and encrypted output.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run build:site`: passed. Initial JS is 10.22 KB gzip; CSS is 4.10 KB gzip; mobile hero is 44 KB WebP.
- Lighthouse mobile on the production build: Performance 99, Accessibility 100, Best Practices 96, SEO 100; LCP 2.1 s, CLS 0, total blocking time 20 ms.
- Visual review completed at 1440px and 390px. The mobile test asserts no horizontal overflow.
- `git diff --check`: clean.

## Storage and safety notes

- Native checkpoints live under the operating system’s app-local-data directory in `ledgers/<project-hash>`.
- Native patch and encrypted recovery exports live under the app-local-data `exports` directory.
- The app never writes its ledger into the watched project and never invokes Git commands.
- Restore accepts only relative paths without parent, root, or platform-prefix components.
- The first capture establishes a baseline. A later checkpoint is required before reversal can target a previous state.

## Needs operator action

- Register the paid product with the factory billing process if it is not registered yet. The client uses the slug-based Sociobot URL and contains no product ID.
- Add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `WINDOWS_CERT_PFX`, and `WINDOWS_CERT_PASSWORD` to GitHub Actions when signed builds are wanted. Without them, v0.1 packages are intentionally unsigned.
- Submit the Windows package to winget and complete macOS notarization after signing certificates are available.

## Known gaps

- The release metadata on the landing page stays in its calm “being published” state until the first GitHub Release finishes.
- Linux distribution beyond AppImage and deb, plus Homebrew and winget catalog submission, remains an operator distribution task.
- The app records commands supplied by the developer; it does not hook or run an agent process.
