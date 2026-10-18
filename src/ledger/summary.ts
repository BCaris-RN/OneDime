import type { LedgerRow } from "./catalog.js";
export const numeric = (row: LedgerRow, key: string) => Number(row[key] ?? 0);
const sum = (rows: LedgerRow[], key: string) => rows.reduce((total, row) => total + numeric(row, key), 0);
const ratio = (cents: number, units: number, scale: number) => units ? Math.round(cents * scale / units) : null;
export function summary(app: string, data: { income: LedgerRow[]; deals: LedgerRow[]; expenses: LedgerRow[];
  gigs: LedgerRow[]; shifts: LedgerRow[]; sales: LedgerRow[] }, month: string, include: (day: string) => boolean = () => true) {
  const inMonth = (row: LedgerRow, field: string) => String(row[field] ?? "").startsWith(month) && include(String(row[field]));
  const expenses = sum(data.expenses.filter(row => row.app === app && inMonth(row, "spent_on")), "amount_cents");
  const rows = app === "spotlight" ? data.income : app === "freelance" ? data.gigs : app === "market_delivery" ? data.shifts : data.sales;
  const date = app === "spotlight" ? "earned_on" : app === "freelance" ? "started_on" : app === "market_delivery" ? "worked_on" : "sold_on";
  const monthly = rows.filter(row => inMonth(row, date));
  const amount = (row: LedgerRow) => app === "spotlight" ? numeric(row, "amount_cents") : app === "freelance" ? numeric(row, "gross_cents") : app === "market_delivery" ? numeric(row, "pay_cents") + numeric(row, "tips_cents") : numeric(row, "price_cents");
  const fees = (row: LedgerRow) => numeric(row, "fee_cents");
  const net = (row: LedgerRow) => amount(row) - fees(row) - numeric(row, "cost_cents") - numeric(row, "ship_cents");
  const total = (xs: LedgerRow[], f: (row: LedgerRow) => number) => xs.reduce((s, row) => s + f(row), 0);
  const isPaid = (row: LedgerRow) => app === "market_delivery" || row.status === "paid" || row.stage === "Paid";
  const earnedCents = total(monthly, amount);
  const feesCents = total(monthly, fees);
  const paid = rows.filter(row => isPaid(row) && inMonth(row, app === "spotlight" || app === "freelance" ? "paid_on" : date));
  const pending = rows.filter(row => !isPaid(row));
  const time = (row: LedgerRow) => numeric(row, app === "spotlight" ? "content_minutes" : app === "freelance" ? "hours_x100" : "minutes_online");
  const scale = app === "freelance" ? 100 : 60;
  const timed = (app === "freelance" ? rows.filter(isPaid) : monthly).filter(row => time(row) > 0);
  const byPlatform = [...new Set(rows.map(row => String(row.platform ?? row.store)))].map(platform => {
    const xs = rows.filter(row => (row.platform ?? row.store) === platform);
    const withTime = xs.filter(row => time(row) > 0);
    const revenueCents = total(xs, amount), profitCents = total(xs, net);
    return { platform, count: xs.length, earnedCents: revenueCents, paidCents: total(xs.filter(isPaid), amount),
      pendingCents: total(xs.filter(row => !isPaid(row)), row => amount(row) - fees(row)), feesCents: total(xs, fees),
      netCents: profitCents, perHourCents: ratio(total(withTime, app === "freelance" ? net : amount), total(withTime, time), scale),
      perMileCents: ratio(total(xs, amount), sum(xs, "miles_x10"), 10),
      marginPercent: revenueCents ? Math.round(profitCents * 100 / revenueCents) : null };
  });
  return { month, earnedCents, paidCents: total(paid, amount), paidNetCents: total(paid, row => amount(row) - fees(row)),
    pendingCents: total(pending, row => amount(row) - fees(row)), feesCents, expensesCents: expenses,
    netCents: total(monthly, net) - expenses, count: monthly.length,
    marginPercent: earnedCents ? Math.round(total(monthly, net) * 100 / earnedCents) : null,
    perHourCents: ratio(total(timed, app === "freelance" ? net : amount), total(timed, time), scale),
    perMileCents: ratio(earnedCents, sum(monthly, "miles_x10"), 10), milesX10: sum(monthly, "miles_x10"),
    tipsCents: sum(monthly, "tips_cents"),
    clearingCents: total(rows.filter(row => row.stage === "Clearing"), net),
    openCents: app === "spotlight" ? total(data.deals.filter(row => row.stage !== "Paid"), row => numeric(row, "amount_cents")) : total(rows.filter(row => ["In progress", "Delivered"].includes(String(row.stage))), net),
    paidFeesCents: total(paid, fees), byPlatform };
}
