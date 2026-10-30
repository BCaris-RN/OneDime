# OneDime

> Submission draft. Phase 5 features are in open PR #9 and are not yet part of main.

## Inspiration

Independent workers often keep earnings and time records in different places. I
wanted a small, private tool that helps someone record the work, see what is
matched to your PayPal activity, and decide where their next hour is best spent.

## What it does

OneDime combines a first-income ledger, focused workspaces for creator income,
freelance work and marketplace shifts or sales, and a PayPal workspace for importing
and reviewing the user's own activity CSV. A monthly overview and exports bring the
records together without counting a linked PayPal payment twice.

Phase 5 adds matched profession ranks, first-run and install support, aggregate
operator metrics, a Stats tab and a tax-summary worksheet. These additions are in
[open PR #9](https://github.com/BCaris-RN/OneDime/pull/9), pending review and merge;
they are not available from the current main branch yet.

## How we built it

OneDime uses TypeScript, Express, PostgreSQL and a plain HTML/CSS/TypeScript client.
Money is integer cents. Each phase starts from an approved handoff, gets implemented
on its own branch, and goes through local tests, GitHub Actions and Claude review
before Brandon decides whether to merge. See [how I built it](how-we-built-it.md).

PayPal is used in sandbox mode for sign-in. Entries are matched to your PayPal activity file. A CSV
import is user-provided evidence and is not an authenticated PayPal transaction
lookup. The isolated local demo uses fake sign-in and fictional data and makes no
provider calls.

## Challenges

The tricky cases were keeping ownership boundaries consistent across every app,
counting a routed payment only once, handling payouts whose batch and individual-item
outcomes differ, and accounting for payments that land in a different month than the
work. We kept money in integer cents and added tests for the failure and timing cases.

## Accomplishments

The merged foundation supports private sessions, player-owned records, safe exports,
optional local suggestions, sandbox activity-file matching and a private feedback path. The
pending Phase 5 branch also has a 4,288-step browser focus audit, automated contrast checks,
and the Phase 5 work waiting in an unmerged PR.

## What we learned

Imported data needs careful labels: a user's CSV can help match a record, but it does
not prove that the file is genuine. Keeping that distinction visible matters as much
as the calculation. We also learned that a batch-level success and an item-level
payment are different things, and that earning month and payment month answer
different questions.

## What's next

Claude reviews the Phase 5 PR and Brandon decides whether to merge it. Before any
private beta, Brandon must finish the policy and tester-account checks. Deployment,
tester access and any live-payment use remain operator-controlled. Demo recording tooling (PR #11)
and the optional Paper/Slate skins (PR #12) remain in separate open drafts; they are
not part of this submission's main-branch claim.

## Built with

TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions and the
PayPal Developer Platform (sandbox).

## Testing instructions

For current main, use Node 24 and PostgreSQL 16, install with `npm ci`, apply
migrations with `npm run db:migrate`, then run `npm run build` and `npm test`. The
isolated fictional demo is `npm run demo`; it needs Docker and uses fake login with no
provider credentials. To test the Phase 5 ranks and Stats changes, check out PR #9's
branch and follow the same local setup. Do not use real account or payment data.
