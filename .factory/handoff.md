# Handoff — adversarial review 1

## Outcome

Review 1 is complete with verdict **FAIL**. The complete report is
[`review-1.md`](review-1.md). No product code was changed.

Blocking findings: broken Back-button scroll restoration; demo state retained on
exit; a dead-end **Start for real** route; no bundled native sample; advertised
but unavailable checkout; and inadequate network-privacy proof.

## Verification performed

- Fresh live Chromium contexts at 390×844 and 1440×900.
- One-click demo mutation, reversal, Reset, real-key sentinel, exit, request log,
  service-worker control, and offline reload.
- Live crawl of all routes, a missing route, and every discovered link.
- Route metadata/structure checks and live Axe injection: zero serious/critical
  violations.
- Every exact claims command from a clean clone after installing the documented
  Linux Tauri prerequisites: all exited 0.
- Full clean-clone suites: Playwright 23/23 and Rust 13/13.
- `npm run build:site`: PASS; main JavaScript 11,723 bytes gzip.
- Prior handoff repair statements checked against live behavior and source.

## Key evidence

- Browser Back from `/privacy` returned `/` near `scrollY=4136` while focus was
  on the off-screen landing H1.
- After demo mutation and **Start for real**,
  `demo:agent-change-recovery:ledger` remained.
- Reset removed only the demo key and preserved a seeded real-data sentinel.
- Direct live demo traffic was same-origin only and reloaded offline.
- `local-privacy` checks folder boundaries, not network egress.

## Working tree and next step

Pre-existing modified `graphify-out` files were left untouched and are excluded
from the review commit. Address findings in ID order, add claim coverage before
changing claim copy, and rerun the complete review rather than a diff-only check.
