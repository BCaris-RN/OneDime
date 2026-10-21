# OneDime status

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

The coordinator run stopped at the end of R3 because the delegated operator reached
its account usage limit. R4–R8 were not started. The current checkpoint preserves
the confirmed F1 interpretation: First Dime keeps its existing XP; rank bonuses apply
only to Creator, Freelancer, Driver and Seller. The previously missing design sources
are now present in canonical main: `reference/pilot.html` (SHA-256
`D83A9DE592E5E26761FA00E23B30FCCAEF7C36428FC175D35E082F2F9736A45C`) and
`docs/designs/skins-report.md` (SHA-256
`6B01C8E6240FD493227E0B3B4F669CC1CBD38056ACE85D74E48E844E0F99AD63`).

No deployment, provider call, setting/secret/account action, tester invitation or
further merge is authorized or performed. Only PR #7 was authorized to merge, and it
merged in R1. Resume with Claude's review of PR #6 and the approved remaining R4–R8
sequence after this usage-limit stop.

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
