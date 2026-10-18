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
