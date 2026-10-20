# Phase 3 implementation notes

## M1: pilot and owned workspaces

The visual direction is the supplied handheld pilot: gray shell, four LCD greens,
burgundy controls and locally hosted fonts. The workspace is the first screen;
navigation leads to a form, summary and history. Motion stays limited to focus/hover
feedback, scrolling controls and brief status toasts, respecting reduced motion.
The handoff's three fonts and established colors override generic frontend defaults.

The supplied Oct 17 handoff is copied unchanged into `handoffs/week3-onedime-app.md`.
The newer supplied pilot replaces only the ignored local `reference/pilot.html`.
Only static styles and workspace markup are ported; no capability code, browser
database, personal notes or Claude storage calls are included.

New workspace tables use the SQL migration's constraints and parameterized Prisma
queries. Identifiers come from the fixed table catalog or validated schema keys;
user values are always bound parameters. They deliberately do not share game tables.
The six new tables are managed by explicit SQL migrations, not generated Prisma
model delegates; preserve their CHECK constraints in future schema changes.

Writes pass through the existing game router's session, JSON, exact-origin and
per-player limiter before the workspace router. Player-row locks serialize edits
and brand-deal income creation. Date fields are player-local calendar dates; monthly
defaults use the player's IANA time zone. API inputs reject fractional cents and
fractional scaled integers. Display/edit conversions validate decimal strings.

The pilot's summary scopes are retained: headline earnings/expenses use the selected
month; pending/clearing/open amounts and by-platform comparisons cover all records.
Freelance paid-month stats use the payment date, with net hourly rates on timed gigs.
The general normalized totals additionally expose earned, paid, fees, expenses and net.
Only First Dime feeds XP, streaks, quests and rung eligibility.

Local validation at M1: 113 tests on Node 24.22.0/PostgreSQL 16; server/client build;
browser income create/edit, app arrow navigation, desktop/phone layouts, both themes,
no console errors, 21 screenshots. Screenshot data is fictional.

Fonts: `@fontsource/jetbrains-mono` 5.3.0, `@fontsource/atkinson-hyperlegible` 5.3.0,
`@fontsource/source-code-pro` 5.3.1 (all OFL-1.1), versions checked with npm live.
The build copies Latin WOFF2 files and their licenses; no Google Fonts requests.

Sources checked live:

- https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries
- https://zod.dev/api
- https://fontsource.org/docs/getting-started/install
- https://www.npmjs.com/package/@fontsource/jetbrains-mono
- https://www.npmjs.com/package/@fontsource/atkinson-hyperlegible
- https://www.npmjs.com/package/@fontsource/source-code-pro

## Boundaries

The user accepted the history rewrite on main `9953600` and owns GitHub Support
cleanup of retained old PR refs. Do not fetch or merge the old history into this branch.
No merge, deployment, live PayPal, public visibility, employer accounts or real keys
are authorized for Phase 3. Later integrations use mocks when keys are missing.

## M2: exports

`write-excel-file` 4.1.1 and `fflate` 0.8.3 were checked live on npm and their
maintainer repositories; npm audit reports zero vulnerabilities. Exports read a
repeatable-read transaction for one authenticated player, limited to six/minute.
CSV and XLSX text starting with formula markers, tab, CR or LF is apostrophe-prefixed.
XLSX money is numeric USD (0.00 format), dates are real cells, and headers are frozen.
CSV money headers end in `_usd`, values have two decimal places. Empty data keeps headers.

Summary rows use event-local calendar months: earned/fees/net on the work or sale date,
paid on payment date when available, expenses on spend date, pending on earned month.
This monthly pending metric differs deliberately from the pilot's global pending headline.
First Dime uses verified earnings as paid because the game has no separate paid status.
Range filters apply separately to earning and payment dates. Market has two sheets,
with each category's expenses distinguished by record_type. Other tab CSVs combine
records using record_type; all-workbook exports keep one sheet per table plus Summary.

Google Sheets is the optional stretch: skipped by the approved files-only default.
No Google OAuth, project, credentials or extra permissions are needed for file import.
Help documents Google Sheets File > Import and Excel import/open steps. Binary structure,
dates, formats and frozen panes are checked in tests; interactive Excel/Sheets import
has not been performed with a real account.

Sources:
- https://github.com/catamphetamine/write-excel-file
- https://github.com/101arrowz/fflate
- https://www.npmjs.com/package/write-excel-file
- https://www.npmjs.com/package/fflate

## M3: sandbox PayPal

CSV imports accept the eight specified English columns and US or ISO dates, with
512 KB / 1,000-row limits. Other columns are discarded before insertion. Incoming
USD routing additionally requires an allowed payment type, positive gross, nonnegative
net, and net = gross - absolute fee. Transfers, outgoing amounts and other currencies
remain visible but cannot be counted. Transaction IDs deduplicate per player.

