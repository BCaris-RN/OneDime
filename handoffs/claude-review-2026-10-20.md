# Claude review: PR #7 (Current contrast) and PR #6 (beta tooling)

Reviewed Oct 20, 2026 from the beta review package
`OneDime-beta-review-2026-10-20-c410250.zip`.

## PR #7, Current contrast, head 6cf9163: APPROVED TO MERGE

What I checked:
- The stylesheet diff against the immutable before snapshot (sha256 398ee191...). Every change is a
  color: four new tokens (--selected-border, --link, --ghost-active, --native-icon-surface), dark
  values for --error / --selected-border / --link, selection alpha .47 -> .93, two selected-tab
  border colors, a global `a{color:var(--link)}`, one ghost :active background and one WebKit
  date-picker icon background. No geometry, type, copy or behavior changes. Matches
  color-only-proof.json.
- Before/after counts: 24 failures + 1 uncovered before; 0 failures, 0 uncovered after;
  exemptions listed separately, not counted as passes. Final-head CI green on tree 6b10d13.

Bot finding P2 ("regenerate the corrupted dark desktop capture"): NOT REPRODUCED. Dismiss.
- The committed `after/first-dime-dark-1280.png` (sha256 a6f2122a..., 1280x2410) renders every
  section completely: tabs, goal card, stats, clock, entry form, rung race, entries, rates, footer.
- A pixel diff against the before image changes 1,963 pixels, all at the expected spots
  (selected-tab borders, links, the date-picker icon). Nothing is blank or clipped.
- Action: reply on the thread with this evidence and resolve it. Do not regenerate the image.

Non-blocking notes (P3):
1. The ghost-button :active fix is scoped to `:root[data-theme="light"]`. Confirm in the PR that the
   app always sets data-theme (System mode with no attribute would not get it).
2. The date-picker icon fix uses `::-webkit-calendar-picker-indicator`, so Firefox's icon is not
   covered. Keep it listed as a native-control exemption.
3. Selection at 93% opacity is nearly solid. Fine for contrast; worth a glance on a phone.
4. Follow-up: once PR #6 merges, extend the contrast runner to open the feedback dialog so its
   states have permanent CI coverage (package risk 8). Add it to Phase 5.

## PR #6, beta tooling, head e3918ad: NOT YET APPROVED (source not in the package)

The package has the 30-file manifest, QA and operator evidence, the deploy guide, beta guide and
render.yaml, but not the runtime source. I reviewed what's here; the code review still needs the
diff of: prisma/migrations/000009_feedback, prisma/schema.prisma, src/feedback/router.ts,
src/feedback/export.ts, src/server.ts, public/feedback.ts, public/app.ts, scripts/export-feedback.ts
and the test changes.

From the evidence provided:
- QA is strong: 208/208 tests, 3,920-step browser suite, eight edge groups (import atomicity,
  export retry, feedback failure and retry, cross-player isolation, zero and cross-month views,
  typed deletion, no external requests). Combined PR6 + contrast overlay passed too.
- render.yaml: free web + free Postgres, service auto-deploy off, payouts/Sheets/demo seed off,
  sandbox PayPal, secrets as sync:false, COOKIE_SECURE true. Two requested changes (P2, small):
  a. Pin the database: add `postgresMajorVersion: "16"` to onedime-db, matching the test suite.
  b. Add `healthCheckPath: /health` to onedime-web.
- Merge order: PR #7 first. Then rebase PR #6 on main, resolve public/styles.css, README, STATUS
  and package.json overlaps, apply a and b, rerun full CI, and send me the diff above at the new head.

## Before inviting testers (Brandon's gates, not merge blockers)
- Paste the feedback wording into the Google Sites privacy policy and the beta and open-source
  wording into the user agreement.
- Decide on the tester allowlist. Recommended before invitations; it's an auth change, so it gets
  its own small PR.
- Accept free-tier limits: no backups, database expires 30 days after creation, cold starts.
- Keep feedback exports in a private folder, read them by hand and delete them after triage:
  free text can contain names even with emails filtered.

---

# Update Oct 21: PR #6 and PR #8 source review

