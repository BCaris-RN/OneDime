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
