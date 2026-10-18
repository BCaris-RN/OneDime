TASK HANDOFF: OneDime, Phase 2 (The game)
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local).
Authorized: create branch week2-game from main AFTER Phase 1 is merged, push to it, open a PR.
NOT authorized: merge, deploy, public repo, live PayPal.

TARGET BRANCH: week2-game   BASE: main
SOURCE: /reference/pilot.html for UI and game rules. If missing, use placeholder UI and flag it.
PROCESS: follow docs/SDLC.md, including the definition of done.

GAME RULES (port exactly; rested XP is NEW and approved by Brandon)
  - Goal ladder (cents): 10, 100, 1000, 5000, 10000, 25000, 50000, 100000
  - XP = minutes worked + 10 per dollar earned + quest XP + 100 per rung claimed + rested bonus
  - Level = floor(sqrt(XP / 25)) + 1. Titles: Rookie, Clocked In, Grinder, Hustler, Pro, Machine, Legend
  - Streak = consecutive days with at least one entry, counting back from today (or yesterday)
  - Rested XP: each full day with no entry adds 25 to a rested pool, capped at 100.
    While the pool has XP, minutes earn double; the bonus drains the pool.
    Implement as a PURE function of the player's entry history (no stored counter).
  - Quests: port the 19-quest catalog from the pilot (ids, titles, XP) into code
  - Dates use the player's time zone (store players.time_zone, default from the browser)

RUNG RACE (server decides, never the browser)
  - Only VERIFIED entries count toward rungs (verification arrives in Phase 3)
  - When a player's verified total crosses a rung, insert into rung_claims in a transaction;
    the primary key on rung_cents means only the first insert wins. Losers get no error,
    just no claim.

MIGRATIONS (new)
  players.leaderboard_opt_in boolean default false
  players.time_zone text
  players.clock_platform text null, players.clock_started_at timestamptz null

API (every route requires a session and only touches that player's data)
  POST/GET/DELETE /api/entries        log, list, delete own entries
  POST /api/clock/in, /api/clock/out  out returns minutes for the log form
  GET  /api/me/stats                  totals, week, streak, XP, level, rested pool, per-site $/hr
  POST /api/quests/:id                toggle own quest progress
  POST /api/leaderboard/join|leave
  GET  /api/leaderboard               opted-in players ONLY: display name, verified total, XP,
                                      level, per-site verified totals, rung claims with time.
                                      Never email, notes or unverified amounts.
  Validate all input with zod. Amounts are integer cents >= 0, max 1,000,000.
  State-changing routes require JSON content type and a same-origin check.
  Rate-limit write routes.

FRONTEND
  Port the pilot's tabs: Log, Quests, Leaderboard, Playbook, Help, driven by the API.
  Keyboard usable, phone width, light and dark mode as in the pilot.

TESTS TO RUN
  - XP, level, streak and rested XP: unit tests incl. cap, drain, gap days, time zones
  - A player cannot read, change or delete another player's entries
  - Unverified earnings never claim a rung; verified ones do
  - Two players crossing the same rung at once: exactly one claim
  - Leaderboard excludes non-opted-in players and never returns email or notes
  - Invalid amounts (negative, float, huge) are rejected
  - Clock in/out returns correct minutes
  All pass locally and in CI.

DO NOT TOUCH: receipts, payouts, webhooks, Claude API (Phase 3); deploys; LICENSE;
  any game rule above beyond what is written here.

DESIRED OUTPUT: PR into main, NOT merged. Description: what was built, run steps,
  test results, open questions, and anything you were unsure about instead of guessing.

FALLBACK: if pilot.html or real keys are missing, continue with mocks and placeholders,
  and list what's waiting on Brandon.
