TASK HANDOFF: OneDime, Phase 4 (Fixes, free on-device AI, missing pieces)
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local, G:\one_dime).
Written Oct 19, 2026. LONG RUN: work the parts in order; push, update the draft PR and STATUS.md at each checkpoint,
then continue. Read AGENTS.md and docs/SDLC.md first. They win over anything here on approvals and secrets.

AUTHORIZED: create branch week4-playtest from main (423c33d or later), push to it, open ONE draft PR, keep it updated,
  mark it ready for review at the end. Add or remove npm dependencies as needed (checked live, audit clean).
NOT AUTHORIZED: merge, deploy, public repo, live PayPal, enabling PAYOUTS_ENABLED, LICENSE (Phase 5).

GOVERNING RULE FOR THIS PHASE
  OneDime must run at zero cost to players AND to Brandon. No feature may require a paid API to work.
  Players never pay for anything. AI must be free for everyone.

====================================================================================
P1  FIX THE TWO OPEN REVIEW FINDINGS ON PR #4 (payouts, still behind PAYOUTS_ENABLED=false)
  1. PAYMENT.PAYOUTSBATCH.SUCCESS must NOT mark a payout item SUCCESS. Store batch completion separately;
     only item-level events finalize an item. Check PayPal's current docs for item statuses.
  2. Handle PAYMENT.PAYOUTS-ITEM.BLOCKED and PAYMENT.PAYOUTS-ITEM.HELD (and any other documented item events
     the map is missing). Define which are terminal and which allow a later status to replace them.
  Tests: batch success leaves items pending; a later item FAILED/DENIED/CANCELED is applied; BLOCKED and HELD
  show in the player's UI; duplicate events still ignored.
  Reply to both bot comments on PR #4 with the fix commit.
  CHECKPOINT P1.

====================================================================================
P2  REPLACE THE CLAUDE API WITH FREE ON-DEVICE AI
  Goal: the routing suggestion for PayPal payments runs IN THE PLAYER'S BROWSER. No API key, no server AI calls,
  no AI bill, and payer names never leave the device.
  - Evaluate and pick ONE, citing current docs, licenses and sizes in the PR:
      a) Transformers.js with a small zero-shot classification or small instruction model (ONNX, WebGPU/WASM)
      b) Chrome's built-in AI (Prompt API), only as an extra path, never the only one, since other browsers lack it
    Requirements: open license allowing this use; total download small enough for a phone (target under 100 MB,
    smaller is better, say the real number); works on a mid-range phone in a reasonable time.
  - Opt-in: a "Smart suggestions" toggle on the PayPal tab, off by default, that states the one-time download size
    and that nothing leaves the device. Model files are cached by the browser after the first download.
  - Same flow as before: AI suggests app + platform/store + record type; player confirms; the SERVER still
    validates every route with the existing schema. Anything below the confidence gate shows no suggestion.
    The fixed payer map stays as the fallback when the toggle is off, the model can't load, or the device is too weak.
  - Input to the model: payer name, amount and payment kind only. Payer names are untrusted data.
  - Content-Security-Policy: allow only the exact hosts needed to fetch model files and WASM. Prefer self-hosting
    model files from our own server if the size is reasonable. Document the choice.
  - REMOVE: the server-side Anthropic client, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, AI_MONTHLY_BUDGET_CENTS,
    the ai_usage budget and the server suggestion cache (migration drops their tables), and every doc or env
    reference to them. No AI spending code remains anywhere.
  Tests: fixed-map fallback with the toggle off; server rejects an invalid route even if the browser sends it;
    no network request contains payer data (assert in a browser test); the toggle persists per player.
  Browser check on a phone width: download notice, first suggestion, then a cached second load.
  CHECKPOINT P2.

====================================================================================
P3  MISSING PIECES
  1. Home overview: a "This month, everywhere" summary at the top of the PayPal tab (or a header button that
     opens it): earned, paid, pending, fees, expenses and net per app plus a total, and a month picker.
     Reuse the existing summary queries. Nothing is counted twice (routing rules).
  2. Month picker on every app's stats (default: this month), so past months are viewable, not only exportable.
  3. Market > Delivery and rides: add TaskRabbit, Rover and Thumbtack to the platform list (enum migration).
  4. Help and Playbook cover all five apps: what each holds, the routing rules ("Needs an audience? Spotlight..."),
     Printify as supplier vs Printify Shop as store, gross or net verification, exports into Google Sheets,
     and Smart suggestions. Plain, friendly, short. No XP or quests for the new apps (game rules unchanged).
  5. Privacy policy (/privacy) and terms (/terms) pages, plain language, linked in the footer and Help.
     Must state: adults only, what's stored, that PayPal CSV files are parsed and discarded, that Smart
     suggestions run on the device, no ads, no selling data, how to export and delete your data.
     Mark them "Draft, not legal advice" in a code comment for Brandon to review.
  6. Delete my data: a button in settings that deletes the player and all their rows (cascade) after a typed
     confirmation, and ends the session. Test it removes every owned row.
  7. Local login with 127.0.0.1: make the PayPal callback work when APP_BASE_URL is http://127.0.0.1:3000
     (PayPal's dashboard may reject localhost). Document both options in the README.
  CHECKPOINT P3.

====================================================================================
P4  ACCESSIBILITY AND PLAY-TEST POLISH
  - Full keyboard pass on all five apps, focus order, visible focus, labels on every input, table captions.
  - Screen-reader names on the D-pad and A/B buttons; the fixed phone bar never covers a focused field
    (scroll the field into view above the bar).
  - Check 320px and 390px widths and dark mode on every tab with seed data. No horizontal overflow.
  - Fix anything Brandon reports during play-testing (he will add notes to STATUS.md or the PR).
  CHECKPOINT P4: mark the PR ready for review.

====================================================================================
TESTS TO RUN: everything above plus the full existing suite, locally and in CI. npm audit clean.

DO NOT TOUCH: game rules; XP for non-First-Dime apps; LICENSE; deploys; repo visibility; payouts enablement;
  receipt-image verifier; any automation of gig platforms.

DESIRED OUTPUT: one PR into main, NOT merged, updated per checkpoint, with test results, doc links (model,
  library and license pages, PayPal payout docs), phone screenshots of new screens (fictional data only),
  open questions, and anything you were unsure about instead of guessing.

FALLBACK: if no on-device model meets the size and license bar, stop P2 after the evaluation, report the options
  with real sizes, keep the fixed payer map as the only routing helper, and continue with P3 and P4.