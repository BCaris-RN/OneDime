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
