import { describe, expect, it } from "vitest";
import { summary } from "../src/ledger/summary.js";
import type { LedgerRow } from "../src/ledger/catalog.js";
const row = (data: Record<string, string | number | null>): LedgerRow => ({
  id: "fixture",
  player_id: "fixture-player",
  ...data
});
const empty = () =>
  ({ income: [], deals: [], expenses: [], gigs: [], shifts: [], sales: [] }) as {
    [key: string]: LedgerRow[];
  } & Parameters<typeof summary>[1];
describe("workspace calculations", () => {
  it("subtracts fees, supplier cost and shipping and calculates store margin", () => {
    const data = empty();
    data.sales = [
      row({
        store: "Printify Shop",
        sold_on: "2026-10-14",
        price_cents: 2000,
        fee_cents: 100,
        cost_cents: 700,
        ship_cents: 200,
        status: "paid"
      })
    ];
    data.expenses = [row({ app: "market_selling", spent_on: "2026-10-14", amount_cents: 50 })];
    const result = summary("market_selling", data, "2026-10");
    expect(result).toMatchObject({
      earnedCents: 2000,
      feesCents: 100,
      netCents: 950,
      marginPercent: 50
    });
    expect(result.byPlatform[0]).toMatchObject({ netCents: 1000, marginPercent: 50 });
  });
  it("uses net freelance pay and only timed gigs for hourly rates", () => {
    const data = empty();
    data.gigs = [
      row({
        platform: "Upwork",
        started_on: "2026-09-01",
        paid_on: "2026-10-14",
        gross_cents: 10000,
        fee_cents: 1000,
        hours_x100: 125,
        stage: "Paid"
      }),
      row({
        platform: "Upwork",
        started_on: "2026-10-14",
        gross_cents: 50000,
        fee_cents: 5000,
        hours_x100: 0,
        stage: "Clearing"
      })
    ];
    const result = summary("freelance", data, "2026-10");
    expect(result).toMatchObject({
      paidNetCents: 9000,
      paidFeesCents: 1000,
      clearingCents: 45000,
      perHourCents: 7200
    });
    expect(result.byPlatform[0].perHourCents).toBe(7200);
  });
  it("calculates delivery pay plus tips per hour and per mile using scaled integers", () => {
    const data = empty();
    data.shifts = [
      row({
        platform: "Uber",
        worked_on: "2026-10-14",
        pay_cents: 900,
        tips_cents: 100,
        minutes_online: 75,
        miles_x10: 125
      })
    ];
    expect(summary("market_delivery", data, "2026-10")).toMatchObject({
      earnedCents: 1000,
      perHourCents: 800,
      perMileCents: 80
    });
  });
  it("keeps pending payouts global while filtering earned income and expenses by month", () => {
    const data = empty();
    data.income = [
      row({
        platform: "YouTube",
        earned_on: "2026-10-31",
        amount_cents: 199,
        status: "pending",
        content_minutes: 60
      }),
      row({
        platform: "YouTube",
        earned_on: "2026-11-01",
        amount_cents: 1000,
        status: "pending",
        content_minutes: 0
      })
    ];
    expect(summary("spotlight", data, "2026-10")).toMatchObject({
      earnedCents: 199,
      pendingCents: 1199,
      perHourCents: 199
    });
    expect(summary("spotlight", empty(), "2026-10").perHourCents).toBeNull();
  });
});
