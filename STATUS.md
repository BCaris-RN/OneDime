# OneDime status

## S7 final coordinator report, October 29, 2026 (Hawaii)

Merged main candidate: `d43b9f184f252b56d4087915565a5c3fedf49d1d`.
No deployment was made. S1 and S4 merged only after their conditions passed.
S2 is held for Claude's rank-persistence review; S3 and S5 are dependency-blocked.
This final metadata checkpoint is pushed on week5-features; its own SHA and final
CI run are recorded externally in the review ZIP manifest/API to avoid self-reference.

| PR | Reviewed/checkpoint head | Merge SHA / disposition | CI evidence |
| --- | --- | --- | --- |
| #13 security | `1ff3a15157dec26da1d6bfd1d8f98449b2cec787` | Merged `81c0bc1d48bc29def97c2f827833ab77731c2e8c` | 41005618843, all required steps passed; exact-head bot had no findings; audit zero vulnerabilities |
| #9 Phase 5 | `49e249e2ac98424fc153e32d97365fa6ba84be4b` before final metadata/rebase | NOT merged: open rank-persistence finding exceeds S2's hourly-only calculation allowance | 41006890083 passed all steps at that checkpoint; 270 local application tests; final metadata CI recorded in ZIP |
| #11 demo | `6b0b51da5d105565e5b23f07d61841a91bcf31b0` | NOT merged/rebased: S3 depends on #9 merging | Prior 40470836379 passed; not a test of integration with new S2 |
| #12 skins | `f77a5e63dfb66c74a65c06de271e8d780597e449` | NOT merged/rebased: S3 depends on #9 merging | Prior 40475677029 passed; post-rebase skins/grid gate not reached |
| #10 ship docs | `13ce351b8b603e04971e82c176712ed6137323b2` | Merged `d43b9f184f252b56d4087915565a5c3fedf49d1d` | 41007100855, all steps passed; exact-head bot had no findings; four docs only |

Claude: review the unresolved finding in src/game/professions.ts. Displayed ranks
and class currently fall after deleting supporting matched records despite retained
permanent rank claims/XP. Define the bounded persistence correction, including
Starter behavior, before changing rank calculations. The hourly-fee finding was
fixed within S2 and resolved; all seven original findings were replied to/resolved.
Final review at `44849b3` also confirmed that scripts/metrics-report.ts averages
apps only over accounts with records, omitting zero-record accounts. This overstates
the labeled apps-per-account KPI (two apps in one of ten accounts gives 2.00 rather
than 0.20). This additional metric-calculation finding is left open for Claude too;
no metric definition was changed outside S2's enumerated fixes. Both open threads
have source-confirmation replies. The final update is status-only; runtime bytes
remain identical to the fully passing 49e249e checkpoint.

Brandon: no new Render variables/settings are required for merged S1/S4. Any deploy,
tester/policy/account work remains a separate action. Do not treat main as containing
the unmerged Phase 5, demo tooling or skins. Review material is generated at
`C:\Users\bwcar\Downloads\OneDime-S2-review-2026-10-29\onedime-s2-review.zip`.

## S5 recording checkpoint, October 29, 2026 (Hawaii)

No new recording was run: S5 requires S3, which requires the blocked S2 merge.
The recorder and fictional-label mode remain in unmerged #11, not main. Existing
ignored preview videos were preserved and are not represented as final recordings.
The ship script now explicitly requires both #9 and #11 before filming.

## S6 redeploy preparation, October 29, 2026 (Hawaii)

Candidate main `d43b9f184f252b56d4087915565a5c3fedf49d1d` has nine migrations
(000001-000009), unchanged from the prior deployed-candidate baseline. S1/S4 add no
migrations. 000010_profession_rank_claims, 000011_feedback_stats and
000012_first_run_welcome remain pending in #9 and will apply only after that feature
branch is reviewed, merged and separately deployed.

render.yaml remains unchanged: both plans free, PostgreSQL 16, /health, automatic
deployment off, sandbox PayPal, payouts/Sheets/demo seed off. No new operator-entered
variables or settings are required by S1/S4. No hosted-state or credentials were
inspected or changed. No deploy was performed.

