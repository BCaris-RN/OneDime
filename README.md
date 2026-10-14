# OneDime

OneDime is a small TypeScript/Express app with PayPal sandbox login, PostgreSQL-backed sessions, and a plain HTML/CSS/TypeScript frontend.

## Week 1 scope

- Express server with `GET /health`
- PayPal sandbox OAuth/OpenID Connect login
- PostgreSQL sessions with signed, httpOnly cookies
- Prisma schema and checked-in migration for Week 1 through Week 3 tables
- Plain frontend shell for landing and logged-in tracker views
- Vitest coverage for auth/session/database constraints
- GitHub Actions test workflow
- Render Blueprint for a web service plus Postgres database

## Local setup

1. Use Node.js 24 LTS, then install dependencies.

   ```bash
   npm ci
   ```

2. Copy the environment template and fill in local sandbox values.

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and set `DATABASE_URL` in `.env`.

4. Apply migrations.

   ```bash
   npm run db:migrate
   ```

5. Build and run the app.

   ```bash
   npm run build
   npm start
   ```

6. Open `http://localhost:3000`.

## Environment

Secrets are loaded from `.env` only. Do not commit `.env`.

- `DATABASE_URL`
- `SESSION_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_REDIRECT_URI`
- `PUBLIC_BASE_URL`
- `COOKIE_SECURE`

The PayPal integration is sandbox-only. The app rejects non-sandbox PayPal endpoint configuration.

## Tests

Run:

```bash
npm test
```

When `DATABASE_URL` is unset, tests start a temporary PostgreSQL container with Testcontainers, so Docker Desktop must be running locally. In CI, the workflow provides a PostgreSQL service and the tests use that database URL.

## PayPal docs used

- PayPal Log in with PayPal integration guide: https://developer.paypal.com/log-in/build/
- PayPal manual button build guide: https://developer.paypal.com/log-in/build-button/
- PayPal Log in with PayPal scope reference: https://developer.paypal.com/log-in/references/
- PayPal Identity API userinfo reference: https://developer.paypal.com/api/identity/v1/userinfo-get
- PayPal REST API base URL guidance: https://developer.paypal.com/api/make-api-requests

## Waiting on Brandon

- `reference/pilot.html` is now checked in as the source for Phase 2 quests, titles, game calculations, appearance, and Playbook/Help copy.
- Real PayPal sandbox client credentials and redirect URI must be added locally by Brandon.
- Render deployment, public repository visibility, PR merge, payouts, webhooks, and live PayPal credentials are intentionally out of scope.

## Phase 2: the game

The Log, Quests, Leaderboard, Playbook, and Help tabs now use authenticated APIs. Log entries start unverified. Logging never verifies an entry or sends a payment.

- Log, list, and delete your own entries. Earned amounts stay integer cents from validation through storage and responses. The form converts a dollar string into cents without floating-point rounding.
- Clock in on one platform, reload while a clock is running, and clock out to fill the log form. Elapsed minutes follow the pilot: rounded to the nearest minute, with a minimum of one; clock out does not create an entry.
- Whole-number XP, level and title, streak, rested pool, rolling seven-day totals, and site rates are calculated from history in the player's stored IANA time zone. The browser supplies the initial zone; Help lets the player change it.
- Rested XP is replayed by calendar day, independent of entry order: +25 per complete idle day, capped at 100, spent only as a matching bonus on minutes. Same-day entries share the remaining pool. Deleting or backdating an entry recalculates the result.
- Rungs are 10, 100, 1000, 5000, 10000, 25000, 50000, and 100000 cents. `claimEligibleRungs(tx, playerId)` sums verified rows inside a transaction and uses the global `rung_cents` primary key plus conflict-safe inserts. Losing a race produces no claim or database error. This is an internal integration point for Phase 3; HTTP input cannot set `verified`, a claim, or another player's ID.
- The leaderboard defaults to opt-out. Its response explicitly lists only display name, verified total, XP, level, per-site verified totals, and timestamped rung wins. Notes, email fields, and unverified earning amounts are excluded. XP follows the handoff and includes logged work and earnings.
- All 19 quest IDs, titles, descriptions, and XP rewards are ported exactly from the pilot and checked against that source by a regression test. Titles advance one per level and cap at Legend. Joining the leaderboard completes its 20-XP quest once, as in the pilot; leaving does not remove that progress. Unknown quest IDs are rejected.
- The goal coin and personal goal ladder use logged earnings, as in the pilot. The competitive rung race and public earnings require verified entries, as the handoff specifies. XP is floored after summing its components; site rates exclude earnings from zero-minute entries.
- The five tabs retain the pilot's copper/paper colors, goal coin, numeric type, progress bar, site suggestions, time-only logging, and Playbook/Help content. Help is adapted for PostgreSQL/PayPal sessions, verified earnings, privacy, and rested XP; the pilot's Claude account/local-storage claims are not presented as app behavior.

