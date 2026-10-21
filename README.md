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
The demo uses fake identity/session data, disabled payouts and no provider keys. It does
not contact external providers. It does not demonstrate real PayPal authentication.
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
failures/deduplication, device confidence/privacy/cache/preferences, and repeatable fake seed data.
Exact checkpoint SHAs, test counts and CI evidence are in `STATUS.md` and [PR #5](https://github.com/BCaris-RN/OneDime/pull/5).

For Current theme contrast, I run `npm run typecheck:contrast` and `npm run test:contrast`
after installing Chromium with `npx playwright install chromium`. The check uses fictional
players in its own disposable PostgreSQL container and fails on insufficient contrast or
unsupported coverage. It does not write reports or screenshots in CI.
To regenerate the review artifacts, run `npx tsx scripts/check-current-contrast.ts --report
docs/contrast/current-after.md --screenshots docs/screenshots/current-contrast/after`.
The same command with `--before` reads the immutable main stylesheet snapshot; that baseline
intentionally fails. [The contrast review](docs/contrast/review-evidence.md) explains the
measured pairs, native-control exceptions, and minimum color candidates.

## Pick one workspace for each payment

Each app has a stats month picker. PayPal's “This month, everywhere” overview adds
the five income ledgers once, never the imported activity a second time. For a matched
First Dime payment, financial earned/fee/paid/net totals use its actual gross/fee/net;
the entry's logged amount and game progression are preserved. Unknown fees are not
invented. All-time pending/open and platform comparisons are labeled separately.

PayPal settings includes Delete my data. Export first, then type `DELETE MY DATA`:
the server deletes the account and all owned active rows, clears the cookie and logs
you out. Tests check every owned table and preserve another player's records.

For the browser privacy/cache check, install Chromium with `npx playwright install chromium`,
then run `npm run test:browser`. CI also runs this check. Screenshots use fictional data.
The final check covers every app and sub-tab at 320px and 390px in both themes, keyboard
tab/arrow/Home/End navigation, visible focus above the phone controls, table captions and
input labels. Native date fields use a full row on narrow screens, and 320px forms use one
column so dates remain readable.

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
credentials and payout recipient emails are never exported. PayPal rows
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
| Registered callback | http://127.0.0.1:3000/auth/paypal/callback |
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

## Smart suggestions stay on the device

I use a small MIT-licensed classifier in an isolated browser worker. Smart suggestions
are off by default and saved per player. The notice states the measured uncompressed
first download: 41.3 MB including model, tokenizer, worker and WASM. Files are served
by OneDime and cached by the browser. No inference API, keys or spending code is needed.
The model receives only payer, net amount and payment kind locally. Imported activity
is still stored in OneDime; it is never sent anywhere else for suggestions.

Five fixed intents map to allowed app/record types with platform Other. Known payers
keep the fixed map. Low confidence, ambiguous results, loading errors or a two-minute
timeout keep the fallback. Model scores are heuristic and need player review; no action
is automatic. Turning it off terminates the worker. The server validates every route.
CSP permits only same-origin data/model connections. Mid-range physical phone speed is
not measured; phone-width desktop checks only establish UI and cache behavior.

## Beta feedback

For a private sandbox beta, I set `BETA_ALLOWLIST` privately to the tester accounts'
comma-separated PayPal emails. Matching trims and lowercases the complete address;
plus aliases and dotted addresses stay distinct. Leaving it unset or blank preserves
the existing login behavior. A malformed nonblank list stops startup with a generic
error instead of opening access. See the [deployment guide](docs/deploy-render.md)
for the empty-slot rule and the separately approved deployment needed to apply a
changed list. Removed accounts are rejected on their next request, and a rejected
session cannot be reused after re-adding the account. Stored financial records remain.

I check the private-beta page with `npm run test:beta` after installing Chromium.
It checks keyboard navigation, local-only requests and Current-theme contrast at
320/390/1280px in System, Light and Dark against both OS preferences. It uses no
provider credentials or database. `npx tsx scripts/check-beta-access.ts` also generates
the review table, sanitized evidence and screenshots under `reviews/beta-allowlist/`.

I collect beta feedback through **Menu > Send feedback** or the button in Help.
The form selects the current app, accepts up to 1,000 characters and an optional
blocking flag, and allows five submissions per player per rolling hour. Feedback
is private to the operator and is removed when the player deletes their account.
Please leave names, emails, passwords and client or study content out of the note.

For my private operator report, I run `npm run feedback:export` with the database
configured in `.env`. Reports go to gitignored `feedback/feedback-YYYY-MM-DD.md`,
grouped by app with blockers first. Reports use short player tags instead of
account names or emails; typed personal details still need review before sharing.

## Policies

I keep the policies only on Google Sites. The footer and Help link directly to them;
`/privacy` and `/terms` redirect to the same pages.

- [Privacy policy](https://sites.google.com/view/onedime-privacy-policy/home)
- [User agreement](https://sites.google.com/view/onedime-user-agreement/home)

## Environment variables

For a numeric loopback sandbox callback, set `APP_BASE_URL=http://127.0.0.1:3000`
and leave `PUBLIC_BASE_URL` blank (or set it to the same value). Register exactly
`http://127.0.0.1:3000/auth/paypal/callback` in your sandbox app and browse the numeric
origin throughout login. Alternatively use `PUBLIC_BASE_URL=http://localhost:3000`
and its matching callback if the dashboard accepts it. Explicit `PAYPAL_REDIRECT_URI`
must use that same chosen origin. Conflicting base aliases fail at startup.
Real dashboard/account acceptance remains an operator check with approved sandbox keys.

Secrets are blank in `.env.example` and `sync: false` in `render.yaml`. Do not log them.

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL URL; private |
| `SESSION_SECRET` | Required private random value, at least 32 characters |
| `NODE_ENV` | `development`; production enables secure-cookie default |
| `PORT` | `3000` |
| `PUBLIC_BASE_URL` | http://127.0.0.1:3000; exact origin for writes/callbacks |
| `APP_BASE_URL` | Optional alias for that origin; blank by default; both aliases must agree |
| `COOKIE_SECURE` | `false` locally; production defaults true; Render sets true |
| `SESSION_TTL_DAYS` | `14` |
| `PAYPAL_ENVIRONMENT` | `sandbox`; every other value is rejected |
| `PAYPAL_CLIENT_ID` | Personal sandbox business app ID; blank |
| `PAYPAL_CLIENT_SECRET` | Sandbox app secret; blank |
| `PAYPAL_REDIRECT_URI` | http://127.0.0.1:3000/auth/paypal/callback |
| `PAYPAL_AUTH_URL` | Optional; only `https://www.sandbox.paypal.com/connect` accepted |
| `PAYPAL_API_BASE_URL` | Optional; only `https://api-m.sandbox.paypal.com` accepted |
| `PAYPAL_SCOPE` | `openid profile email https://uri.paypal.com/services/paypalattributes` |
| `PAYPAL_WEBHOOK_ID` | Sandbox webhook ID; blank |
| `PAYOUTS_ENABLED` | `false`; local activation requires separate approval |
| `GOOGLE_SHEETS_ENABLED` | `false`; true is rejected because the stretch is deferred |
| `GOOGLE_CLIENT_ID` | Blank; reserved, unused by file exports |
| `GOOGLE_CLIENT_SECRET` | Blank; reserved, unused |
| `TOKEN_ENCRYPTION_KEY` | Blank; reserved, no Google OAuth tokens are stored |
| `DEMO_SEED_ENABLED` | `false`; explicit local seeding only |

## Review and deployment boundaries

Browser checks default to port 3404 and contrast checks to 3406. For isolated local
runs, set `BROWSER_TEST_PORT` and `CONTRAST_TEST_PORT`; `TEST_DATABASE_NAME` selects
the name inside each check's own disposable PostgreSQL container. The contrast check
covers the feedback menu and modal's empty, invalid, error, sending and sent states
in both themes against both OS color schemes. It checks policy redirects without
fetching or auditing third-party policy pages.

I keep the tester tasks in [the beta guide](docs/beta-guide.md) and the operator's
step-by-step setup in [the Render deploy guide](docs/deploy-render.md). Brandon sends
sandbox logins privately and performs each approved deployment himself.

I prepared `render.yaml` with a free web service and free Postgres for beta testing,
with automatic deploys disabled. I have not created or deployed Render resources.
[Render's free services](https://render.com/docs/free) sleep after 15 minutes without
inbound traffic, and free databases expire 30 days after creation. Payouts, Google Sheets
and seed flags stay false there. Source/reference HTML stays ignored and is not needed for CI.
Brandon accepted clean rewritten main `9953600` and owns GitHub Support cleanup of old PR refs.
Do not merge old pre-cleanup history into this branch. The repository license is recorded in LICENSE.

I merged Phase 3 App in [PR #4](https://github.com/BCaris-RN/OneDime/pull/4) and Phase 4
Fixes and free AI in [PR #5](https://github.com/BCaris-RN/OneDime/pull/5). I am preparing
Phase 5 Beta test for November 1-8, followed by Phase 6 Ship on November 9-10.
I keep the current phase table in [the SDLC](docs/SDLC.md) and checkpoint evidence in
[STATUS.md](STATUS.md). [Phase 4 decisions](docs/phase4-decisions.md) record calculations,
dependencies, scope choices and provider limitations. [Screenshots](docs/screenshots)
use fictional data.

I still require review and explicit approval for each merge, deploy and visibility change.
The app does not scrape, automate or log into gig platforms, implement receipt-image
verification, award XP outside First Dime or use live PayPal.

## Built with

Built by Brandon Caris with Claude (lead and reviewer) and Codex (implementation), on the PayPal Developer Platform.
