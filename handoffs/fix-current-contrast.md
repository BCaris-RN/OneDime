# OneDime: fix Current theme contrast

Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local).
Approved October 20, 2026 (Hawaii).
Repository: `G:\one_dime`, private `BCaris-RN/OneDime`.
Branch: `fix-current-contrast`, based on `main` at `ab7bc89` or later.

This brief records Brandon's direct instructions in this chat. The originally linked
`/mnt/user-data/outputs/handoffs/fix-current-contrast.md` was unavailable in the Windows
workspace; this is not a claim to have copied that external file. The later status handoff
reaffirms that this track is approved and precedes the Paper/Slate track.

## Scope

1. Audit every rendered text, control, and border pair in Current, in light and dark.
   Save the before table before modifying application colors. Include actual surfaces,
   interaction states, composited colors, and documented WCAG exemptions.
2. Change only failing color values, measuring the smallest changes that pass WCAG 2.2 AA
   and preserving hue where possible. Do not choose replacement hex values by guesswork.
3. Re-run the same audit and save an after table. List each changed token/declaration,
   its old/new value, and its measured reason for changing.
4. Capture before/after screenshots and add a failing contrast check to CI.
5. Run the existing checks unchanged and open a PR into main. Do not merge it.

Normal text needs 4.5:1; large text and essential visual indicators need 3:1.
Evaluate thresholds before rounding. Audit decorative and disabled elements with their
applicable exemptions; do not describe an exemption as a passing contrast measurement.

No changes to layout, copy, application behavior, or Paper/Slate skins. Do not touch financial
calculations, import parsing/matching, game rules, XP, milestones, quests, rested XP,
authentication, sessions, database schema/migrations, API contracts, or LICENSE.
No deploys, visibility changes, credentials, or live PayPal use. Sandbox/mocked test data only.
Brandon approves each merge and external operational action separately.

## Baseline differences to report in the PR

The supplied status handoff describes an earlier phase of the project. Current main is
`ab7bc89bf12134b8c0d5015c64298ac44021ac49`; phases 2-4 are already merged through PR #5.
`reference/pilot.html` exists locally. Payer names are stored in imported activity.
Main's Render configuration selects starter plans; the original beta branch selects free plans.
LICENSE contains AGPL-3.0 text.
These observations do not authorize changes to those areas or settle pending product decisions.
The local checkout initially held `week5-beta`; existing untracked proposal/skin handoff files
are preserved and excluded from this PR. `handoffs/skins-handoff-v2.md` is not present.

## Output and sequencing

The PR must include scope, baseline audit, before/after tables and screenshots, a color-change
table, commands and exact results, current primary documentation links, and open questions.
Work only on this branch. The skins track begins from updated main only after Brandon merges
this contrast fix. Nothing in this brief authorizes merging either PR.
