# Demo sandbox

- URL: `https://agent-change-recovery.sociobot.in/demo` (local: `http://localhost:4173/demo`).
- Sample: four checkpoints from a realistic web-app session. The third checkpoint has four related session files and two failed tests.
- Main path: select one or more files, inspect the diff and command trail, create a safety checkpoint, then reverse or export a patch.
- Reset: choose **Reset demo** in the persistent yellow banner.
- Isolation: all demo mutations use `localStorage` key `demo:agent-change-recovery:ledger`. The real desktop ledger is never read while this banner is shown.
- Offline: visit once, wait for the service worker, then reload `/demo` without a network connection.
