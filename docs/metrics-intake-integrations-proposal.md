# OneDime metrics and earnings intake suggestions

Prepared October 20, 2026 (Hawaii). Discussion draft for Brandon and Claude.
Repository reviewed: `G:\one_dime`, `week5-beta`, head `e3918ad`.

These are implementation suggestions, not an approved implementation handoff. Brandon clarified
that connecting other PayPal apps means importing earnings from platforms that pay through PayPal
or Hyperwallet. The priority is recipient-side earnings intake and useful reporting.

## Product direction

Make each workspace answer, "How is this kind of work performing?" Make the PayPal tab answer,
"What have I earned across my work, what has arrived, and what still needs review?"

The useful loop is import, review, match, then understand performance. Better intake should reduce
manual entry; better graphs should help someone choose where to spend their next hour. Preserve
manual entry and file import wherever an official direct connection is unavailable.

There is already a foundation: workspace statistics and platform tables in
[workspaces.ts](../public/workspaces.ts), selected-month First Dime totals and a combined PayPal
overview in [overview.ts](../public/overview.ts), and owned ledger aggregation in
[the overview router](../src/ledger/overview.ts). The inspected views do not yet provide a general
metrics graph system. Build on those definitions after reviewing their differences below.

## Metrics on each workspace screen

Start with three or four relevant headline numbers, one trend graph, and one comparison graph.
Allow people to expand the rest. Keep the entry form and import/review actions easy to reach.

| Workspace | Useful KPIs | First graphs to add | Decision the view supports |
| --- | --- | --- | --- |
| First Dime | Logged earnings, verified earnings, recorded hours, earnings per recorded hour | Daily earnings with a verified portion; earnings and hours by site | Which starter gigs are rewarding the time recorded? |
| Spotlight | Recorded income, received income where supported, expenses, net after recorded expenses, open deal value | Income by platform/stream over time; current brand-deal value by stage | Which creator streams contribute income, and what work remains open? |
| Freelance | Recorded project value, paid net, fees, open/clearing value, paid-project hourly rate | Received income and fees by period; current project value by stage or client | Which client work pays well, and where is project value waiting? |
| Market: delivery and services | Pay plus tips, recorded hours, earnings/hour, recorded miles, earnings/mile where available | Pay and tips over time; platform comparison with hours or miles coverage | Which shifts or service platforms produce the strongest recorded returns? |
| Market: selling | Sales revenue, item/fee/shipping costs, contribution, expenses, net after recorded expenses | Revenue-to-contribution bridge; contribution by store over time | Which stores or products retain the most revenue after recorded costs? |

First Dime can also have an activity calendar and its existing progress information. Keep XP,
streaks, and levels visibly distinct from financial measures. A graph is not a reason to change
game rules or verification eligibility.

Use current deal/project stages as a snapshot. Historical pipeline trends or stage conversion
rates require stage history that is not currently recorded. A brand deliverable due date is not
a payment due date. Audience reach, engagement, true utilization, inventory sell-through, taxes,
and full vehicle costs need additional data; they should not appear as computed facts today.

## The PayPal tab as the combined reporting and intake hub

Retain the PayPal tab name for now and consider three internal views:

- **Overview:** all workspaces by default, with workspace/platform/source filters. Show the
  same metrics available within each workspace and let someone drill into one field here.
- **Activity:** incoming records, suggested matches, unassigned items, mismatches, and links
  to the work records they support. Keep the next useful review action close to each item.
- **Connections:** source accounts, available import methods, access requirements, and freshness.

The combined overview should offer a monthly trend by workspace, recorded earnings versus
received payments, fees and recorded expenses, and a current review workload. A payment receipt
and its earning record must not become two earnings in the combined graph. Keep unassigned
receipts visible as unassigned receipts rather than quietly assigning them to a workspace.

Use the same date range, currency, metric definition, and underlying query contract for a
workspace chart and its PayPal equivalent. A click on a point or bar should open the filtered
source records. Tables and exports should use the same filters so a displayed total can be
checked against its rows.