The review queue creates a paid record or links an existing owned one. First Dime,
Spotlight and delivery use the incoming net amount; freelance and selling preserve
gross and fee separately. Linking never rewrites amounts; current mismatches are
computed against net after platform fees (before supplier costs), except First Dime
accepts gross or net under the post-review override below. Paid dates use the
activity date. Fixed payer matches use exact normalized names, not substring matches.
Only a matched First Dime platform and an exact gross or net amount set verified/source
paypal_csv (Brandon's post-review override). Linked entries display gross, fee and net;
their logged amounts are preserved. The payment remains linked to only one record.
CSV upload is player-provided evidence, not an authenticated PayPal transaction lookup;
Help and the PayPal panel state that limitation.

A unique record link prevents double-routing. Database deletion triggers clear the
link and preserve imported activity. Badges show transaction IDs and mismatches;
workspace strips show routed monthly net and review links. PayPal also shows totals
by app and calendar month. Exports include activity, own quests/rungs and safe payout
metadata; authentication/session secrets and payout recipient email are excluded.

Rung claims create a unique payout outbox row in the same database transaction.
The amount is floor(rung / 10), minimum 10 cents. The sandbox sender batch/item keys,
amount and first-attempt recipient persist across retries, even after an email change.
A worker retries pending work only when PAYOUTS_ENABLED=true locally. API failures
leave retry state; concurrent workers claim a lease; attempts older than 29 days
require manual review because PayPal's duplicate-batch window is 30 days. No browser
endpoint can choose a payout, recipient or amount. Disabled flags perform no requests.
No payout API call was made with real credentials; network behavior uses mocks.

Webhook signatures use PayPal's server verification endpoint with the five transmission
headers, configured webhook ID and original parsed event. Event IDs are deduplicated
transactionally; only recognized event types update a tracked batch. Terminal success
is preserved from stale processing/denied events, while returned/refunded states can
update it. Sender batch IDs can reconcile events arriving before create responses.

Login persists verified_account when returned; missing names no longer fall back to
email as a public display name. The only activity link points to sandbox PayPal.
146 tests passed at this checkpoint, build passed, audit clean. Browser CSV upload,
confirmation, verified First Dime row and PayPal badge passed with fictional data;
no console errors. Real sandbox login/Payouts/webhooks remain operator validation.

Sources checked live:
- https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-post
- https://developer.paypal.com/api/webhooks/v1/verify-webhook-signature-post
- https://developer.paypal.com/log-in/references
- https://developer.paypal.com/api/identity/v1/userinfo-get
- https://csv.js.org/parse/options/
- https://www.npmjs.com/package/csv-parse (7.0.3, MIT, audit clean)

## M4: historical routing assistant

The Phase 3 server assistant was replaced by free device-only suggestions in Phase 4.
See phase4-decisions.md for the current model, download size, privacy and fallback.

## M5: local demo and review preparation

The README covers local setup, every environment variable, sandbox account placeholders,
exports, routing, flags and provider limitations. Render settings are preparation only;
all provider secrets are unsynchronized placeholders and payout/Google/demo flags stay off.
No resources were deployed, credentials created or repository visibility changed.

`npm run demo` builds and starts a disposable PostgreSQL container with fictional data,
mocked identity and a loopback-only login. It never needs provider keys. The separate
seed command requires an explicit flag, a local database and non-production mode. Seeding
is repeatable and preserves other players. Test database overrides likewise reject remote
hosts and database names other than `test` or names ending in `_test` before truncation.

Final hardening bounds OAuth fetches, acknowledges durable routing before optional payout
network work, reconciles early signed payout-item events, and quarantines retries past the
provider's idempotency retention window. Payout metadata follows export date filters.
New Phase 3 modules were formatted consistently without adding a formatter dependency.

Fresh Node 24 `npm ci` passed; audit reported zero vulnerabilities. It emits a glob 10.5.0
deprecation warning through development-only Testcontainers -> archiver. This maintenance
warning remains; no forced transitive major-version override was applied. Build and all
168 tests across seven files passed after the final logic changes.

The populated five-app demo was checked at 1100, 390 and 320 pixels with no page overflow,
including dark mode. Browser checks covered fractional-hour edit round trips, linking an
existing First Dime entry without changing its amount, matching verification and PayPal
badge, and downloading the complete workbook. The browser console reported no errors or
warnings. M5 screenshots capture desktop, phone and dark-mode examples.

Provider tests remain mocked. Real sandbox OAuth/Payouts/webhooks, interactive Excel/Google Sheets import need operator checks with approved
accounts and keys. CSV source labels do not authenticate a file with PayPal. Google Sheets
OAuth is deferred; file exports are complete. Reviewer sign-off and merge approval remain
outstanding. This is implementation completion, not a merged or deployed phase.
