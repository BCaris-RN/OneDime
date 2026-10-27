# OneDime status

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

## M4 checkpoint, F2–F4, October 26, 2026 (Hawaii)

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
build and focused strict TypeScript check passed. Exact-head CI is pending.

Open question: the F4 handoff references a separate “metrics doc,” which is absent from
the repository. F4 uses its explicit KPI list. “First-entry rate” means accounts with
any First Dime entry divided by all accounts; “first-dime rate” means accounts with a
verified First Dime entry divided by all accounts. Week-1/week-4 retention use current
last-seen timestamps as a cohort proxy. Return after a seven-day gap and suggestion
acceptance remain unmeasurable because their event histories are not stored. “Imports per
month” is represented by transaction-row counts because file-level import events are not
stored.

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
