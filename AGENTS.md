```text
    .-'''''''-.
  .'  .-----.  '.        ___             ____  _
 /   /  ONE  \   \      / _ \ _ __   ___|  _ \(_)_ __ ___   ___
|   |  DIME   |   |    | | | | '_ \ / _ \ | | | | '_ ` _ \ / _ \
 \   \  10c  /   /     | |_| | | | |  __/ |_| | | | | | | |  __/
  '.  '-----'  .'       \___/|_| |_|\___|____/|_|_| |_| |_|\___|
    '-.......-'        earn your first dime. level up for real.
```

# AGENTS.md: how to work in the OneDime repo

Read this before every task. It applies to every agent (Codex app, Codex Cloud) and every branch.
Task-specific instructions live in handoffs/<phase>.md. A handoff can override task details and the style
defaults in this file, for that task only. It can NEVER relax the non-negotiables below: merges, deploys,
visibility changes, live PayPal and creating or changing secrets always need Brandon's explicit go-ahead
for that specific action. Nothing permits printing, logging or committing a secret, or using an employer
account. If a handoff seems to conflict with them, stop and ask in the PR.

## Who's who
- Brandon Caris: operator and owner. Decides scope, approves every merge, deploy and visibility change.
- Claude: lead and reviewer. Writes handoffs and reviews.
- You: implementer. Build from the handoff, test, open or update the PR, then stop and report.

## Non-negotiables (from docs/SDLC.md)
1. Brandon approves every merge, release and visibility change, each time. Never merge on your own.
   A merge to main that passes CI deploys the beta (.github/workflows/deploy.yml); that merge approval
   is the deploy approval. Never trigger a deploy any other way without his go-ahead.
2. One agent owns a branch at a time.
3. Sandbox PayPal only. Anything pointing at live PayPal: stop and flag it.
4. Secrets live in .env and Render settings only. Never print, log or commit them.
5. Personal accounts only. Nothing touches an employer account.
6. Money is integer cents everywhere. No floats for money, ever.
7. Check external docs live (PayPal, Google, Anthropic, npm) and cite the pages in the PR.
8. Unsure means ask in the PR, not guess.
9. Never automate, scrape or log in to any gig platform for players.

## Code style: write like one careful developer
The goal is a codebase that reads as if one person wrote it with consistent habits.
These rules apply to new code and code you touch for the task. Don't refactor unrelated files just to
match them; if something elsewhere is worth cleaning up, list it in the PR instead.

Comments
- Comment WHY, not WHAT. If the code already says it, delete the comment.
- One short line is usually enough. No paragraph docstrings on obvious functions.
- No "This function handles...", "Helper to...", "Note:" filler, no restating parameter names.
- TODOs name the reason: `// TODO: drop once Phase 3 verification lands`.

Naming and structure
- camelCase for variables and functions, PascalCase for types, SCREAMING_SNAKE for env-derived constants.
- Money variables end in `Cents` (`grossCents`, `feeCents`). Scaled integers say so (`hoursX100`, `milesX10`).
- Small modules with one job. Prefer plain functions over classes. Pure functions for game math.
- One error-handling pattern: route handlers throw typed errors (`NotFound`, `Forbidden`, `BadRequest`,
  `Conflict`), one Express error middleware turns them into JSON. No try/catch in every route.
- One validation pattern: a zod schema next to each route, parsed at the top of the handler.
- No dead code, no commented-out code, no unused exports, no "just in case" options.
- No emoji in code, logs or commit messages. Logs are short, lowercase, structured:
  `log.info("payout sent", { payoutId })`. Never log secrets, emails, notes or tokens.

Tests
- Test names read as plain sentences: `it("rejects a fee larger than the client paid")`.
- One behavior per test. Arrange, act, assert, with no comments labeling those steps.
- Failure cases are tested as carefully as the happy path.

Frontend
- Plain HTML, CSS and TypeScript. Match the pilot's look exactly (see /reference/pilot.html).
- Copy is short, plain and friendly. Sentence case. No exclamation marks except in celebration toasts.

## Commits and pull requests
- Commit author is Brandon's personal GitHub identity. Check `git config user.email` before the first commit.
- Small, focused commits. Imperative, plain subject, 50 characters or so, no prefixes or emoji:
  `Add per-mile stat to delivery shifts`, `Reject fees above the client total`.
- A body only when the why isn't obvious, wrapped at 72 characters.
- PR descriptions: what changed, how to run it, test results, doc links used, open questions. No marketing tone.

## README voice
Write the README the way Brandon would explain the project to another developer: first person ("I built..."),
plain, direct, and focused on decisions and reasons. Explain why money is integer cents, why verified totals
decide earnings rankings and rung eligibility (general XP only breaks leaderboard ties), why "AI reads, the
server decides", and why the routing rules exist.
End with a short "Built with" section that is honest about the tools:
"Built by Brandon Caris with Claude (lead and reviewer) and Codex (implementation), on the PayPal Developer Platform."
Never write "Claude + PayPal presents" and never imply PayPal or Anthropic endorse the project.

## ASCII art
Brandon likes ASCII headers. Use them deliberately, not everywhere.

1. README banner. Put this at the very top of README.md, inside a ```text fence so it renders in monospace:

```text
    .-'''''''-.
  .'  .-----.  '.        ___             ____  _
 /   /  ONE  \   \      / _ \ _ __   ___|  _ \(_)_ __ ___   ___
|   |  DIME   |   |    | | | | '_ \ / _ \ | | | | '_ ` _ \ / _ \
 \   \  10c  /   /     | |_| | | | |  __/ |_| | | | | | | |  __/
  '.  '-----'  .'       \___/|_| |_|\___|____/|_|_| |_| |_|\___|
    '-.......-'        earn your first dime. level up for real.
```

2. File headers. Use this exact shape, in each language's comment syntax, ONLY on the key files listed below.
   Line 1 is the tag, line 2 a rule, then one or two lines on what the file is for.

```ts
/*  (o) OneDime | src/game/xp.ts
 *  ----------------------------------------------------------
 *  XP, levels, streaks and the rested pool.
 *  Pure functions of a player's entry history.
 */
```
```prisma
//  (o) OneDime | prisma/schema.prisma
//  ----------------------------------------------------------
//  Every table. Money is integer cents. Rows belong to one player.
```
```yaml
#  (o) OneDime | render.yaml
#  ----------------------------------------------------------
#  Render blueprint: web service and Postgres. Brandon deploys.
```

   Key files that get a header: README.md, AGENTS.md, src/server.ts, prisma/schema.prisma, render.yaml,
   and the main module of each area (game rules, auth, PayPal, payouts, webhooks, exports, AI, each app's routes).
   Add a header when you create one of these files or touch it for a task. Don't sweep the repo adding them.
   Do NOT add headers to tests, small helpers, generated files or migrations.

3. Section dividers inside long files, sparingly:
```ts
// --- rung race -----------------------------------------------
```

4. ASCII only (no box-drawing or emoji characters), lines under 100 characters.
   Never draw third-party logos or trademarks (PayPal, gig platforms, Anthropic). The coin and wordmark above are
   OneDime's own.

## Definition of done
Every box in docs/SDLC.md's definition of done, plus: STATUS.md updated with the milestone, head commit,
test counts, CI status and what's next.
