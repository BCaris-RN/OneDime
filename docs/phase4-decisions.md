# Phase 4 decisions and validation

Base: merged main `423c33d`. Scope: `handoffs/week4-playtest.md`.
No merge, deployment, paid AI service, payout enablement or visibility changes.

## P1: payout batch and item states

The new nullable batch_status column records batch outcomes independently. Neither
batch webhooks nor create responses finalize an item; it stays PENDING until an
item event arrives. The player's PayPal panel and export show both states, never
the recipient email. Verified event IDs remain transactionally deduplicated.

BLOCKED is terminal, like FAILED/DENIED/CANCELED/SUCCESS. HELD and UNCLAIMED are
nonterminal and can later become a definitive item outcome. RETURNED/REFUNDED
can supersede success. Stale processing events cannot undo a terminal outcome.
All documented payout item webhook names are handled; DENIED remains supported.
Tests use mocked signature verification and never enable a real payout connection.

Primary docs checked Oct 18, 2026 (Hawaii):
- https://developer.paypal.com/payouts/webhooks/
- https://developer.paypal.com/api/payments.payouts-batch/v1/definitions/payout_batch_header/
- https://developer.paypal.com/api/payments.payouts-batch/v1/payouts-item-get

## P2: free browser suggestions

Selected MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33, immutable revision
c07f66d9cbf781191bee66edfe8ad7856f045781. Its model metadata declares MIT; the base
Microsoft MIT license and model attribution are included. Quantized ONNX weights
are 13,114,198 bytes, verified by SHA-256. Model/config/tokenizer, bundled worker
and stock single-thread asyncify WASM total 41,292,250 uncompressed bytes (41.3 MB).
Everything is self-hosted; no third-party model/WASM fetch origin is allowed by CSP.
Browser caching includes weights and WASM. The build copies runtime licenses.

Transformers.js 4.3.1 is Apache-2.0; ONNX Runtime is MIT. Playwright 1.64.1 is an
Apache-2.0 development dependency for the required browser privacy/cache check.
npm audit reports zero vulnerabilities. Chrome Prompt API was rejected as the main
path because its current platform/hardware requirements exclude ordinary phones.

Five fixed NLI labels cover First Dime, Spotlight, Freelance, delivery and selling.
Trusted code maps them to schema-compatible record types and platform Other; PayPal
is a review workspace, not another income destination. Known payers keep the fixed map.
Confidence >=0.7 and a >=0.15 winning margin are required. Scores are heuristic, not
proof of payment origin. Inputs are bounded payer/amount/kind, treated as data; there
are no generated commands, tools or automatic routes. A two-minute timeout terminates
the worker and uses the fallback. Actual physical phone speed remains unmeasured.

Preference defaults off, persists per player, and enabling it explicitly permits the
download. Inference happens only on the player's request. Payment data is not sent
for AI; imported records are still stored in OneDime as before. The server inference
client, endpoint, budgets/cache and operational env/config references were removed.
Migration 000007 drops the three tables. Historical migration 000005 and approved
handoff documents remain unchanged as provenance, not operational setup instructions.

The real Chromium check passes at 390px: off/default fallback, first local Spotlight
suggestion, no request containing the synthetic payer canary, same-origin requests,
persisted preference and a second page load with no weight-file network request.
Unit/integration suite: 170 tests pass (obsolete provider tests removed; device and
preference tests added). No provider key, spending code or hosted inference remains.

Primary sources checked Oct 18, 2026:
- https://huggingface.co/MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33
- https://huggingface.co/MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33/tree/c07f66d9cbf781191bee66edfe8ad7856f045781
- https://raw.githubusercontent.com/microsoft/xtreme-distil-transformers/main/LICENSE
- https://huggingface.co/docs/transformers.js/api/env
- https://github.com/huggingface/transformers.js/blob/4.3.1/LICENSE
- https://onnxruntime.ai/docs/tutorials/web/deploy.html
- https://developer.chrome.com/docs/ai/prompt-api
- https://playwright.dev/docs/network
- https://playwright.dev/docs/ci

## P3: monthly views, account controls and policies

