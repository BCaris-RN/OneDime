```text
    .-'''''''-.
  .'  .-----.  '.        ___             ____  _
 /   /  ONE  \   \      / _ \ _ __   ___|  _ \(_)_ __ ___   ___
|   |  DIME   |   |    | | | | '_ \ / _ \ | | | | '_ ` _ \ / _ \
 \   \  10c  /   /     | |_| | | | |  __/ |_| | | | | | | |  __/
  '.  '-----'  .'       \___/|_| |_|\___|____/|_|_| |_| |_|\___|
    '-.......-'        earn your first dime. level up for real.
```

# OneDime

I built OneDime to make the first dime of independent income feel achievable, then
make the next step visible. It is a private TypeScript/Express app with PostgreSQL,
PayPal sandbox login and a plain HTML/CSS/TypeScript interface based on my handheld pilot.

I keep money in integer cents so amounts survive validation, storage and calculations
without decimal drift. Hours, minutes and miles use explicit scaled integers. Only
First Dime entries earn XP, streaks, quests or rung claims. Verified totals decide
rung eligibility and earnings rankings; general progression XP breaks leaderboard ties.

## Run locally

Use Node 24 and PostgreSQL 16. Install dependencies and build:

```powershell
npm ci
Copy-Item .env.example .env
```

Fill the local `.env` privately. Set a local `DATABASE_URL`, a random `SESSION_SECRET`
of at least 32 characters, and personal sandbox PayPal app credentials. Match the
callback URL to the origin you will open; the default is
`http://localhost:3000/auth/paypal/callback`. Keep `.env` out of Git.

```powershell
npm run db:migrate
npm run build
npm start
```

Open the configured `PUBLIC_BASE_URL`, then use **Log in with PayPal**. `npm run dev`
watches the server; rebuild after editing browser TypeScript or font dependencies.
The build self-hosts the three OFL fonts and their licenses; no Google Fonts request is needed.

### Isolated fictional demo

```powershell
npm run demo
```

