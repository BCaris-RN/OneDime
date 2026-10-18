import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { tables, type TableKey, type LedgerRow } from "./catalog.js";
import { BadRequest, NotFound } from "../http/errors.js";

export type Db = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;
export function identifier(value: string) {
  return Prisma.raw(`"${value}"`);
}
export function view(row: Record<string, unknown>): LedgerRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString().slice(0, key.endsWith("_on") ? 10 : 24) : value
    ])
  ) as LedgerRow;
}
export async function listRows(db: Db, key: TableKey, playerId: string) {
  const rows = await db.$queryRaw<
    Record<string, unknown>[]
  >(Prisma.sql`SELECT * FROM ${identifier(tables[key].table)}
    WHERE player_id = ${playerId}::uuid ORDER BY created_at DESC, id`);
  return rows.map(view);
}
export async function ownRow(db: Db, key: TableKey, playerId: string, id: string) {
  const rows = await db.$queryRaw<
    Record<string, unknown>[]
  >(Prisma.sql`SELECT * FROM ${identifier(tables[key].table)}
    WHERE player_id = ${playerId}::uuid AND id = ${id}::uuid FOR UPDATE`);
  if (!rows[0]) throw new NotFound();
  return view(rows[0]);
}
function valueSql(key: string, value: unknown) {
  if (key === "id" || key.endsWith("_id")) return Prisma.sql`${value}::uuid`;
  if (key.endsWith("_on")) return Prisma.sql`${value}::date`;
  return Prisma.sql`${value}`;
}
export async function insertRow(
  db: Db,
  key: TableKey,
  playerId: string,
  data: Record<string, unknown>
) {
  const values = { id: randomUUID(), player_id: playerId, ...data };
  const rows = await db.$queryRaw<
    Record<string, unknown>[]
  >(Prisma.sql`INSERT INTO ${identifier(tables[key].table)}
    (${Prisma.join(Object.keys(values).map(identifier))}) VALUES
    (${Prisma.join(Object.entries(values).map(([field, value]) => valueSql(field, value)))}) RETURNING *`);
  return view(rows[0]);
}
export async function updateRow(
  db: Db,
  key: TableKey,
  playerId: string,
  id: string,
  data: Record<string, unknown>
) {
  const rows = await db.$queryRaw<
    Record<string, unknown>[]
  >(Prisma.sql`UPDATE ${identifier(tables[key].table)} SET
    ${Prisma.join(Object.entries(data).map(([field, value]) => Prisma.sql`${identifier(field)} = ${valueSql(field, value)}`))}
    WHERE id = ${id}::uuid AND player_id = ${playerId}::uuid RETURNING *`);
  if (!rows[0]) throw new NotFound();
  return view(rows[0]);
}
export function validateRow(key: TableKey, data: unknown) {
  const parsed = tables[key].schema.parse(data);
  if ("fee_cents" in parsed && "gross_cents" in parsed && parsed.fee_cents > parsed.gross_cents) {
    throw new BadRequest("fee_exceeds_gross");
  }
  return parsed;
}
export async function stampPayment(
  db: Db,
  key: TableKey,
  playerId: string,
  row: LedgerRow,
  today: string
) {
  if (key === "income" || key === "gigs") {
    const paid = key === "income" ? row.status === "paid" : row.stage === "Paid";
    row = await updateRow(db, key, playerId, row.id, {
      paid_on: paid ? (row.paid_on ?? today) : null
    });
  }
  if (key === "deals" && row.stage === "Paid") {
    const linked = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM creator_income WHERE brand_deal_id = ${row.id}::uuid`
    );
    if (!linked.length)
      await insertRow(db, "income", playerId, {
        platform: row.platform,
        stream_type: "Brand deal",
        amount_cents: row.amount_cents,
        earned_on: today,
        status: "paid",
        paid_on: today,
        content_minutes: 0,
        note: `Brand deal: ${row.brand}`.slice(0, 120),
        brand_deal_id: row.id
      });
  }
  return row;
}
