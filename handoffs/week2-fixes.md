# Week 2 fixes

Operator-provided review, dated Oct 14, 2026; supplied Oct 17, 2026 (Hawaii).
Original review target: PR #2, `week2-game`, head `44c3e34`.

## Required corrections

1. Clock-out uses whole minutes rounded down. Under one minute returns 0. Update tests.
2. Remove `reference/pilot.html` from Git tracking, retain the local file, and ignore `reference/`.
3. Rewrite Help for PayPal login, OneDime database storage, verified earnings eligibility,
   and opt-in leaderboard privacy. Remove Claude-account, honor-system and self-reported wording.
   Keep the Playbook daily loop, speed tips and never-automate-the-work rule, but remove the
   personal bigger-play section and personal project/science references.
   Scan `public/` and `src/` for `Claude`, `honor`, `self-reported`, `localStorage`, `Haline`, `frontend-craft`.

## Verify in code and tests; document in PR

- Dollar XP is `floor(total logged cents / 10)`; 199 cents gives 19 XP.
- Invalid IANA time zones are rejected.
- Duplicate clock-in and clock-out without a running clock return 409.
- Leaderboard order: verified total descending, then XP descending.
- Deleting an entry preserves rung claims.
- No live PayPal endpoints.

## Approved and reserved decisions

Rested XP starts at zero and accrues only from gap days after the first logged day;
the existing behavior is approved. License, Render plan, sandbox account attributes/email,
and actual sandbox credentials remain Brandon's decisions. Do not merge or deploy.

## Repository state discovered during corrections

PR #2 was merged externally at 2026-10-17 16:38:57 HST, as `78fb32e`, before these fixes
were committed. Corrections therefore belong in a separate PR against `main`, using
`codex/week2-review-fixes`. Do not modify the completed PR's original description.
