TASK HANDOFF: OneDime, Phase 5 features (ranks everywhere, first run, install, metrics, charts)
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app.
Written Oct 20, 2026. START ONLY AFTER the contrast PR and PR #6 are merged (both touch the frontend).
Read AGENTS.md and docs/SDLC.md first.

BRANDON'S DECISIONS (Oct 20)
  - YES: verified earnings in Spotlight, Freelance and Market count toward levels.
  - NO money bonuses. Payouts stay disabled (PAYOUTS_ENABLED=false). Any bonus is XP only.

AUTHORIZED: branch week5-features from main, push, one draft PR, mark ready at the end.
NOT AUTHORIZED: merge, deploy, live PayPal, enabling payouts, changing First Dime's existing XP,
  streak, rested XP or rung rules (they stay exactly as they are).

====================================================================================
F1  RANKS FOR EVERY APP (game rule addition, approved)
  Verified, per app (server decides, never the browser):
    - First Dime: unchanged (payer/platform match + logged amount equals PayPal gross or net).
    - Spotlight income, Freelance gigs, Market shifts and sales: a record is VERIFIED when it is
      linked to a routed incoming USD PayPal transaction, the record is paid, and the record's
      amount equals that transaction's gross or net:
        Spotlight income: amount. Freelance: client paid or you keep. Delivery shift: pay + tips.
        Selling: sale price or price minus platform fees.
      One PayPal transaction verifies at most one record (existing rule, keep the race test).
  Profession ranks (one per app, from that app's VERIFIED dollars only):
    Rank 1 at $1, 2 at $10, 3 at $50, 4 at $100, 5 at $250, 6 at $500, 7 at $1,000.
    Titles: Creator (Spotlight), Freelancer (Freelance), Driver (Market delivery),
    Seller (Market selling), Starter (First Dime). Shown as "Freelancer, rank 3".
  XP:
    - Each new rank reached: +100 XP, once, permanent (like rung claims). XP only, no money.
    - Verified dollars in Spotlight, Freelance and Market: 10 XP per verified dollar, integer math
      (floor(verified cents / 10)). Unverified amounts in these apps give no XP.
    - First Dime XP is unchanged. Overall level uses the existing formula on total XP.
  Class: the player's highest-ranked profession (ties: most verified dollars), shown next to the
    level, e.g. "Level 6 Hustler, Creator class". Derived, never chosen.
  UI: a rank badge and progress to the next rank at the top of each app; a "How to get verified"
    note per app saying which payouts can land in PayPal (text only, no platform logos).
  Leaderboard (opt-in, unchanged privacy): add class and the top two profession ranks.
  Tests: verification per record type (gross and net), one transaction never verifies two records,
    rank thresholds at the exact cent, rank XP awarded once even with concurrent requests,
    unverified amounts give 0 XP, First Dime totals byte-for-byte unchanged on existing fixtures,
    deleting a record never removes an earned rank or its XP.
  KNOWN LIMIT, put in Help: many delivery apps and stores pay to a bank, not PayPal, so those
    players can't verify yet. Don't work around it; list it in the PR.

F2  FIRST-RUN WELCOME
  On first login only: "What kind of work do you do?" with the four apps as choices (multi-select),
  then open the first chosen app, point to the PayPal import, and mark a new quest
  "Start your record" done when they log or import one thing. Skippable. Shown once per player
  (server flag). Keyboard and screen-reader friendly, phone first.

F3  INSTALL TO HOME SCREEN
  Web app manifest (name OneDime, theme colors from the Current skin, icons generated from the
  coin as PNGs) and a service worker that caches ONLY static assets (HTML shell, CSS, JS, fonts,
  model files). Never cache API responses or any player data. Offline: show a plain "You're
  offline" message. Test that /api responses are never stored.

F4  OPERATOR METRICS REPORT
  npm run metrics:report writes metrics/metrics-<date>.md (gitignored) with the KPIs in the
  metrics doc as anonymous totals: monthly verified earners, first-entry rate, first-dime rate,
  time to first verified dime, active days per week, imports per month, apps per player,
  week-1 and week-4 retention, return after a 7-day gap, verified share, suggestion acceptance,
  mismatch rate, total verified earnings, median hourly rate, feedback counts.
  No names, emails, notes or per-player rows. Reads DATABASE_URL, never prints it.

F5  STATS SCREEN WITH HANDHELD-STYLE CHARTS (spec = the Stats tab in reference/pilot.html)
  A fifth top-level tab, "Stats", after Market. Port the pilot's screen exactly:
  - KPI tiles: earned this month, paid share (verified share in the app), best hourly rate,
    active days in the last 7, streak across any app. Money tiles count up in 6 steps.
  - "Earned by month": stacked pixel bars, last 6 months, one fill pattern per app (solid,
    checker, stripes, dots) in one ink color, with a legend. Color is never the only signal.
  - "Real hourly rate": horizontal pixel bars by platform, top 8.
  - "Paid vs pending" (verified vs pending in the app): a 20-block meter.
  - Inline SVG, shape-rendering crispEdges, no chart library, theme tokens only (--chart-ink per
    skin). Each chart has role="img" with a text description and a "Show as a table" toggle.
  - Stepped animations when the tab opens: screen wipes on (steps), bars grow in steps, blocks
    pop in one by one, the coin sprite spins 3 times, the cursor blinks 3 times. Nothing loops
    forever. prefers-reduced-motion turns all of it off.
  - All art is original inline SVG. If you add any outside pixel art, it must be CC0 or similarly
    licensed, credited in the README, embedded (no remote images), and never from a game
    company's assets.
  - Phone: app tabs in two rows (3 + 2). No horizontal overflow at 320px.
  - Uses the app's real data: verified totals and ranks from F1, not the pilot's paid/pending.

F6  TAX-TIME SUMMARY SHEET
  Add a "Tax summary" sheet to "Export everything": by month and year, income by app, platform
  fees, expenses by app, delivery miles. Header note: "For your records. Not tax advice."

CHECKPOINTS: push and update the PR + STATUS.md after F1, after F2-F3, after F4-F6.
TESTS: full suite, browser checks at 320/390/1280 in both themes, contrast checks, npm audit.
DESIRED OUTPUT: PR into main, not merged, with screenshots (fictional data), test results,
  doc links, open questions and anything you were unsure about.
