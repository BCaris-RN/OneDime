# OneDime status

Updated Oct 17, 2026 (Hawaii). Branch: `week3-onedime-app`, base `9953600`.

| Milestone | Implementation commit | Validation | Next |
| --- | --- | --- | --- |
| M1: pilot and workspaces | `a76cd8997eab6e52baf88d7d6b1f883ec03f19b5` | 113 tests passed; build passed; audit clean; browser checks and 21 screenshots; CI passed | Complete |
| M2: exports | `dcedcc659f33276c1a0d552d8d0e3d817b8b36e2` | 125 tests; build/audit/browser passed; CI passed on f86605a | Complete |
| M3: sandbox PayPal | `d72e6a3799543ae963d4e571d633d2b549a26616` | 146 tests; build/audit/browser passed; CI green c436910 | Complete |
| M4: AI suggestions | `d6106584978b0dca4c60201c91854d8090d244a3` | 157 tests; build passed; privacy/schema/cache/global-budget mocks; browser missing-key fallback; CI green d9cb5e8 | Complete |
| M5: review preparation | `4c830f7b28f3897f90ca3adbb17b164cc1b579ff` | Fresh install/build, 168 tests in seven files, zero audit vulnerabilities; populated desktop/phone/dark checks and workbook download; CI green | Reviewer and operator checks |

CI: M1 head `d1576cd` passed push and PR runs (39092799143, 39092821772).
M2 CI passed on `f86605a` (39093119535, 39093122307). M3 CI passed on c436910 (39093913932, 39093915724).
M4 CI passed on d9cb5e8 (39094256924, 39094260104).
M5 implementation CI passed on 4c830f7 (39095146044 push, 39095148932 PR).
This documentation checkpoint follows that tested implementation; final head CI is linked in PR #4.
PR: https://github.com/BCaris-RN/OneDime/pull/4 (M5 ready-for-review transition after final head CI).
Implementation is complete; the SDLC reviewer/merge gates remain outstanding.
The six workspace tables use SQL migrations and bound queries with fixed identifiers.
Only First Dime feeds game progression. Pilot reference stays ignored and local.

History cleanup on main is accepted by Brandon; retained GitHub PR refs are his Support task.
No merge, deploy, live PayPal, public visibility or real credential use in Phase 3.
Missing keys will use mocks. Defaults: file exports only; payouts off; no XP for other tabs.
Open decisions: payout enablement, Google Sheets stretch, license, hosting and real sandbox keys.
Model claude-haiku-5-5, structured output API and pricing checked live at M4.
No real provider keys used; operator must validate real sandbox/AI connectivity.
Interactive Excel/Sheets import remains an operator check; file structures/downloads are tested.
Development-only Testcontainers/archiver emits a glob 10.5.0 deprecation warning; audit is clean.
Run `npm run demo` with Node 24 and Docker for a disposable fictional local demo.

## PR #4 review follow-up: gross or net

Brandon's override accepts either exact gross or exact net for a matching First Dime
payer/platform. Logged amounts stay unchanged; linked entries show gross, fee and net.
Other workspaces retain net matching. No correction flow was added.
Build and 172 tests passed, including fee-bearing gross/net/other amounts and concurrent
attempts to verify two entries with one transaction. Browser gross linking, visible
fee details and 390px layout passed with synthetic data and no console errors.
Final follow-up commit and exact-head CI results are recorded in PR #4.
