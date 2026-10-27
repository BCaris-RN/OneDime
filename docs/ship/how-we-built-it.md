# How I built OneDime

I built OneDime to help independent workers keep a clear record of income across
platforms. It is a private TypeScript and Express app with PostgreSQL, a plain
HTML/CSS/TypeScript interface, and PayPal sandbox sign-in and activity import.

I worked in phases: define the product rules and handoff, approve scope, implement
on a phase branch, run tests and CI, get Claude's review, then bring the reviewed PR
to Brandon for a separate merge decision. Brandon owns every merge, deployment,
visibility change, secret and PayPal account action. Claude is lead and reviewer;
Codex implements the approved handoffs. That separation keeps product decisions,
implementation and release control in different hands.

The first four phases are merged across five PRs. Three supporting beta-preparation
PRs are also merged, for eight merged PRs on main. Phase 5 is in
[open PR #9](https://github.com/BCaris-RN/OneDime/pull/9), which adds ranks, a Stats
tab, first-run and install support, aggregate operator metrics and a tax-summary
export. Its latest local checkpoint has 260 tests across 12 test files; earlier
exact-head CI runs passed through F1-F6. Review fixes are being checked on the
updated head, so Phase 5 is not presented as shipped. The repository also has 24
automated contrast regression checks and a browser audit that covers 4,288 keyboard
focus steps across workspaces and viewport sizes.

Two code-review catches changed how the app treats edge cases. First, payout batch
status and the individual payout item's outcome are separate facts: a successful
batch does not mean every item succeeded, and an early webhook must survive a late,
stale create response. Second, a PayPal payment can arrive in a different calendar
month from the work record. Monthly totals and exports therefore use the payment
date for paid amounts while keeping the work date for earned amounts. Tests cover
these orderings and month boundaries.

I keep money in integer cents, and the database scopes records to their owner. PayPal
activity imports are user-provided CSV evidence, not an authenticated transaction
lookup. The app matches an incoming sandbox payment to one owned record; it never
adds the imported payment on top of that record as a second earning. Any operator
metrics are aggregate-only. OneDime does not scrape, automate or log in to gig
platforms. Its optional on-device suggestion model does not send ledger text to a
provider.

The local demo uses fictional data and fake sign-in. It does not demonstrate live
PayPal authentication or contact a payment provider. PayPal sandbox supports testing
with isolated test accounts; it is separate from live PayPal. See the
[PayPal sandbox guide](https://developer.paypal.com/sandbox-testing/overview/).

Built by Brandon Caris with Claude (lead and reviewer) and Codex (implementation),
on the PayPal Developer Platform.
