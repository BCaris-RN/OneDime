import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { safeText, csv, xlsx, zip, type ExportSheet } from "../src/exports/files.js";
import { taxSummarySheet } from "../src/exports/tax-summary.js";
describe("file exports", () => {
  it.each(["=SUM(A1)", "+cmd", "-cmd", "@cmd", "\tcmd", "\rcmd", "\ncmd"])(
    "neutralizes spreadsheet text %j",
    (value) => {
      expect(safeText(value)).toBe(`'${value}`);
    }
  );
  it("quotes commas, quotes and newlines and preserves numeric USD amounts", () => {
    const result = csv({
      name: "demo",
      columns: ["note", "amount_cents"],
      rows: [{ note: 'say "hi",\nnext', amount_cents: 199 }]
    });
    expect(result).toContain('"say ""hi"",\nnext","1.99"');
    expect(result).toContain('"amount_usd"');
  });
  it("writes real numeric/date cells and a frozen header without formulas", async () => {
    const sheet: ExportSheet = {
      name: "Demo",
      columns: ["note", "amount_cents", "earned_on"],
      rows: [{ note: "=1+1", amount_cents: 199, earned_on: "2026-10-14" }]
    };
    const files = unzipSync(await xlsx([sheet]));
    const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain("1.99");
    expect(xml).not.toContain("<f>");
    expect(xml).toMatch(/r="C2"[^>]*>\s*<v>\d+/);
    const strings = strFromU8(files["xl/sharedStrings.xml"]);
    expect(strings).toContain("'=1+1");
  });
  it("exports header-only CSV and XLSX sheets for empty data and packages CSV files", async () => {
    const sheet: ExportSheet = { name: "Empty", columns: ["item", "amount_cents"], rows: [] };
    expect(csv(sheet)).toBe('"item","amount_usd"\r\n');
    const book = unzipSync(await xlsx([sheet]));
    expect(strFromU8(book["xl/worksheets/sheet1.xml"])).not.toContain('r="A2"');
    expect(strFromU8(unzipSync(zip([sheet]))["Empty.csv"])).toBe(csv(sheet));
  });
  it("places a sheet note above headers in CSV and XLSX exports", async () => {
    const sheet: ExportSheet = {
      name: "Tax summary",
      headerNote: "For your records. Not tax advice.",
      columns: ["year", "income_cents"],
      rows: [{ year: "2026", income_cents: 1234 }],
    };
    expect(csv(sheet)).toMatch(/^# For your records\. Not tax advice\.\r\n"year","income_usd"/);
    const workbook = unzipSync(await xlsx([sheet]));
    const shared = strFromU8(workbook["xl/sharedStrings.xml"]);
    expect(shared).toContain("For your records. Not tax advice.");
    expect(strFromU8(workbook["xl/worksheets/sheet1.xml"])).toContain('ySplit="2"');
  });
  it("maps monthly income, fees, expenses and delivery miles without currency floats", () => {
    const sheet = taxSummarySheet([
      { app: "spotlight", month: "2026-10", earned_cents: 199, fees_cents: 25, expenses_cents: 100 },
      { app: "market_delivery", month: "2026-10", earned_cents: 1199, fees_cents: 0, expenses_cents: 100 },
    ], month => month === "2026-10" ? 123 : 0);
    expect(sheet.name).toBe("Tax summary");
    expect(sheet.headerNote).toBe("For your records. Not tax advice.");
    expect(sheet.rows).toEqual([
      { year: "2026", month: "2026-10", app: "Spotlight", income_cents: 199, fees_cents: 25, expenses_cents: 100, delivery_miles_x10: 0 },
      { year: "2026", month: "2026-10", app: "Market delivery", income_cents: 1199, fees_cents: 0, expenses_cents: 100, delivery_miles_x10: 123 },
    ]);
    expect(sheet.rows.some(row => typeof row.income_cents === "number" && !Number.isInteger(row.income_cents))).toBe(false);
  });
});
