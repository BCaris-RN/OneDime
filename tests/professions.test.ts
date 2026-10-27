import { describe, expect, it } from "vitest";
import { professionClass, professionRank, verifiedProfessionTotals } from "../src/game/professions.js";
import type { LedgerRow } from "../src/ledger/catalog.js";

const row = (fields: Record<string, string | number | null>): LedgerRow => ({ id: "record", player_id: "owner", ...fields });
const data = {
  income: [], deals: [], expenses: [], gigs: [], shifts: [], sales: []
} as unknown as Parameters<typeof verifiedProfessionTotals>[0];
const payment = (recordType: string, recordId: string, gross = 1_000, fee = 30) => ({
  routed_record_type: recordType, routed_record_id: recordId, currency: "USD",
  gross_cents: gross, fee_cents: fee, net_cents: gross - fee, kind: "Payment Received"
});

describe("verified profession totals", () => {
  it("counts only a paid record with its own matching incoming USD payment", () => {
    const rows = {
      ...data,
      income: [row({ id: "creator", status: "paid", amount_cents: 1_000 })],
      gigs: [row({ id: "gig", stage: "Paid", gross_cents: 1_000, fee_cents: 30 })],
      shifts: [row({ id: "shift", pay_cents: 900, tips_cents: 100 })],
      sales: [row({ id: "sale", status: "paid", price_cents: 1_000, fee_cents: 30 })]
    } as unknown as typeof data;
    const totals = verifiedProfessionTotals(rows, [
      payment("income", "creator"), payment("gigs", "gig"), payment("shifts", "shift"), payment("sales", "sale")
    ], [{ amountCents: 500, verified: true }, { amountCents: 400, verified: false }]);
    expect(totals).toEqual({ creator: 1_000, freelancer: 1_000, driver: 1_000, seller: 1_000, starter: 500 });
  });

  it("rejects pending, unlinked, mismatched, non-USD, and non-incoming records", () => {
    const rows = {
      ...data,
      income: [row({ id: "pending", status: "pending", amount_cents: 1_000 }), row({ id: "wrong", status: "paid", amount_cents: 999 })],
      gigs: [row({ id: "unpaid", stage: "Clearing", gross_cents: 1_000, fee_cents: 30 })],
      shifts: [row({ id: "foreign", pay_cents: 1_000, tips_cents: 0 })],
      sales: [row({ id: "outgoing", status: "paid", price_cents: 1_000, fee_cents: 30 })]
    } as unknown as typeof data;
    const totals = verifiedProfessionTotals(rows, [
      payment("income", "pending"), payment("income", "wrong"), payment("gigs", "unpaid"),
      { ...payment("shifts", "foreign"), currency: "EUR" },
      { ...payment("sales", "outgoing"), kind: "Payment Sent" },
      payment("income", "other-record")
    ], [{ amountCents: 500, verified: false }]);
    expect(totals).toEqual({ creator: 0, freelancer: 0, driver: 0, seller: 0, starter: 0 });
  });

  it("moves ranks at exact cent thresholds and chooses the strongest class", () => {
    expect([99, 100, 999, 1_000, 4_999, 5_000, 9_999, 10_000, 24_999, 25_000, 49_999, 50_000, 99_999, 100_000]
      .map(professionRank)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
    expect(professionClass({ creator: 10_000, freelancer: 10_000, driver: 20_000, seller: 0, starter: 1_000 }))
      .toMatchObject({ profession: "driver", rank: 4, verifiedCents: 20_000 });
  });
});
