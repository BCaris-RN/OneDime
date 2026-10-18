/*  (o) OneDime | src/paypal/activity.ts
 *  ----------------------------------------------------------
 *  Parse only approved activity columns; discard the source file.
 */
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { BadRequest } from "../http/errors.js";
export type Activity = {
  txn_id: string;
  occurred_on: string;
  payer: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  currency: string;
  kind: string;
};
const headers: Record<string, string> = {
  date: "date",
  name: "payer",
  payer: "payer",
  gross: "gross",
  fee: "fee",
  net: "net",
  currency: "currency",
  "transaction id": "txn_id",
  type: "kind"
};
function amount(value: string) {
  const clean = value.replaceAll(",", "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) throw new BadRequest("invalid_csv_amount");
  const negative = clean.startsWith("-"),
    [whole, fraction = ""] = clean.replace("-", "").split(".");
  const cents =
    Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 1_000_000)
    throw new BadRequest("invalid_csv_amount");
  return cents;
}
function date(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return z.iso
    .date()
    .parse(match ? `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}` : value);
}
export function parseActivity(csv: string): Activity[] {
  try {
    const rows = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 8192,
      columns: (columns: string[]) => {
        const mapped = columns.map((column) =>
          Object.hasOwn(headers, column.trim().toLowerCase())
            ? headers[column.trim().toLowerCase()]
            : false
        );
        const kept = mapped.filter(Boolean);
        if (new Set(kept).size !== kept.length || kept.length !== 8)
          throw new BadRequest("invalid_csv_headers");
        return mapped;
      }
    }) as Record<string, string>[];
    if (rows.length > 1000) throw new BadRequest("csv_too_many_rows");
    const text = z.string().max(120);
    return rows.map((row) => ({
      txn_id: text.min(1).parse(row.txn_id),
      occurred_on: date(row.date.trim()),
      payer: text.parse(row.payer),
      gross_cents: amount(row.gross),
      fee_cents: Math.abs(amount(row.fee)),
      net_cents: amount(row.net),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .parse(row.currency.trim().toUpperCase()),
      kind: text.parse(row.kind)
    }));
  } catch (error) {
    if (error instanceof BadRequest) throw error;
    throw new BadRequest("invalid_activity_csv");
  }
}
export function incoming(
  row: Pick<Activity, "currency" | "gross_cents" | "net_cents" | "kind" | "fee_cents">
) {
  return (
    row.currency === "USD" &&
    row.gross_cents > 0 &&
    row.net_cents >= 0 &&
    row.net_cents === row.gross_cents - row.fee_cents &&
    /^(payment received|general payment|mass pay payment|express checkout payment|website payment|mobile payment|marketplace payment)$/i.test(
      row.kind.trim()
    )
  );
}
export function fixedSuggestion(payer: string) {
  const map: Record<string, string> = {
    hyperwallet: "Prolific",
    prolific: "Prolific",
    "prolific academic ltd": "Prolific",
    rev: "Rev",
    "rev.com": "Rev",
    transcribeme: "TranscribeMe",
    sideshift: "SideShift",
    microworkers: "Microworkers"
  };
  const normalized = payer.trim().toLowerCase();
  const platform = Object.hasOwn(map, normalized) ? map[normalized] : undefined;
  return platform ? { record_type: "first" as const, app: "first", platform, confidence: 1 } : null;
}