Skills: Code Reviewer and Security Best Practices were used on each PR worked in
this run before ready/merge gates; Playwright guided the mandated existing browser
runners. Local build/typecheck and 270 application tests passed; beta covered 18
combinations/22 pairs, Current contrast 24 regression groups with zero failing or
uncovered pairs, and browser 4,288 focus steps plus offline/privacy checks passed.
An initial local test command failed on five incomplete copied suites in untracked
review archives; excluding only reviews/** passed the full application suite. A
local reinstall collided with the active contrast fixture's Windows Prisma DLL;
the owned fixture was stopped and a clean install/build then passed. No assertion,
timeout, test configuration or database durability setting was weakened.

## S1 security checkpoint, October 29, 2026 (Hawaii)

PR #13 (`deps-security`) head `1ff3a15157dec26da1d6bfd1d8f98449b2cec787`
changes only package-lock.json: body-parser 2.4.0, undici 8.12.2 and required qs 6.16.1.
Node 24 install, build, strict contrast typecheck and 236 tests pass locally;
npm audit reports zero vulnerabilities. Bot review on this exact head completed with
no findings. Every required step of full CI run 41005618843 passed; the tested merge
tree equals the branch head tree. S1 merged as `81c0bc1d48bc29def97c2f827833ab77731c2e8c`.
STATUS is recorded on the coordinator branch to keep PR #13 dependency-files-only.
No deployment.

## S2 fixes in progress, October 29, 2026 (Hawaii)

Prepared the routed-payment first-record quest fix, all-timed-work Stats hourly input,
before-fees tile label, matched-payment copy, README XP clarification and six-tab spec.
Copied the supplied review's Oct 21/29 updates to the canonical reviews path. Tests,
final exact-head CI and bot review remain pending. Rebase onto S1 main is complete.
The application suite passed 270 tests across 13 files locally; the initial unfiltered
run also discovered untracked archive test copies and failed five archive-only suites.
Rerunning with only `reviews/**` excluded passed all application tests. Six outdated
threads and the current first-record thread have fixing-commit replies and are resolved.
Money, XP and rank calculations are unchanged except the authorized Stats hourly input.

The fresh bot review of `53e597e` found a real rank-persistence defect: profession
views derive ranks from remaining matched cents, ignoring permanent claims after
record deletion. Fixing that requires a rank-calculation change beyond S2's merge
allowance. PR #9 will stay unmerged for Claude; S3 and S5 depend on that merge and
cannot proceed. The hourly-fee finding is being corrected within S2's hourly scope.
S4 documentation can proceed independently, with unmerged features explicitly labeled.

S2 hourly-fee correction `b0da6f97e30b7a8c386033bdac2b970bbf8aab47` passes all
270 application tests locally, including gross/share preservation and net hourly
earnings for an unmatched fee-bearing gig. Its bot thread has a fix reply and is
resolved; rank persistence remains open. A review ZIP for Claude will include the
final source and current CI/review evidence. No S2 merge is permitted in this run.

## S3 dependency checkpoint, October 29, 2026 (Hawaii)

PR #11 remains at `6b0b51da5d105565e5b23f07d61841a91bcf31b0`; PR #12 remains
at `f77a5e63dfb66c74a65c06de271e8d780597e449`. Neither was rebased or merged:
S3 explicitly starts after S2 merges, and S2's rank-persistence finding prevents that.
Their previous CI successes do not validate integration with the new S2 code.

## S4 documentation checkpoint, October 29, 2026 (Hawaii)

PR #10 is rebased onto security main and updated at
`686c314c2b7846ff60e041875cdc3ba6f1d2d909`. Only docs/ship files change.
Copy uses matched activity-file wording and explicitly marks #9/#11/#12 unmerged.
Code Reviewer and Security Best Practices skill reviews found no actionable issues
before marking the draft ready. Exact-head full CI run 41006770181 is running;
merge remains gated on CI success and a documentation-only diff. No deployment.

## M2 checkpoint, October 26, 2026 (Hawaii)

Branch `week5-features`, based on M1 main `756cc93e2f6a8a99db5861ca030bbbdefb7bd197`.
F1 implementation commit: `ab7f3010724b9956aa47d0c67d0eb935afa364ec`.
F1 adds verified Creator, Freelancer, Driver, Seller and Starter ranks across the
workspaces; only the four non-Starter ranks grant one-time 100 XP bonuses. Spotlight,
Freelance and Market award 10 XP per verified dollar. First Dime's existing XP, streak,
rested XP and rung behavior remain unchanged. Verified ranks are backed by permanent,
player-scoped claims; migration 000010 backfills eligible claims from existing routed
payments. The feedback/rank UI shows each title, current verified total and next threshold.

Local Node 24 validation: Prisma generation, build, contrast typecheck, and the full
PostgreSQL-backed test suite passed (245 tests across 10 files) with Docker available.
The suite applied migration 000010 successfully. `git diff --check` passed. Exact-head
GitHub CI is now required for this checkpoint. No merge or deployment was performed.
M2 exact-head GitHub CI passed on `40260f5660d1be37d2f1df4477201500f85b21cf`, run
[40434950807](https://github.com/BCaris-RN/OneDime/actions/runs/40434950807). Build,
contrast typing, 245 tests, beta, contrast and browser checks all passed. Continue on
the same branch for M3.

## M3 checkpoint, October 26, 2026 (Hawaii)

F5 Stats is implemented on `week5-features`: `/api/stats?month=YYYY-MM` is an
authenticated read-only, player-scoped snapshot with six monthly net totals, verified
share inputs, timed verified rates, activity days/streak, and F1 profession ranks.
Its all-app earned total reuses the same owned ledgers and month summaries as
`/api/overview`; imported PayPal transactions are not added a second time. The UI
adds the Stats tab and pixel charts/tables, token-driven chart ink, reduced-motion
support and finite stepped animations. Stats is also accepted by feedback storage and
export through migration 000011.

Local build passed. The endpoint integration test confirms October's 322-cent total
matches overview and excludes another player's larger entry. The first M3 head,
`f36c991b023739d9407fb86c9b209b52b29fc86f`, passed CI build, contrast typing, all 245
tests, beta and contrast; its browser check caught stale navigation expectations. The
feedback-export count was corrected from seven to eight and its focused test passes.
The corrected browser audit includes Stats, all three charts and table toggles, and
Stats screenshots at 320/390/1280px in both themes. The full browser suite passed
locally with 4,280 focus steps plus the smart checks. Desktop focus coverage now checks
controller overlap only when the controller is fixed; fixed-controller checks remain
active on phone layouts. Exact-head CI passed on `8605d61d418e328f1c982823f2ed3d663e783fd0`,
run [40444881023](https://github.com/BCaris-RN/OneDime/actions/runs/40444881023): build,
strict contrast typing, 245 tests, beta, contrast and browser checks all succeeded.

Open question for review: the existing PayPal workspace remains a top-level tab, so the
six tabs render 3+3 on phones; Stats is fifth after Market. The requested 3+2 layout
assumes five tabs and conflicts with retaining PayPal as a top-level workspace. No
navigation behavior was removed to resolve that conflict.
No merge or deployment was performed.

## M4 checkpoint, F2–F6 plus review fixes, October 26, 2026 (Hawaii)

First-run welcome is backed by `welcome_completed_at`. Migration 000012 marks existing
players as already welcomed, so only accounts created after rollout see it. The
multi-select choice is used to open the first selected workspace and is not retained;
only the completion timestamp is stored. A zero-XP “Start your record” quest completes
automatically after the first logged entry or newly imported PayPal activity. Repeated
imports do not create duplicate quest progress.

The install manifest, generated 192/512 pixel coin PNGs, offline page, and service worker
are in place. Cache rules allow only static shell/CSS/JS/font/runtime/model assets; `/api`
and all non-static routes bypass Cache Storage. The browser check verifies no API path is
cached and confirms the offline shell and in-app offline message. Phone navigation now
uses three columns for the six existing top-level tabs; the F5 3+2 wording still assumes
five tabs, so this branch keeps PayPal and shows 3+3.

Local Node 24 build and strict contrast typing passed. Four focused server tests passed
for onboarding privacy/ownership, quest completion, static install files, and one-time
choices; all 12 migrations applied. The full browser matrix and offline smart check passed
before the final change to stop retaining selected work types; focused tests and build
passed after that change. Exact-head CI run [40449244381](https://github.com/BCaris-RN/OneDime/actions/runs/40449244381)
passed build, typing, all tests and beta checks but failed the contrast browser because
its fixture clicked workspace tabs while the new first-run modal was open. The contrast
runner now measures the welcome modal in both themes/OS schemes, dismisses it, then
continues its existing audit. Local `npm run test:contrast` passed: 24 regression checks,
zero failing pairs and zero uncovered pairs. Exact-head CI passed on
`0a0c6cdbb9c033e86510a1ab2afdaec21f0eadc7`, run
[40451790082](https://github.com/BCaris-RN/OneDime/actions/runs/40451790082): build,
contrast typing, unit tests, beta, full contrast audit and browser suite all passed.
Full suite, contrast, browser and npm audit are required again at the final F2–F6
checkpoint. No merge or deployment was performed.

F4 adds `npm run metrics:report`. It runs in a read-only repeatable snapshot and writes
`metrics/metrics-<UTC date>.md` under the root gitignored output directory. The SQL
returns only counts, cents and rates; no player identifiers, names, emails, notes,
transaction IDs or other free text enter the report. It uses F1 matching rules for
verified totals, counts imported PayPal transaction rows by creation month, and includes
first-entry/first-dime rates, time to first verified entry, active days, apps per account,
retention proxies, verified share, mismatch, hourly rate and feedback totals. A fresh
PostgreSQL 16 database applied all 12 migrations; a synthetic verified record plus a
same-day unverified duplicate produced $10 verified / $20 logged and one import. Sentinel
account and free-text values were absent from the report. Formatter tests: 2 passed;
build and focused strict TypeScript check passed. Exact-head CI passed on F4 code head
`cd44609df7a617ea7e9abd8418d53a637ab361c8`, run
[40455059177](https://github.com/BCaris-RN/OneDime/actions/runs/40455059177): build,
contrast typing, unit tests, beta, full contrast and browser checks all succeeded.

Open question: the F4 handoff references a separate “metrics doc,” which is absent from
the repository. F4 uses its explicit KPI list. “First-entry rate” means accounts with
any First Dime entry divided by all accounts; “first-dime rate” means accounts with a
verified First Dime entry divided by all accounts. Week-1/week-4 retention use current
last-seen timestamps as a cohort proxy. Return after a seven-day gap and suggestion
acceptance remain unmeasurable because their event histories are not stored. “Imports per
month” is represented by transaction-row counts because file-level import events are not
stored.

F6 adds a Tax summary sheet to “Export everything” (XLSX and ZIP/CSV), with year, month,
app, existing recorded-income totals, platform fees, expenses and delivery miles in
tenths. It includes the required “For your records. Not tax advice.” note. This is derived
from the export's existing monthly summary rows; no financial calculation changed.
Validation passed locally on Node 24: build; full suite (253 tests / 11 files); tax-sheet
unit tests (12); focused authenticated export integration (1 passed, 151 intentionally
skipped); full browser audit (4,288 Tab steps across workspaces/sub-tabs and
320/390/1280px in both themes); and `npm run test:contrast` (24 regressions, zero failing
pairs, zero uncovered pairs). The synthetic F4 PostgreSQL smoke test also passed.
`npm audit` reports two high-severity dependency advisories, in `body-parser` and
`undici`; dependency remediation is not part of this feature scope and was not attempted.
Exact-head CI passed on F6 code head `96961e8167d4e6696e8fbeecb6f6a20873f11e5e`,
run [40460759441](https://github.com/BCaris-RN/OneDime/actions/runs/40460759441): build,
contrast typing, all tests, beta, full contrast and browser checks succeeded.

Codex's reviews on `ec62453b9f4e82e5638300df29d7b294a3de34f3` and
`bf44ca29faf511b17a9dedadac571327d3cbd8a5` found six in-scope issues. The migration
backfill now awards profession thresholds using the same gross-or-after-fee matched
amount as runtime; the Stats verified share uses the overview's gross basis; all four
manually logged income record types complete the zero-XP first-record quest; and
negative monthly totals render below zero using separately scaled positive and
negative stacks. Static app assets revalidate online and fall back to cache offline,
and Stats preserves hundredths of a minute when aggregating freelance hours.
Regression tests cover fee-bearing and fractional-time Stats values, all four
workspaces' manual first records, positive/negative chart geometry, and the service
worker's online, offline and API behavior. The next re-review found that F4 counted
gross instead of the matched after-fee amount for fee-matched gigs and sales. F4 now
reports exact matched cents in both monthly and aggregate verified totals while
retaining gross logged totals. A PostgreSQL regression routes $9 payments against $11
gross / $2 fee gigs and sales and checks $18 verified / $22 logged in both query
outputs. The executable report is guarded for safe query imports. Local Node 24
validation at this correction: build passed; 264 tests across 13 files passed; Current
contrast reported zero failing and zero uncovered pairs; browser audit passed 4,288
focus steps across five workspaces plus Stats and PayPal, all sub-tabs, 320/390/1280px
in both themes, and offline/smart checks. `npm audit` reports two high-severity
advisories in `body-parser` and `undici`; no dependency changes were made. Exact-head CI
passed on `9712d35e3f62fb8cd5ca3c6fe63e9f34e0166426`, run [40466191713](https://github.com/BCaris-RN/OneDime/actions/runs/40466191713): build,
contrast typing, 264 tests, beta, contrast and browser checks succeeded. The automated
review service failed twice before producing a code review, reporting that it could not
find the repository; a manual request for the exact head is still outstanding.

## M5 checkpoint, October 26, 2026 (Hawaii)

Ship drafts are on branch `ship-drafts`, PR #10, based on main. Its four files are
limited to `docs/ship/`: the build story, under-2:50 video script, Devpost draft and
judge try-it guide. They describe only implemented features and label the open Phase 5
PR as pending. Exact-head CI passed on
`33686563421209022884856773f44253fdc8ef48`; PR #10 remains a draft and unmerged. The
script still needs M6 demo recordings before it can be followed end to end.

## M1 checkpoint, October 26, 2026 (Hawaii)

PR #6 was merged after Brandon's explicit approval at main commit
`1620383a81dcd80242989b661fdf3f5d44fabad3`. PR #8 was rebased onto that main,
passed exact-head CI, and was merged after Brandon's explicit approval. The M1
beta deploy candidate is main `756cc93e2f6a8a99db5861ca030bbbdefb7bd197`.
The Render configuration check is complete on that main: both services use the
Free plan, PostgreSQL 16 is pinned, `/health` is the web health check, auto-deploy
is off, and `BETA_ALLOWLIST` is `sync: false`. No deployment or Render setting
change was made.
Only `SESSION_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_REDIRECT_URI`, `PUBLIC_BASE_URL`, and (if enabling a private beta)
`BETA_ALLOWLIST` require operator-entered values. PayPal values come from a personal
sandbox app; the callback and base URL use the Render service origin; the allowlist
comes from Brandon's approved sandbox testers. `SESSION_SECRET` is a newly generated
random secret. Other `sync: false` entries are reserved and should remain blank for
this beta (`PAYPAL_WEBHOOK_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`TOKEN_ENCRYPTION_KEY`). The database URL is wired by the Blueprint; other fixed
settings are supplied by `render.yaml`.

The Oct 21 long-run handoff was supplied on this branch as untracked input and defines
M2–M8. The pilot is Git-ignored and the skins report is untracked input; both are
available locally and will be included in their review materials as directed.

R3 checkpoint, October 20, 2026 (Hawaii), branch `beta-allowlist`.
Stacked parent: `week5-beta` at `214307161bcd544ae02ac1eadf111a6e9b5a3ec8`.
Main remains `4be44f57dd18e4ed7dd80eb3666e525f2f9bb955` after the authorized R1
merge of PR #7. R2 final CI [39523317686](https://github.com/BCaris-RN/OneDime/actions/runs/39523317686)
passed at that parent; PR #6 is ready, unmerged, and awaits Claude's source review.
Its verified source ZIP is
`G:\one_dime_worktrees\long-run-beta\reviews\claude-pr6\onedime-pr6-source-review.zip`,
SHA-256 `4fcdc63bd7dde47226bf950482c317f93f39a626746899a7c4be4ae5254ea457`.

R3 implements only the approved tester allowlist: exact normalized provider email
before account/session creation, central rejection/revocation of removed sessions,
a static token-styled beta page, private environment configuration and targeted tests.
Unset/blank keeps old behavior; invalid nonblank configuration fails with no input
echo. No list or rejected email is logged. Financial, game and other authentication
rules remain unchanged. Local build/typecheck and targeted test evidence are saved
under `reviews/beta-allowlist/`. Focused auth/config coverage passed 41 tests (118
filtered tests intentionally excluded from that targeted invocation); the beta page
matrix covered 18 mode/OS/width combinations, with 19 passing contrast pairs, 3
documented exemptions, zero failures and zero uncovered pairs. Six local screenshots
are retained for review.

Exact-head CI passed on `68ac0406d2c1531541b3abff3cbebd9559ac2353` in run
[39526082045](https://github.com/BCaris-RN/OneDime/actions/runs/39526082045): build,
strict contrast/browser typing, all 236 unit tests, beta-page browser check, full
Current contrast suite and full browser suite all succeeded. The first implementation
run on `ccf4b78` failed only the new focus-visible audit because the runner had entered
pointer modality; the fix uses a real Tab before asserting focus-visible and retains
the assertion. The full final CI rerun passed. PR #8 remains a draft and unmerged,
stacked on PR #6; see [R3 review package](reviews/beta-allowlist/README.md).

Historical Oct 20 coordinator checkpoint: the prior run stopped at the end of R3
because the delegated operator reached its account usage limit. R4–R8 had not started
at that time. This checkpoint preserves
the confirmed F1 interpretation: First Dime keeps its existing XP; rank bonuses apply
only to Creator, Freelancer, Driver and Seller. The previously missing design sources
are now present in the canonical working copy as local supplied files, but are not
tracked by `main`: `reference/pilot.html` is ignored by Git (SHA-256
`D83A9DE592E5E26761FA00E23B30FCCAEF7C36428FC175D35E082F2F9736A45C`) and
`docs/designs/skins-report.md` is untracked (SHA-256
`6B01C8E6240FD493227E0B3B4F669CC1CBD38056ACE85D74E48E844E0F99AD63`).

No deployment, provider call, setting/secret/account action, tester invitation or
further merge was authorized or performed during that prior run. Only PR #7 was
authorized to merge then, and it merged in R1. This historical checkpoint is
superseded by the M1 checkpoint above.

## Preserved R2 checkpoint

Updated October 20, 2026 (Hawaii). R2 beta validation checkpoint on `week5-beta`,
rebased onto main `4be44f57dd18e4ed7dd80eb3666e525f2f9bb955` (merged PR #7).
Reviewed implementation head: `72abfe22920eebcd628bb1123678fc19bb0c9380`.
PR #6 is ready for review and remains unmerged. Claude source review and Brandon's
separate merge approval remain required.

R2 preserves Current colors and the existing feedback/menu styles. The only new
hosting fields are PostgreSQL 16 and `/health` readiness. The permanent contrast
runner covers the real menu and empty, invalid, error, sending and sent feedback
states in both selected themes against both OS schemes. Modal scans exclude inert
background controls, and neutral native checkbox references share the modal top
layer. Policy redirects are checked without fetching third-party destinations.
No financial, import, authentication or game-rule changes were made during R2.

Local Node 24 build, strict contrast/browser/export typing, 208 tests in nine files,
24 contrast regression groups, and the complete browser suite all pass. The browser
covers 3,920 Tab steps across five apps/all sub-tabs at 320/390px in both themes,
feedback validation/rate-limit/submission/focus/deletion and local inference/privacy/
cache checks. The contrast audit records 242 unique semantic/color pairs: 163 passes,
79 explicit exemptions, zero failures and zero uncovered pairs. Dependency install
and full npm audit pass with zero vulnerabilities. Verified process exit codes and
failed/interrupted initial attempts are retained in `reviews/claude-pr6/evidence/`.
No test timeout, assertion or database durability setting was weakened.

All steps in [implementation CI 39519609047](https://github.com/BCaris-RN/OneDime/actions/runs/39519609047)
passed on the exact reviewed implementation head above. The code bot completed on
that head with no findings or unresolved findings (summary comment 6304773647);
Claude approval and a separate security-review result are not implied. Protected
runtime, scripts, Prisma, existing tests, package, workflow and Render files remain
unchanged after that head; later changes only finalize evidence/status/packaging.

Final metadata-head CI must be green before source-package generation and R3.
The generator verifies the exact final head, matching tested merge/head trees, and
successful required CI steps. The ZIP manifest and generated `ci-final.json` record
that final metadata SHA and run without a self-referential source edit. Current head
and checks are visible on [PR #6](https://github.com/BCaris-RN/OneDime/pull/6/checks).
The stable source ZIP path is
`G:\one_dime_worktrees\long-run-beta\reviews\claude-pr6\onedime-pr6-source-review.zip`.
It contains the complete binary diff, full changed source/test files, manifest and
bot/CI evidence. [Review notes](reviews/claude-pr6/README.md) record coverage and limits.

Next: the coordinator starts R3 after the final CI/package gate, keeping PR #6
unmerged. The previous QA branch `codex/beta-qa` remains preserved at `b803d91`.
Only PR #7 was authorized to merge, and it merged in R1. No deployment, hosting
settings change, account/secret handling, provider call, tester invitation or payout
enablement occurred. PayPal remains sandbox-only; payouts, Sheets and demo flags
remain off. Policy wording, tester access, free-tier limits, private feedback retention,
physical devices, screen readers and real sandbox connectivity remain operator gates.

## M8 coordinator checkpoint, October 26, 2026 (Hawaii)

| Branch / PR | Head SHA | Exact-head CI | Contents |
| --- | --- | --- | --- |
| `week5-features` / [#9](https://github.com/BCaris-RN/OneDime/pull/9) | `fc6f5bcce37da815c57ca0dbe52649c3da857bad` | Run `40466913789` failed only at the browser assertion on PayPal selection; failed-job retry is running. Local `test:browser` passes at this code head. | M2–M4: ranks, Stats, first run/install, metrics report, tax export, review fixes. |
| `ship-drafts` / [#10](https://github.com/BCaris-RN/OneDime/pull/10) | `33686563421209022884856773f44253fdc8ef48` | Passed, run `40463830282`. | Four `docs/ship/` drafts: build story, video script, Devpost draft, judge guide. |
| `demo-video` / [#11](https://github.com/BCaris-RN/OneDime/pull/11) | `6b0b51da5d105565e5b23f07d61841a91bcf31b0` | Passed, run `40470836379`. | Demo recording tooling and draft video assets; recordings remain local and ignored. |
| `week5-skins` / [#12](https://github.com/BCaris-RN/OneDime/pull/12) | `f77a5e63dfb66c74a65c06de271e8d780597e449` | Passed, run `40475677029`. | Current/Paper/Slate appearance choice, tokenized theme styling, contrast audit/report, browser coverage. |

Claude review is still outstanding for PRs #9–#12. The available automated review
comments on #9 cover earlier commits only, not its latest code head. Wait for Claude's
review of the current heads before Brandon considers a merge. Brandon's merge order
after review is `week5-features` first, then rebase `demo-video` and `week5-skins`
onto the updated main before considering them; `ship-drafts` can be reviewed and
merged at any time. No PR from this table is merged or authorized to merge in this run.

The beta deployment candidate remains main `756cc93e2f6a8a99db5861ca030bbbdefb7bd197`.
No deployment or Render setting change was made. The Current/Paper/Slate browser and
contrast CI on #12 passed. Known review risks remain: `npm audit` reports two high
advisories (`body-parser`, `undici`) outside this feature scope; the existing six-tab
navigation keeps PayPal and therefore renders 3+3 on phones, while F5 says 3+2; and
the CI browser failure on #9 must be cleared on the final pushed head before merge.