### Running Phase 2 locally

In `G:\one_dime`, use Node 24, configure your own local `.env` using the existing template, and start Docker/Postgres as described above. Then run:

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

Use the exact origin configured by `PUBLIC_BASE_URL` in the browser (default `http://localhost:3000`). Log in with your sandbox PayPal identity. No real sandbox keys are needed for tests, which mock the identity client and use a disposable database. This change does not create or change secrets.

### API contract

All routes below require a session. Writes require `Content-Type: application/json` and an `Origin` exactly matching `PUBLIC_BASE_URL`; absent/null/foreign origins and cross-site fetches are rejected. Writes share a per-player limit of 60 requests per minute, held in the local server process; a future multi-instance deployment needs a shared limiter. Logout uses the same safeguards. Private responses are not cached.

| Route | Input or result |
| --- | --- |
| `POST /api/entries` | `{ platform, workedOn: "YYYY-MM-DD", amountCents, minutes, note? }`; returns an unverified entry |
| `GET /api/entries` | Own entries, optionally `?id=<uuid>`; someone else's ID returns 404 |
| `DELETE /api/entries` | JSON `{ id }`; only own rows; `/api/entries/:id` with `{}` is also supported |
| `POST /api/clock/in` | JSON `{ platform }`; 409 when already running |
| `POST /api/clock/out` | JSON `{}`; `{ platform, minutes, workedOn }` for the form; 409 when absent |
| `GET /api/clock` | Own active platform and start instant, or nulls |
| `GET /api/me/stats` | Own totals, rolling seven-day week, streak, XP, level, rested pool/bonus, and per-site cents/hour |
| `POST /api/me/time-zone` | JSON `{ timeZone }`; a valid IANA zone |
| `GET /api/quests` | The exact 19-quest catalog and own completed quest IDs |
| `POST /api/quests/:id` | JSON `{}` toggles an existing catalog quest for the player |
| `POST /api/leaderboard/join` or `/leave` | JSON `{}` changes only the player's opt-in |
| `GET /api/leaderboard` | Whitelisted summaries for opted-in players only |
| `POST /api/logout` or `/logout` | JSON `{}` destroys the current session and clears its cookie |

Zod rejects unknown write fields, amounts outside 0–1,000,000 cents, fractional/negative amounts or minutes, invalid dates/zones, future work dates, and oversized text. Minutes must fit a PostgreSQL integer. Dates represent the player's calendar date, while clock and claim timestamps are instants. Do not re-zone the entry's `workedOn` date when rendering it.

### Tests and review questions

`npm run build` type-checks both server and browser TypeScript. `npm test` covers auth, exact pilot catalog parity, decimal-to-cents conversion, XP/levels/titles, rolling weeks, timed site rates, rested cap/drain/gaps/time zones/DST, streaks, ownership, input/CSRF checks, write limits, clock rounding and concurrent clocks, quest isolation/toggles and automatic join progress, verified-only rung eligibility, rollback, concurrent rung claims, and leaderboard privacy. CI runs the same build and tests on Node 24 with PostgreSQL 16.

One interpretation remains for Lead review: the rested-XP rule does not define accrual before the first logged day. The implementation starts with zero, then accrues from gaps after that first day. This uses entry history alone, without a stored counter; confirm that interpretation.

The copied Oct 13 SDLC still lists rested XP as an open decision and Phase 1 as awaiting fixes. The operator's Oct 14 approval and Phase 2 handoff supersede that dated status; the supplied document is preserved unchanged.

The phase PR is for review. Claude's review and Brandon's separate merge approval remain outstanding. Deployment, repository visibility, license, receipts, payouts, webhooks, and AI integration are unchanged.

