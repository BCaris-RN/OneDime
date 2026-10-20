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