Docker Desktop must be running. This creates a disposable PostgreSQL 16 container,
applies migrations, seeds fake data and binds only to `127.0.0.1:3403`. Open
[the local demo](http://127.0.0.1:3403/demo-login). Stop with Ctrl+C to remove the container.
The demo uses fake identity/session data, disabled payouts and no AI key. It does
not contact PayPal or Anthropic. It does not demonstrate real PayPal authentication.
All people, transaction IDs and financial events are fictional; platform names are
labels and no third-party logos are included.

To seed a separate existing local database, explicitly set `DEMO_SEED_ENABLED=true`
outside production and run `npm run db:seed:demo`. The seed is repeatable, creates
only the named fictional demo player and its fixed records, and does not clear other
players. It refuses non-local database hosts. Use the isolated demo to sign into fake data.

## Test and check

```powershell
npm run build
npm test
npm audit
```

Tests mock provider calls and use disposable PostgreSQL via Testcontainers when
`DATABASE_URL` is unset. An explicit test URL must point to localhost and a database
named `test` or `*_test`; the suite truncates its tables. Never point it at app data.
GitHub Actions uses a local PostgreSQL 16 service and Node 24, then installs, builds and tests.

Coverage includes ownership, input/origin/rate checks, game math and clock races,
brand-deal payment concurrency, ledger calculations, exports/formula protection,
CSV privacy and re-imports, routing/unlink behavior, payout idempotency and webhook
failures/deduplication, AI schema/privacy/cache/budget races, and repeatable fake seed data.
Exact checkpoint SHAs, test counts and CI evidence are in `STATUS.md` and PR #4.

## Pick one workspace for each payment

- **First Dime:** starter gigs and everything that does not fit below, including SideShift.
- **Spotlight:** income that needs an audience: creator streams and brand deals, plus expenses.
- **Freelance:** selling a skill to a client, with platform fees and net hourly rates.
- **Market:** driving/delivery shifts, or selling goods with fees, supplier cost and shipping.
- **PayPal:** connection status, private activity import and the review queue; it does not
  add a second copy of earnings to the financial summaries.

A payment belongs in exactly one workspace. Printify and Ninja Transfers are suppliers
(item cost); Printify Shop is a store (where the buyer paid). First Dime alone feeds the game.
Clock-out rounds down to whole minutes, including zero under one minute. Rested XP starts
at zero and accrues from complete idle days after the first logged day.

## Export and import files

Every workspace has an **Export** disclosure with CSV and Excel options, a month filter
or inclusive date range, and all time as the default. Money headers end in `_usd`; values
are dollars with two decimal places. XLSX dates are typed dates and headers are frozen.
Tab CSVs combine different record kinds with `record_type`. Market workbooks have two
sheets, Delivery and Selling, each including its corresponding expenses.

**Export everything** in PayPal produces an XLSX workbook with monthly Summary rows and
one sheet per financial/activity/game table, or a ZIP of CSV files. Sessions, OAuth state,
credentials, AI prompts and payout recipient emails are never exported. PayPal rows
are reconciliation metadata and are not counted again in Summary. First Dime treats
verified earnings as paid because it has no separate payout status.

Summary uses work/sale dates for earnings and fees, payment dates when available for paid
amounts, spend dates for expenses, and earned month for pending amounts. That last value
is monthly; the pilot's pending headline is all-time. Net subtracts fees, supplier costs,
shipping and expenses. Date-range filters apply to the relevant event dates.

In Google Sheets, choose **File > Import > Upload** and select the file. In Excel, open
`.xlsx`, or use **Data > From Text/CSV**. Formula-like text begins with a protective
apostrophe; numeric amounts remain numbers, including negative net totals. Exports use
one consistent database snapshot for the logged-in player and are limited to six per minute.
Binary structure, numeric/date cells and frozen headers are tested; interactive import
in actual Excel/Google accounts remains a manual check.

## PayPal sandbox and activity review

Import your own English-column PayPal activity CSV with US (`MM/DD/YYYY`) or ISO dates.
The size limit is 512 KB and 1,000 rows. I store only date, payer name, gross, fee, net,
currency, transaction ID and type. The file and extra columns are discarded. Re-imports
are deduplicated per player. Only incoming USD payments with supported payment types and
consistent gross/fee/net arithmetic can be routed; other rows remain visible as not counted.

Confirm a suggested workspace, choose another, or link an existing owned record. Linking
preserves your amount and shows a mismatch rather than fixing it automatically. First Dime,
creator income and delivery use net; freelance/selling retain gross and fees separately.
Every linked row shows its PayPal transaction ID. Deleting it unlinks the payment and
preserves the import. An earned rung claim also survives entry deletion.

CSV matching verifies a First Dime entry only when payer/platform matches the fixed map and
the logged amount equals that transaction's gross or net, recording source `paypal_csv`.
Linked First Dime entries show gross, fee and net without changing the logged amount.
This is player-uploaded evidence; it
is not an authenticated PayPal activity lookup and does not prove the file is genuine.

### Sandbox test accounts: Brandon fills these privately

| Purpose | Placeholder |
| --- | --- |
| Personal developer account | `<personal account, never employer>` |
| OneDime sandbox business sender/app | `<sandbox business account>` |
| Sandbox player login/recipient | `<sandbox personal account>` |
| Registered callback | `<PUBLIC_BASE_URL>/auth/paypal/callback` |
| Webhook listener | `<PUBLIC_BASE_URL>/api/paypal/webhook` |
| Requested attributes | `openid profile email` and PayPal verification/account attributes |

Do not put emails, passwords or keys in this table or the PR. Persisted account verification
is shown only when returned. A missing name uses a generic display name, never email.

### Disabled milestone bonuses

`PAYOUTS_ENABLED=false` sends nothing. If Brandon explicitly enables it locally later,
a server-recorded rung claim creates a unique outbox row before any API call. The sandbox
bonus is 10% of the rung, rounded down, minimum $0.10. It goes from OneDime's sandbox
business credentials to the player's login email. Batch/item/recipient/amount stay stable
on retries; leases prevent concurrent sends. Pending work is retried by the server each
minute. Ambiguous attempts older than 29 days require manual review instead of risking
PayPal's 30-day duplicate window. Do not enable this in production; startup rejects that.

Webhooks use PayPal signature verification and deduplicate event IDs. Only tracked batches
are updated. The browser cannot choose a payout, amount or recipient. These flows are
mock-tested; actual sandbox authentication, payouts, app permissions and webhook delivery
must be validated with Brandon's personal sandbox accounts before activation.

## AI reads and suggests; the server decides

Optional routing suggestions use `claude-haiku-5-5`, verified against current Anthropic
docs. A request sends only owned payer name, net amount and payment kind; email-like
payer text is redacted. It sends no notes, emails, player IDs or other players' data.
Names stay JSON data under a fixed instruction. There are no AI tools or automatic actions.
The UI explains the data sent before the player requests suggestions.

The server validates JSON, allowed app/platform/record combinations, indices and confidence.
Below 0.7, invalid JSON, refusal or truncation gives no suggestion. Fixed-map matches skip
AI. Suggestions cache privately per player/payer/model for 30 days. The shared UTC-month
budget reserves two cents atomically per batch of at most ten names, with a 50 KB text
request limit and 2,048 output tokens. That conservatively covers the checked model's
short-context rates; usage also records tokens and rounded cost. Reservations are not
refunded, so the cap can stop before actual invoice spend. Missing keys, exhausted budget,
unsupported model overrides or provider failure use a visible fixed-map fallback.
There is no player billing. Real provider calls remain untested; tests use mocks.

## Environment variables

Secrets are blank in `.env.example` and `sync: false` in `render.yaml`. Do not log them.

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL URL; private |
| `SESSION_SECRET` | Required private random value, at least 32 characters |
| `NODE_ENV` | `development`; production enables secure-cookie default |
| `PORT` | `3000` |
| `PUBLIC_BASE_URL` | `http://localhost:<PORT>`; exact origin for writes/callbacks |
| `COOKIE_SECURE` | `false` locally; production defaults true; Render sets true |
| `SESSION_TTL_DAYS` | `14` |
| `PAYPAL_ENVIRONMENT` | `sandbox`; every other value is rejected |
| `PAYPAL_CLIENT_ID` | Personal sandbox business app ID; blank |
| `PAYPAL_CLIENT_SECRET` | Sandbox app secret; blank |
| `PAYPAL_REDIRECT_URI` | `<PUBLIC_BASE_URL>/auth/paypal/callback` |
| `PAYPAL_AUTH_URL` | Optional; only `https://www.sandbox.paypal.com/connect` accepted |
| `PAYPAL_API_BASE_URL` | Optional; only `https://api-m.sandbox.paypal.com` accepted |
| `PAYPAL_SCOPE` | `openid profile email https://uri.paypal.com/services/paypalattributes` |
| `PAYPAL_WEBHOOK_ID` | Sandbox webhook ID; blank |
| `PAYOUTS_ENABLED` | `false`; local activation requires separate approval |
| `ANTHROPIC_API_KEY` | Personal API key; blank, fixed-map fallback when missing |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5`; other IDs fall back until priced in code |
| `AI_MONTHLY_BUDGET_CENTS` | `100`, shared monthly reservation cap; integer 0..1,000,000 |
| `GOOGLE_SHEETS_ENABLED` | `false`; true is rejected because the stretch is deferred |
| `GOOGLE_CLIENT_ID` | Blank; reserved, unused by file exports |
| `GOOGLE_CLIENT_SECRET` | Blank; reserved, unused |
| `TOKEN_ENCRYPTION_KEY` | Blank; reserved, no Google OAuth tokens are stored |
| `DEMO_SEED_ENABLED` | `false`; explicit local seeding only |

## Review and deployment boundaries

`render.yaml` is preparation only. Its starter-plan setting is a placeholder for Brandon's
hosting choice; no Render resources were created or deployed. Payouts, Google Sheets and
seed flags stay false there. Source/reference HTML stays ignored and is not needed for CI.
Brandon accepted clean rewritten main `9953600` and owns GitHub Support cleanup of old PR refs.
Do not merge old pre-cleanup history into this branch. No license has been selected or added.

[The Phase 3 handoff](handoffs/week3-onedime-app.md) governs current scope; the older SDLC
roadmap has been updated to reflect this implementation. [Implementation decisions and
primary documentation](docs/phase3-decisions.md) record calculations, dependencies, scope
choices and provider limitations. [Screenshots](docs/screenshots) use fictional data.

Review and Brandon's merge approval are still required. This phase does not scrape,
automate or log into gig platforms, implement receipt-image verification, award XP
outside First Dime, use live PayPal, deploy or change repository visibility.

## Built with

Built by Brandon Caris with Claude (lead and reviewer) and Codex (implementation), on the PayPal Developer Platform.
