TASK HANDOFF: OneDime, Phase 3 (The OneDime app: pilot port, exports, PayPal everywhere)
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local, G:\one_dime).
Written Oct 17, 2026. LONG RUN: work through the milestones below in order without waiting between them,
but stop at each CHECKPOINT long enough to push, update the PR and STATUS, then continue.
This handoff REPLACES handoffs/week3-money-ai.md. Keep that file for reference; do not build from it.

AUTHORIZED
  - Create branch week3-onedime-app from main, push to it, open ONE draft PR into main and keep it updated.
  - Add npm dependencies needed below (current stable versions, checked live, npm audit clean).
NOT AUTHORIZED
  - Merging, deploying to Render, making the repo public, live PayPal, adding a LICENSE,
    turning on PAYOUTS_ENABLED or GOOGLE_SHEETS_ENABLED anywhere but local .env.
  - Using any employer (Vencer) account: GitHub, Google Cloud, PayPal, Anthropic, anything.

PREREQUISITE
  PR #2 (week2-game) must be merged into main, including the handoffs/week2-fixes.md items.
  If it is not merged: finish week2-fixes on week2-game, report, and STOP. Do not start this phase.

TARGET BRANCH: week3-onedime-app   BASE: main (after PR #2 merges)
PROCESS: docs/SDLC.md, including the definition of done. Update STATUS.md (create it if missing)
  at every checkpoint: milestone, commit, tests, what's next, open questions.

SOURCE OF INCOMING WORK
  /reference/pilot.html = the claude.ai pilot as of Oct 17, 2026 (Brandon drops in the latest copy;
  reference/ stays gitignored). It is the design and behavior spec. Port layout, styles, copy,
  controls and calculations. Do NOT port window.claude.*, claude.ai storage, or the db/user capability code.
  If pilot.html is missing: STOP at M1 and ask. The port is the point of this phase.

====================================================================================
THE APP STRUCTURE (what "exactly like the pilot" means)
====================================================================================
Top-level app tabs, in this order:
  1. First Dime   starter gigs. Sub-tabs: Log, Quests, Leaderboard, Playbook, Help
                  (PayPal moves OUT of here to its own top-level tab, see 5)
  2. Spotlight    audience income: YouTube, TikTok, Instagram, Facebook, Other.
                  Income (platform, stream type, amount, earned date, pending/paid, content minutes, note),
                  brand deals (brand, platform, agreed amount, due date, deliverables,
                  stage Negotiating > Agreed > Delivered > Invoiced > Paid; Paid auto-creates a paid income row once),
                  expenses, by-platform table, monthly stats.
  3. Freelance    Upwork, Fiverr, Freelancer.com, Toptal, Behance, Dribbble, Other.
                  Gigs: platform, client, project, fixed/hourly, client paid, platform fee, hours, start date,
                  stage In progress > Delivered > Clearing > Paid (paid_on stamped). Fee may not exceed client paid.
                  Monthly stats and by-platform table (per hour uses net after fees on gigs with hours).
  4. Market       Sub-tabs:
                  Delivery and rides: DoorDash, Uber, Uber Eats, Lyft, Instacart, Grubhub, Other.
                    Shift: platform, date, pay, tips, hours online, miles. Per hour and per mile.
                  Selling: Amazon, eBay, Etsy, Facebook Marketplace, TikTok Shop, Shopify, Printify Shop, Other.
                    Sale: store, item, date, price, platform fees, item cost, made by
                    (Own stock, Printify, Ninja Transfers, Other), shipping paid, pending/paid.
                    Profit = price - fees - cost - shipping. Margin per store.
  5. PayPal       NEW top-level tab (see M3).

Routing rules (put in Help and in code comments):
  - Needs an audience? Spotlight. Selling a skill to a client? Freelance. Driving, delivering or selling goods? Market.
    Everything else, including SideShift, is First Dime.
  - Every payment lives in exactly ONE tab. Never count it twice.
  - Printify and Ninja Transfers are SUPPLIERS (item cost). Printify Shop is a STORE (where the buyer paid).

Look and controls (port exactly):
  - Handheld theme colors, the four LCD greens, A/B button colors and hover/focus overlays, light and dark mode.
  - Fonts: JetBrains Mono (headings, numbers, LCD), Atkinson Hyperlegible (body), Source Code Pro (buttons).
    Self-host via @fontsource packages (OFL), no Google Fonts requests. Body 16px.
  - Desktop: D-pad and A/B in the header.
  - Phone (<=520px): app tabs in one row (5 across, labels may wrap to two lines);
    First Dime sub-tabs 3 per row; Market sub-tabs 2 per row; stats and form fields 2 columns;
    D-pad + status + A/B in a bar FIXED to the bottom, above the safe-area inset, with page bottom padding
    so nothing hides under it; toasts sit above the bar. Controls 32px D-pad arms, 52px A/B.
  - D-pad left/right: previous/next sub-tab in the current app (from an app with no sub-tabs, go to First Dime).
    Up/down: scroll. A: First Dime log form. B: clock in/out.
  - Keyboard: arrow keys move between tabs in each tablist; every control reachable by Tab; visible focus.

Game rules: unchanged from week2-game. Only First Dime entries feed XP, streaks, quests and the rung race
  in this phase. Do NOT add XP, ranks or quests for the other tabs. (Brandon decides that later.)
  Do NOT build a "Dime-N" rank or any new currency.

====================================================================================
MILESTONES
====================================================================================
M1  PORT THE PILOT (target Oct 22)
  DATABASE (migration, all money integer cents, all rows owned by player_id, cascade on player delete)
    creator_income   id, player_id, platform, stream_type, amount_cents, earned_on (date), status (pending|paid),
                     paid_on (date null), content_minutes int, note, brand_deal_id null (unique when set), created_at
    brand_deals      id, player_id, brand, platform, amount_cents, due_on null, deliverables, stage, created_at
    expenses         id, player_id, app (spotlight|freelance|market_delivery|market_selling), item,
                     amount_cents, spent_on, created_at
    freelance_gigs   id, player_id, platform, client, project, pricing (fixed|hourly), gross_cents, fee_cents,
                     hours_x100 int (hours * 100, e.g. 1.25 h = 125), started_on, stage, paid_on null, created_at
    delivery_shifts  id, player_id, platform, worked_on, pay_cents, tips_cents, minutes_online int,
                     miles_x10 int (miles * 10), created_at
    sales            id, player_id, store, item, sold_on, price_cents, fee_cents, cost_cents, ship_cents,
                     made_by, status (pending|paid), created_at
    Platform/store/stage/status values are enums or CHECK constraints matching the lists above.
    Note: the pilot stores hours and miles as decimals. Store them as scaled integers as shown.
  API (session required, own rows only, zod validation, JSON + same-origin on writes, rate-limited writes)
    GET/POST/PATCH/DELETE for each table above, under /api/spotlight/*, /api/freelance/*, /api/market/*.
    PATCH covers stage/status changes and edits (the pilot only deletes; the app lets players edit).
    Moving a brand deal to Paid creates its income row in the same transaction, once.
    GET /api/<app>/summary?month=YYYY-MM returns the stats and by-platform tables the pilot shows.
    Limits: amounts 0..1,000,000 cents per row; hours 0..24 per shift/gig entry; miles 0..2,000; text <=120 chars.
  FRONTEND: all five top-level tabs and sub-tabs, driven by the API, matching the pilot.
  TESTS
    - Every new route rejects other players' rows (read, edit, delete)
    - Calculations: profit, margin, per hour, per mile, net after fees, monthly windows in the player's time zone
    - Fee > client paid rejected; negative, float and huge amounts rejected
    - Brand deal Paid creates exactly one income row, even if set Paid twice or concurrently
    - Hours and miles round-trip through scaled integers without drift
  CHECKPOINT M1: push, update PR + STATUS, include phone and desktop screenshots of every tab in the PR.

M2  EXPORTS (target Oct 25)
  - Every app tab gets "Export" with: CSV (this tab) and Excel .xlsx (this tab).
    Market exports both sub-tabs as two sheets.
  - The PayPal tab (or a header menu) gets "Export everything": one .xlsx workbook with
    a Summary sheet (per app, per month: earned, paid, pending, fees, expenses, net) plus one sheet per table,
    and a .zip of CSVs.
  - Month or date-range filter, default all time. File names: onedime-<tab>-<YYYY-MM-DD>.csv/.xlsx.
  - Money exported as numbers in dollars with 2 decimals (from cents), real dates, a header row, frozen header.
  - Files must open cleanly in Google Sheets (File > Import) and Excel. Document that in Help.
  - SECURITY: neutralize CSV/spreadsheet formula injection. Any text cell starting with = + - @ tab or CR
    gets a leading apostrophe. Only the player's own rows. Exports are rate-limited.
  - Library: pick a maintained xlsx writer (check npm and its advisories live; cite it in the PR).
  - STRETCH, behind GOOGLE_SHEETS_ENABLED=false: "Send to Google Sheets" via Google OAuth with the
    narrowest scope that can create a new spreadsheet (verify the scope live, expected drive.file).
    Brandon's PERSONAL Google Cloud project only. Tokens encrypted at rest, revocable from the PayPal tab's
    settings area. Creates a NEW spreadsheet each time; never reads or edits other files. If the scope or
    verification requirements look heavy, skip it and list what's needed in the PR.
  TESTS: export content matches the database for one player only; formula injection neutralized;
    totals in Summary equal the per-tab summaries; empty data exports a header-only file.
  CHECKPOINT M2.

M3  PAYPAL EVERYWHERE (target Oct 30)
  PayPal stays sandbox only. Verify every endpoint, scope and payload against PayPal's CURRENT docs; cite pages.
  A. PayPal tab (top level)
     - Connection status from Log in with PayPal (name, verified status if returned). Links out to PayPal activity.
     - Activity import: player uploads their own PayPal activity CSV. Parse ONLY date, name/payer, gross,
       fee, net, currency, transaction ID, type. Discard everything else before storage. Never store the file.
     - Table paypal_transactions: id, player_id, txn_id, occurred_on, payer, gross_cents, fee_cents, net_cents,
       currency, kind, routed_app null, routed_record_type null, routed_record_id null, created_at.
       UNIQUE (player_id, txn_id) so re-imports never duplicate.
     - Only incoming USD payments can be routed. Other currencies listed but marked "not counted".
     - Review queue: each unrouted payment shows a suggested tab and record type (M4 adds AI; until then,
       a fixed payer map, e.g. Hyperwallet -> First Dime / Prolific). The player confirms or changes it,
       which creates the record in that tab (or links an existing one) and stamps it "paid via PayPal".
     - Totals by app, by month, and unrouted count.
  B. PayPal in every tab
     - Each app tab shows a small "PayPal" strip: payments routed here this month and a "Review N unrouted"
       link that opens the PayPal tab filtered to that app.
     - Every row created from or linked to a PayPal transaction shows a PayPal badge and its transaction ID.
       Linking never changes the amount the player typed; a mismatch is shown, not auto-fixed.
     - Deleting a linked record unlinks the transaction; it never deletes the transaction.
     - First Dime: a routed PayPal payment marks that entry VERIFIED (source: paypal_csv) only when amount and
       payer match the platform map. This is the Phase 3 verification path; rung rules from Phase 2 apply.
  C. Sandbox API feature beyond login: milestone bonus via PayPal Payouts, behind PAYOUTS_ENABLED=false.
     BRANDON HAS NOT APPROVED THIS YET. Build it fully, tested with mocks, flag off by default.
     - Sent from OneDime's OWN sandbox business account to the player's PayPal login email.
     - Trigger: the server records a rung claim (Phase 2 rules). Amount: 10% of the rung, min $0.10 (sandbox),
       stored as a payouts row with a unique sender_batch_id before the API call; retry is idempotent.
     - Webhooks: verify signatures per PayPal's docs, dedupe by event ID (webhook_events table),
       update payout status. The browser never decides a payout.
  TESTS: CSV parser on sample files with extra columns (dropped), duplicate re-import (no new rows), non-USD
    (not routable), routing creates exactly one record, cross-player access denied, unlink on delete,
    verification only on match, payouts idempotency, webhook signature failure rejected, duplicate event ignored,
    PAYOUTS_ENABLED=false sends nothing.
  CHECKPOINT M3.

M4  AI (target Nov 1)
  Governing rule: AI reads and suggests, the server decides.
  - Routing assistant: for unrouted PayPal payments, Claude suggests app, platform/store and record type from
    payer name, amount and kind ONLY (no notes, emails or other players' data). Strict JSON schema,
    validated server-side; anything invalid or below confidence 0.7 is shown with no suggestion.
    Payer names are untrusted input: treat them as data, never instructions.
  - Model from ANTHROPIC_MODEL (default claude-haiku-5-5; verify the model string in Anthropic's current docs).
    Batch suggestions, cache by payer name per player. AI_MONTHLY_BUDGET_CENTS with ai_usage tracking;
    budget reached -> fall back to the fixed payer map and say so in the UI.
  - Free for every player. No billing code.
  TESTS: schema rejection, injection-like payer names stay inert, budget fallback, no notes or emails in prompts
    (assert on the request body with a mocked client).
  CHECKPOINT M4.

M5  DEPLOY PREP AND README (target Nov 2)
  - render.yaml updated for the new env vars (all secrets as sync:false). Do NOT deploy.
  - README: local run, test run, every env var, sandbox PayPal test accounts section with placeholders
    for Brandon to fill, how exports open in Google Sheets, the routing rules, what's behind flags.
  - Seed script with FAKE data only (no real gig-platform logos, no real people) for the demo video.
  CHECKPOINT M5: mark the PR ready for review.

====================================================================================
SECRETS AND ENV (all in .env, Brandon fills real values; commit blanks to .env.example)
  PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYOUTS_ENABLED=false,
  ANTHROPIC_API_KEY, ANTHROPIC_MODEL, AI_MONTHLY_BUDGET_CENTS,
  GOOGLE_SHEETS_ENABLED=false, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
  Never print, log or commit them. Anything pointing at live PayPal: stop and flag.

DO NOT TOUCH
  Game rules beyond what is written here; XP for non-First-Dime tabs; LICENSE; deploys; repo visibility;
  receipt-image verifier (moved to a later phase); any automation of gig platforms (no scraping, no logins
  to Prolific, Upwork, DoorDash or any other platform, ever).

DESIRED OUTPUT
  One PR into main, NOT merged, updated at each checkpoint. Description: what was built per milestone, run steps,
  test results (local and CI), doc pages used (PayPal, Google, Anthropic, npm libraries), screenshots,
  open questions, and anything you were unsure about instead of guessing. STATUS.md current.

FALLBACK
  Missing keys: build and test with mocks, list what's waiting on Brandon.
  Missing pilot.html: stop at M1 and ask.
  Running late: finish milestones in order. A finished M1-M3 beats a half-finished M1-M5.

OPEN DECISIONS FOR BRANDON (Codex: build the defaults, do not wait)
  1. Milestone bonus via Payouts (M3-C): approve or cut. Default built, flag off.
  2. Send to Google Sheets (M2 stretch): needed, or are file exports enough? Default: files only.
  3. Should Spotlight, Freelance and Market earnings ever earn XP? Default: no, not in this phase.
  4. Hackathon cut line if time runs short: suggested M1-M3 required, M4 strongly wanted (AI requirement).