Overview uses repeatable-read owned ledger queries and the same summary definitions
as exports. It never adds imported PayPal activity a second time. Earned/fees/net
follow work dates; paid follows payment dates; pending follows the work month.
Matched, verified First Dime records use payment gross for financial earned totals,
actual fees, and received net for paid/net totals in the overview and export Summary.
Both gross-logged and net-logged matches normalize once, so fees are not subtracted
twice. Unmatched records use their logged amount with no invented fee. Game totals,
entry amounts, XP and rung math remain unchanged. Existing pending/open/by-platform totals stay all time and are
labeled accordingly; monthly earnings/expenses respond to each app's month picker.
First Dime gets an additional monthly summary beside its unchanged game statistics.
Stale in-flight responses cannot overwrite a newly selected month.

TaskRabbit, Rover and Thumbtack are allowed delivery/service platforms in validation,
the database constraint and UI. Help/Playbook cover the five apps, routing, suppliers,
gross/net matching, free device suggestions and file imports.

Delete my data requires exact typed DELETE MY DATA under the existing session,
JSON/origin/rate guards. A transaction deletes the player; FK cascades remove all
owned ledgers, imported payments, receipts, claims, quests, payouts and sessions.
The session cookie is cleared; other players remain untouched. Global anonymous
webhook event IDs remain for duplicate protection. Policies describe these boundaries.

Privacy/terms are public local pages with required draft code comments. Their copy
describes current private play-test behavior; it is not a claim of legal compliance.
Operator contact, jurisdiction and backup-retention review remain Brandon's tasks
before any public use. ICO transparency guidance informed the topics only.

APP_BASE_URL aliases PUBLIC_BASE_URL, including numeric loopback. Empty aliases are
ignored; conflicting nonempty aliases fail. Callback registration and browser origin
must agree; real sandbox dashboard acceptance is not claimed without approved keys.

Validation: build and 177 tests pass, including all owned-table cascades, another
player's survival, bad confirmation/origin, monthly ownership/nonduplication, the
three service enums, public policies and numeric-loopback config. Browser checks
cover a past-month request, BLOCKED/HELD presentation, local AI/cache and typed
account deletion. Provider connectivity and physical phone speed remain manual.

Sources checked Oct 18, 2026:
- https://developer.paypal.com/log-in/references
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/

## P4: keyboard and phone polish

Tables have captions, scoped column headings, named keyboard-focusable scroll regions,
and contextual row actions. Region names follow refreshed month captions. Cancel edit
appears only during editing; resetting returns focus to the form. Rerendered rows restore
the selected action where possible. Export date filters stay blank until chosen instead
of inheriting the work-entry date. All-time platform and paid-hour scopes are explicit.

Keyboard focus uses a visible outline, including native date segments, and scrolls
above the fixed phone controls. Tall regions align their start in the usable viewport.
Positioned table wrappers contain the absolute screen-reader header text, which otherwise
expanded the document beyond 320px. Native date fields get a full row on phones; forms
use one column at 320px. Dark/light ghost buttons, LCD labels and placeholders have
stronger contrast. The existing named D-pad/A/B controls are retained and asserted.

Final review also found a late create response could overwrite an early terminal batch
webhook. Commit 6a4e011 reconciles batch and item states separately inside a transaction;
two new regressions deliver SUCCESS/DENIED before the create response. The full suite
now has 179 passing tests.

No Brandon play-test notes were present in STATUS.md or PR #5 when checked. Screenshots
use the disposable fictional demo and synthetic payments, with no real identity or
third-party logos. Physical screen-reader/mobile device testing remains manual; browser
emulation does not establish device inference speed. Draft policies need operator review.
The existing prepared Render starter plans are not a zero-cost hosting decision and must
be revisited before any separately approved deployment. No resources were provisioned.

Local final validation: build, 179 unit/integration tests and zero-vulnerability full
npm audit pass. Real Chromium passes 3,912 Tab steps plus Home/End/arrow activation,
visible focus, labels/captions, every sub-tab, 320/390px and light/dark modes. It also
passes month-region naming, local inference/no payer requests/cached reload, public
policy pages and typed deletion. The 24 p4-* screenshots include all five apps plus
Market selling in every width/theme combination. This is keyboard/browser evidence,
not a claim of a full physical-device or screen-reader conformance audit.
