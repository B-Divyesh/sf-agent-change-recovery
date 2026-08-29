# Demo sandbox

- Browser URL: `https://agent-change-recovery.sociobot.in/?demo=1` (also `/demo`; local: `http://localhost:4173/?demo=1`).
- Sample: four checkpoints from a realistic web-app session. The third checkpoint has four related session files and two failed tests.
- Main path: select one or more files, inspect the diff and command trail, create a safety checkpoint, then reverse or export a patch.
- Reset: choose **Reset demo** in the persistent yellow banner. **Start for real** removes every `demo:` browser key before opening the desktop download screen.
- Isolation: all browser demo mutations use `localStorage` key `demo:agent-change-recovery:ledger`. The real desktop ledger is never read while this banner is shown.
- Desktop sample: choose **Load sample project** on the desktop first-run screen. It creates an isolated `sample-project` inside app data, never reads a chosen project, and **Reset sample project** recreates it.
- Offline: visit once, wait for the service worker, then reload `/demo` without a network connection.