Reviewed from the uploaded worktrees `long-run-beta` (PR #6 head 2143071, implementation 72abfe2)
and `long-run-allowlist` (PR #8 head 68ac040, plus later evidence commits).

## PR #6, beta tooling: APPROVED TO MERGE
- Migration 000009: feedback table with player FK ON DELETE CASCADE, CHECK on app/status,
  non-blank body, VARCHAR(1000), index on (player_id, created_at). Good.
- src/feedback/router.ts: strict zod schema (no extra fields, so player_id/status can't be
  injected), trimmed body 1-1000 chars, NUL rejected. Rate limit 5/hour enforced inside a
  transaction with the player row locked (FOR UPDATE), so concurrent posts and multiple servers
  can't bypass it; Retry-After computed from the oldest in-window item. Returns only {ok:true}.
- Guards: the game router's router.use() runs first for every /api request, so feedback inherits
  session-required, no-store, JSON-only, same-origin (Origin must equal PUBLIC_BASE_URL and
  Sec-Fetch-Site not cross-site) and the per-player write limit. Tests cover 415/403/400.
- Export: never queries names/emails; pseudonymous tag = sha256(player UUID) prefix; emails in
  free text redacted; Markdown and HTML escaped; files written 0600 in a 0700 gitignored folder;
  errors never echo the DB URL or feedback. Good.
- render.yaml: Postgres 16 pinned, /health check, free plans, auto-deploy off, payouts/Sheets/demo
  off, secrets sync:false. Bot review on 72abfe2: no findings. CI green on the exact head.
Notes (P3, non-blocking):
1. The feedback `app` enum and CHECK don't include "stats". When the Stats tab ships (F5), add
   "stats" in a NEW migration plus the zod enum and export labels, or feedback sent from Stats
   will be rejected with 400.
2. The general write limiter is in memory per process. Fine on one free instance; revisit if
   OneDime ever runs more than one server.
3. reviews/claude-pr6/* evidence lands in main. Exclude reviews/ from the public export at ship.

## PR #8, tester allowlist: APPROVED TO MERGE (after PR #6, rebased onto main)
- BETA_ALLOWLIST parsed once at startup; trim + lowercase; any invalid entry fails startup with a
  message that never echoes addresses. Unset or blank = old behavior.
- The check runs after PayPal identity and BEFORE player upsert and session creation, so a
  rejected account gets the 403 beta page with no player row and no session.
- Every session lookup re-checks the stored player email, so removing someone from the list ends
  their access on their next request (their session row is deleted).
- 236 tests, beta-page browser/contrast checks (18 combinations), full suite green on the exact head.
Notes (P3):
1. If PayPal doesn't return an email (email attribute off in the sandbox app), every login is
   rejected while the list is set. Say so in docs/deploy-render.md next to BETA_ALLOWLIST.
2. Players removed from the list keep their rows until they use Delete my data or the operator
   removes them. Fine for beta; mention it in the beta guide.

## Merge order
PR #6 -> retarget PR #8 to main, rebase, full CI green -> PR #8. Then Phase 5 branches from main.

---

# Update Oct 29: PRs #9-#12 (rebuilt package sha256 bc55415a...)

## PR #9, Phase 5 (head a9ac352): APPROVE AFTER FIXES
Checked: migrations 000010-000012, src/game/professions.ts, rules.ts, routing.ts, stats.ts,
public/sw.js, review threads.
- Ranks: per-app matching uses gross OR the after-fee amount, same rule in runtime and in the
  000010 backfill (the bot's backfill thread is fixed by the CASE expressions). Claims are a
  (player, profession, rank) primary key with skipDuplicates, so XP is awarded once.
  XP = existing First Dime formula + floor(matched other-app cents / 10) + 100 per profession
  claim; Starter shows but has no claims table entry. Matches Brandon's decisions.
- Migration 000012 marks existing players as already welcomed. Good.
- Service worker: network-first, never touches /api, only static assets and the /app shell.
- Stats endpoint: own data only, repeatable-read transaction.
Fix before merge:
1. CURRENT thread: complete the "Start your record" quest when the first record is created or a
   payment is routed in ANY app, not just First Dime. Test each app.
2. Real hourly rate: use all work with time logged (matched or not), as the pilot and the
   workspace per-hour tables do. Matched-only leaves the chart empty for most beta players.
   Keep the matched/pending meter as is.
3. "Earned this month" is the before-fees overview total while the monthly chart is after fees.
   Label the tile "Earned this month, before fees" (or switch both to after fees) so the same
   screen never shows two different numbers for one month without saying why.
4. Wording (decision 6): every user-facing "verified/Verified" that means "matched to a PayPal
   activity row" becomes "matched" (e.g. "Matched share", "Matched to your PayPal activity").
   Code identifiers can stay. Includes Help, Stats, rank badges, README.
5. README XP rule (decision 4).
6. Reply on each outdated thread with the commit that fixed it, then resolve. I confirmed the
   backfill, verified-share basis, service-worker revalidation and fractional-minute fixes in
   the current source; cite the fix for negative monthly totals and metrics matched amounts too.

## PR #10, ship drafts (head 3368656): APPROVE AFTER WORDING
Apply decision 6 throughout docs/ship/*. Describe features exactly as merged after #9's fixes.

## PR #11, demo video (head 6b0b51d): APPROVED, rebase after #9
DEMO_VIDEO is refused outside NODE_ENV=test, so it can't reach the live site. Rebase on main after
#9 merges, rerun CI, and re-record using the final copy.

## PR #12, skins (head f77a5e6): APPROVED, rebase after #9
Appearance stores only skin and mode; old theme key migrated. After rebase, confirm the 6-tab 3+3
phone grid and the Stats --chart-ink in Paper and Slate, light and dark, with the contrast runner.

## New: deps-security PR (from main) FIRST
Clear the body-parser and undici high advisories with the smallest version bumps; cite advisories.
Merge it before #9 so the live beta gets it on the next redeploy.

Merge order: deps-security -> #9 -> rebase #11, #12 -> #11, #12 -> #10.
