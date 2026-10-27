import type { ExportRow, ExportSheet } from "./files.js";

const labels: Record<string, string> = {
  first: "First Dime",
  spotlight: "Spotlight",
  freelance: "Freelance",
  market_delivery: "Market delivery",
  market_selling: "Market selling",
};

export function taxSummarySheet(
  totals: readonly ExportRow[],
  deliveryMilesForMonth: (month: string) => number,
): ExportSheet {
  return {
    name: "Tax summary",
    headerNote: "For your records. Not tax advice.",
    columns: [
      "year",
      "month",
      "app",
      "income_cents",
      "fees_cents",
      "expenses_cents",
      "delivery_miles_x10",
    ],
    rows: totals.map((row) => {
      const month = String(row.month ?? "");
      const app = String(row.app ?? "");
      return {
        year: month.slice(0, 4),
        month,
        app: labels[app] ?? app,
        income_cents: Number(row.earned_cents ?? 0),
        fees_cents: Number(row.fees_cents ?? 0),
        expenses_cents: Number(row.expenses_cents ?? 0),
        delivery_miles_x10: app === "market_delivery" ? deliveryMilesForMonth(month) : 0,
      };
    }),
  };
}