Charts should update when confirmed records change. Add report export separately, so seeing
current metrics does not depend on pressing Generate. Start with the existing month picker;
add multi-month ranges only when the reporting query supports them consistently.

On a phone, stack the charts and retain readable labels. Provide a text summary and data table
for every graph, keyboard-accessible details, design-token colors, and labels/patterns beyond
color. Show gaps for unavailable data. For comparisons, label partial periods explicitly and
compare equivalent elapsed periods when offering percentage changes.

## Agree on metric definitions before graph implementation

The current summaries contain intentional differences. Preserve them during discovery and
resolve desired changes explicitly; chart work must not silently rewrite financial meaning.
See [summary.ts](../src/ledger/summary.ts),
[first-totals.ts](../src/ledger/first-totals.ts), and
[the current accounting notes](../README.md#export-and-import-files).

| Topic | Implementation suggestion |
| --- | --- |
| Earnings dates versus receipt dates | Preserve work/sale dates for recorded earnings and payment dates where available for receipts. Current Freelance earnings use the project start date. A same-month difference between earned and received is not automatically outstanding debt. |
| Evidence versus status | Distinguish user-marked paid, file-import matched, provider-confirmed status, and current game verification. Existing First Dime totals can treat verified entries as paid; sales do not record a separate payment date. Do not present those as complete bank cash flow. |
| Gross, fees, and net | Current imported Spotlight/delivery records can hold payment net as the recorded amount, while other workspaces retain gross and fees separately. Avoid calling every combined earned total gross revenue. Review normalization and migration separately before making that claim. |
| Period scope | Current pending/open headlines and some platform/rate comparisons are all time; monthly totals use selected dates. Label each scope. New selected-period charts need explicit filters rather than assuming every existing summary field is monthly. |
| Rates | Use eligible earnings divided by total recorded time or distance, not the average of row-level rates. Exclude records missing the denominator from both sides of the comparison; show record count and coverage. Existing rate populations differ, so a new consistent rate contract needs review. |
| Expenses and margin | Selling contribution subtracts item cost, fees, and shipping. Net after recorded expenses additionally subtracts workspace expenses. Existing margin excludes standalone expenses; label that distinction. Neither figure establishes full after-tax profit. |
| Unknown values | Distinguish zero from not provided. A net-only payment does not establish its gross amount or a zero fee. Show missing time, fees, dates, or costs as incomplete rather than fabricating precision. |
| Currency | The current product is USD-oriented. Keep unsupported currencies out of USD totals. Future support needs integer minor units with the correct currency exponent and explicit FX provenance; never sum unlike currencies directly. |

Existing required numeric fields permit zero without recording whether it meant "not provided."
Historical records cannot always distinguish missing time, mileage, fees, or costs from a true
zero. Existing-data charts can report positive-time/mileage record coverage, but should not claim
complete capture. Preserving unknown values needs a separately reviewed input/provenance design;
do not reinterpret old zeros automatically. See [the input schemas](../src/ledger/catalog.ts).

For each proposed KPI, document its name, purpose, formula, eligible records, date basis, currency,
missing-data rule, and drill-down. Reuse that contract in the screen, export, and tests. Maintain
the distinction between financial reporting and the established game calculations.

## Leave room for more earnings sources

Use a small source-adapter boundary so the rest of OneDime can consume approved imports in a
consistent way. Suggested sources are the existing PayPal CSV import, platform-issued export
files where available, approved PayPal reporting access, and approved Hyperwallet data access.

Separate four facts: the earning platform, payment processor, source account/program, and import
method. A platform might pay through Hyperwallet into PayPal; those facts describe one chain.
The processor name alone does not prove which platform generated the income.

The existing `Hyperwallet -> Prolific` rule in [activity.ts](../src/paypal/activity.ts) is only
a suggestion. In an expanded intake design, generic Hyperwallet receipts should require platform
evidence or user confirmation. Any change to existing matching/verification rules belongs in
a separate reviewed scope.

Proposed responsibilities for an adapter:

- Declare actual capabilities: file import, historical read, incremental sync, or supported
  provider notifications. Do not assume every source supports all of them.
- Emit source events with owner, account/program, provider identifiers, raw provider status,
  currency, known gross/fees/net, relevant timestamps, import time, and field completeness.
- Keep earning date, provider payment date, and downstream settlement date separate when known.
- Map events to a review queue before creating or linking a workspace earning. Keep correction
  history and links to the supporting evidence; minimize retained personal data.
- Define retry, pagination, replay, duplicate, refund, and reversal handling for that provider.
  Protect provider credentials on the server and support disconnect/revocation.

This is a proposed boundary, not a request to add speculative providers or tables immediately.
The present database uses PayPal-specific transaction storage; multiple providers would require
a separate design/migration review.

Prevent duplicate ingestion within a source and duplicate income across sources. For example,
a platform earning of $100, a Hyperwallet disbursement, and a PayPal receipt can be evidence of
the same $100. Link the evidence and count the economic earning once. Transfers, refunds, and
reversals need their own event roles. Later partial/combined payouts need explicit allocation
support rather than forced one-to-one matches.

Expose honest connection states: file import available, API access pending, connected, needs
attention, or disconnected. Show last successful import, historical coverage, incomplete syncs,
and unresolved records. Keep sign-in status separate from permission to read transaction data.

## PayPal direct intake: an access question first

Current PayPal login establishes identity; activity intake is user-uploaded CSV. PayPal describes
login consent as basic non-financial information. Automatic history import needs a separately
approved reporting arrangement. [PayPal login documentation](https://developer.paypal.com/log-in/how-it-works).

PayPal's official Transaction Search specification says third-party account access requires
participation in its partner network and further steps with a partner manager. Confirm whether
OneDime's recipient-facing use case, target countries, and account types qualify, and what
consent/access model is permitted. Extending the current login is not a confirmed solution.
[Official Transaction Search specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/reporting_transactions_v1.json).

If access is approved, allow for reporting delay and paginated date-window backfills. The
endpoint documentation specifies up to three hours of delay, a maximum 31-day request range,
and reporting records that can share a transaction ID. Design source-event identity from the
documented record semantics; the current CSV duplicate key is not automatically suitable for
reporting API data. Confirm relevant transaction types before treating incoming records as
earnings. [List transactions documentation](https://developer.paypal.com/api/transaction-search/v1/search-get).

## Hyperwallet access discovery brief

No Hyperwallet API client, connection flow, or access configuration was found in the reviewed
source. Existing references are payer suggestions and fictional fixtures. This does not establish
whether Brandon has an account or an access conversation outside the repository.

PayPal currently markets this offering as Enterprise Payouts, formerly Hyperwallet. Its public
product material primarily describes organizations sending payouts and managing payout programs.
[PayPal Enterprise Payouts](https://www.paypal.com/us/business/make-payments/enterprise-payouts).

The documented SDK uses an API username, API password, and program token. Environment docs
describe program-specific roles and a self-registration developer sandbox. That test environment
does not establish access to workers' real earnings from unrelated platform programs. Public
documentation reviewed did not confirm a universal recipient-consent connection across programs;
that remains an open feasibility question. [Official SDK](https://hyperwallet.github.io/node-sdk/),
[environment documentation](https://docs.hyperwallet.com/content/api/v4/overview/environments).

The useful first deliverable is a written answer to these questions from Hyperwallet and, where
needed, the platform operating the payout program:

1. Is recipient-authorized, read-only history access available for an independent earnings app?
2. Can one connection cover multiple sponsoring programs, or must each program approve access?
3. Which target platforms, countries, account types, and currencies support that arrangement?
4. What identifiers and consent flow link a payee safely without sharing a Pay Portal password?
5. Which earning, payment, fee, transfer, refund/reversal, and history fields are actually exposed?
6. Can records be matched to downstream PayPal receipts using reliable provider references?
7. Are supported recipient exports available if direct access is unsuitable? What are their schemas?
8. What roles, commercial terms, retention rules, onboarding steps, and infrastructure are required?

For an approved program integration, Hyperwallet documents compliance review, configured UAT,
signoff, and production credentials. Its environment guidance also describes restricted production
API access through allowlisted IPs. Check hosting/egress compatibility and costs before choosing
that route. A sandbox experiment should use fictional data and only the operations needed to
validate intake. [Onboarding](https://docs.hyperwallet.com/content/onboarding/v1/overview),
[environments](https://docs.hyperwallet.com/content/api/v4/overview/environments).

If recipient history access is unavailable, prioritize supported user-provided exports and the
resulting PayPal receipt where applicable. Keep unavailable gross, fees, earning dates, and upstream
platform identity explicit. Do not promise access to an entire platform's worker earnings through
OneDime's own payout-program credentials.

### Draft inquiry for Brandon to send

> We are developing OneDime, an earnings intake and reporting app for individual workers and
> creators. Users want to import their own earnings from platforms that pay through Hyperwallet,
> including payments subsequently received in PayPal.
>
> We would like to confirm whether you support recipient-authorized, read-only access for this
> use case. We are seeking payment history, status, fees, relevant dates, currency, and identifiers
> that support reconciliation. The intended integration does not send payouts or modify payee
> profiles or transfer methods.
>
> Does access require an agreement with each sponsoring platform/program, or is a recipient-consent
> integration available across programs? Which sandbox, scopes/roles, account types, territories,
> commercial requirements, and production approvals apply? If direct access is unavailable,
> which recipient exports or approved reporting alternatives can we support?
>
> Please direct us to the appropriate technical and partnership contact for this intake use case.

This inquiry is drafted only; it has not been sent.

## Suggested implementation order

1. **Define the metrics and source inventory.** Choose the first three target earning platforms;
   document current fields, legitimate export options, metric contracts, and gaps. Run PayPal and
   Hyperwallet access discovery in parallel so reporting work does not wait on vendor decisions.
2. **Add reporting from existing records.** Introduce the reusable trend/comparison components
   and a shared reporting query contract. Deliver per-workspace charts and the PayPal combined
   view together, with matching tables and source-record drill-downs. Review financial-definition
   changes separately before implementing them.
3. **Strengthen intake and reconciliation.** Add provenance, connection capabilities/freshness,
   and cross-source duplicate/evidence handling in a dedicated reviewed change. Support the next
   useful export format after obtaining a representative, permitted sample.
4. **Add approved direct connections.** Build one source adapter at a time after confirming
   recipient data rights and access. Retain file intake as a usable fallback.
5. **Add richer analysis when its data exists.** Consider payout timing, historical stage trends,
   saved report views, and richer expense/margin analysis after adding the necessary evidence.

For implementation, verify chart/table/export agreement, month boundaries, unknown versus zero,
missing time/mileage, mixed-currency exclusion, replayed imports, cross-source duplication,
refunds/reversals, disconnected sources, and ownership isolation. Use fictional fixtures and
mock external services. Preserve existing financial/game/auth tests and explicitly review any
needed contract changes. Graphs also need keyboard, contrast, and mobile checks.

## Decisions worth making next

- Which three earning platforms should intake support first? Specific sources will determine
  whether a file adapter, approved API, or another supported route is most useful.
- Should the initial graphs use the existing recorded-value definitions, with clear labels, or
  should a separate financial-normalization change precede cross-workspace gross/fee/net charts?
- Which period should be the default beyond the current monthly view: 30 days or three months?
- Is there already a Hyperwallet/PayPal partnership or sandbox-access conversation outside the repo?

This draft adds suggestions only. Application behavior, calculations, imports, authentication,
schemas, skins, accounts, credentials, and external services have not been changed.
