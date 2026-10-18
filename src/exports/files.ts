/*  (o) OneDime | src/exports/files.ts
 *  ----------------------------------------------------------
 *  Portable exports; untrusted strings never become formulas.
 */
import writeXlsxFile, { type Cell } from "write-excel-file/node";
import { zipSync, strToU8 } from "fflate";
export type ExportRow = Record<string, string | number | boolean | null>;
export type ExportSheet = { name: string; columns: string[]; rows: ExportRow[] };
export function safeText(value: string) { return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value; }
function rawValue(key: string, value: ExportRow[string]) {
  if (value === null || value === undefined) return "";
  if (key.endsWith("_cents") && typeof value === "number") return (value / 100).toFixed(2);
  return typeof value === "string" ? safeText(value) : String(value);
}
export function csv(sheet: ExportSheet) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [sheet.columns.map(key => quote(key.replace(/_cents$/, "_usd"))).join(","), ...sheet.rows.map(row => sheet.columns.map(key => quote(rawValue(key, row[key]))).join(","))].join("\r\n") + "\r\n";
}
export function combine(name: string, sheets: ExportSheet[]): ExportSheet {
  return { name, columns: ["record_type", ...new Set(sheets.flatMap(sheet => sheet.columns))],
    rows: sheets.flatMap(sheet => sheet.rows.map(row => ({ record_type: sheet.name, ...row }))) };
}
export async function xlsx(sheets: ExportSheet[]) {
  return writeXlsxFile(sheets.map(sheet => ({ sheet: sheet.name, stickyRowsCount: 1,
    columns: sheet.columns.map(() => ({ width: 22 })),
    data: [sheet.columns.map(value => ({ value: value.replace(/_cents$/, "_usd"), fontWeight: "bold" as const })),
      ...sheet.rows.map(row => sheet.columns.map((key): Cell => {
        const value = row[key];
        if (value === null || value === undefined) return null;
        if (typeof value === "number") return { type: Number, value: key.endsWith("_cents") ? value / 100 : value,
          ...(key.endsWith("_cents") ? { format: "0.00" } : {}) };
        if (typeof value === "boolean") return { type: Boolean, value };
        if (key.endsWith("_on") && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { type: Date, value: new Date(`${value}T00:00:00Z`), format: "yyyy-mm-dd" };
        return { type: String, value: safeText(value) };
      }))] }))).toBuffer();
}
export function zip(sheets: ExportSheet[]) {
  return Buffer.from(zipSync(Object.fromEntries(sheets.map(sheet => [`${sheet.name}.csv`, strToU8(csv(sheet))]))));
}
