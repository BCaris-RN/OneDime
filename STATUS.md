# OneDime status

Updated Oct 20, 2026 (Hawaii). Current review track: `fix-current-contrast`, based on
main `ab7bc89bf12134b8c0d5015c64298ac44021ac49`. Runtime source commit:
`f6734602339372431b9b1609abab0ee56976cf6e`.

Current contrast fixes preserve the existing palette fills, layout, copy, and behavior.
The only runtime file changed is `public/styles.css`. Local build, 185 existing tests,
16 contrast regression check groups, strict contrast-script TypeScript, and the unchanged
browser suite pass. The browser exercised 3,912 Tab steps plus local inference/privacy/cache
checks. The current contrast audit passes with zero failing or uncovered pairs; the
immutable baseline intentionally fails. Final report hashes/counts, screenshot links,
candidate measurements, command evidence, and remaining limits are in
[the contrast review package](docs/contrast/review-evidence.md).

CI is pending publication of the review package; the PR will record its exact final head
and current check results. Claude review is pending for this contrast work and PR #6.
Brandon decides merges separately. No merge, deploy, settings change, or live payment.

## Previous Phase 4 checkpoint

Updated Oct 19, 2026 (Hawaii). Branch: `week4-playtest`, base `423c33d`.

Phase 3 merged as PR #4. Phase 4 follows `handoffs/week4-playtest.md`.

| Phase 4 checkpoint | State | Validation / next |
| --- | --- | --- |
| P1 payout review fixes | Complete | b32fdd4; build/178 tests passed; CI green 39214704838 and 39214736585 |
| P2 free on-device suggestions | Complete | 291a91c; 41.3 MB local model/runtime; build/170 tests/browser passed; CI green 39215863437 and 39215869049 |
| P3 missing pieces | Complete | 053a84d; build/177 tests/browser passed; CI green 39217131318 and 39217135956 |
| P4 accessibility/play-test | Complete | 6d24c54; build/179 tests/audit passed; 3,912 browser Tab steps, arrows, labels/captions, 320/390px and both themes; CI green 39219251774 and 39219258008 |

Checkpoint commits and exact-head CI links are tracked in PR #5.
No merge, deploy, public visibility change, live PayPal or payout enablement.

PR #5 bot review follow-up (Oct 19): First Dime earned totals stay in the work
month; linked paid totals use PayPal occurred_on, including Summary export month
and date-range filters. Migration 000006 now backfills legacy batch states and
flags ambiguous terminal values for manual review without resending. Node 24
build and 185 tests pass locally, including adjacent-month gross/net cases and
four isolated migration tests. The fix commit and exact-head CI results are
recorded in both bot review threads on PR #5. Review and merge remain pending.

P4 also preserves early batch webhooks against late create responses (6a4e011),
with SUCCESS/DENIED regressions. The browser checks every app and sub-tab, visible
focus above phone controls, persisted free suggestions and cache, public policies
and typed account deletion. Twenty-four P4 screenshots contain fictional data only.
Final source review found no remaining blocker. No Brandon play-test notes were
present in this file or PR #5 when checked.

P4 implementation head: `6d24c54d5652d4fd13caedf58500275a5a940d0c`.
Both [push CI](https://github.com/BCaris-RN/OneDime/actions/runs/39219251774) and
[PR CI](https://github.com/BCaris-RN/OneDime/actions/runs/39219258008) passed on that
exact head, including the browser checks. This documentation checkpoint follows
that verified implementation. Final documentation-head CI is linked in PR #5.
The final policy drafts were added in `d2ead81`; this documentation update keeps the
README, STATUS and SDLC roadmap aligned with the current app. PR #5 is ready for review
and remains unmerged. Next: reviewer play-test and Brandon's separate merge decision.
Do not merge.

Remaining operator checks: physical phone inference speed/screen-reader testing,
real sandbox connectivity, draft policy contact/jurisdiction/backup review and
zero-cost hosting. Existing prepared Render starter plans are not approved hosting.
Root LICENSE is unchanged. Reviewer/Brandon merge gates remain outstanding.

The root drafts `privacy_policy.md` and `user_agreement.md` are plain-language play-test
documents, not legal advice. Brandon must review them before public use.

## Phase 3 checkpoint history

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
No real provider keys used; operator must validate real sandbox connectivity.
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
