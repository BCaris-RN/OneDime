import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { safeText, csv, xlsx, zip, type ExportSheet } from "../src/exports/files.js";
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
});
