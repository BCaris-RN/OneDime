import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { incoming, fixedSuggestion, type Activity } from "./activity.js";
import { NotFound, BadRequest, Conflict } from "../http/errors.js";
import { insertRow, ownRow, updateRow, validateRow, view } from "../ledger/store.js";
import type { TableKey, LedgerRow } from "../ledger/catalog.js";
import { claimEligibleRungs } from "../game/rungs.js";
export type Transaction = Activity & {
  id: string;
  player_id: string;
  routed_app: string | null;
  routed_record_type: string | null;
  routed_record_id: string | null;
};
export const routeSchema = z.strictObject({
  record_type: z.enum(["first", "income", "gigs", "shifts", "sales"]),
  platform: z.string().trim().min(1).max(120),
  record_id: z.uuid().optional()
});
export type Route = z.infer<typeof routeSchema>;
export const routeApps = {
  first: "first",
  income: "spotlight",
  gigs: "freelance",
  shifts: "market_delivery",
  sales: "market_selling"
} as const;
export async function transactions(prisma: Pick<PrismaClient, "$queryRaw">, playerId: string) {
  const rows = await prisma.$queryRaw<
    Record<string, unknown>[]
  >`SELECT * FROM paypal_transactions WHERE player_id=${playerId}::uuid ORDER BY occurred_on DESC, created_at DESC`;
  return rows.map((row) => view(row) as unknown as Transaction);
}
export function recordNet(type: string, row: LedgerRow) {
  const n = (key: string) => Number(row[key] ?? 0);
  return type === "first"
    ? n("amountCents")
    : type === "income"
      ? n("amount_cents")
      : type === "gigs"
        ? n("gross_cents") - n("fee_cents")
        : type === "shifts"
          ? n("pay_cents") + n("tips_cents")
          : n("price_cents") - n("fee_cents");
}
function newRecord(type: Route["record_type"], p: Transaction, platform: string) {
  if (type === "income")
    return {
      platform,
      stream_type: "Other",
      amount_cents: p.net_cents,
      earned_on: p.occurred_on,
      status: "paid",
      content_minutes: 0,
      note: ""
    };
  if (type === "gigs")
    return {
      platform,
      client: p.payer || "PayPal payer",
      project: "PayPal activity",
      pricing: "fixed",
      gross_cents: p.gross_cents,
      fee_cents: p.fee_cents,
      hours_x100: 0,
      started_on: p.occurred_on,
      stage: "Paid"
    };
  if (type === "shifts")
    return {
      platform,
      worked_on: p.occurred_on,
      pay_cents: p.net_cents,
      tips_cents: 0,
      minutes_online: 0,
      miles_x10: 0
    };
  return {
    store: platform,
    item: "PayPal activity",
    sold_on: p.occurred_on,
    price_cents: p.gross_cents,
    fee_cents: p.fee_cents,
    cost_cents: 0,
    ship_cents: 0,
    made_by: "Other",
    status: "paid"
  };
}
export async function routePayment(
  prisma: PrismaClient,
  playerId: string,
  id: string,
  input: Route
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM players WHERE id=${playerId}::uuid FOR UPDATE`;
    const found = await tx.$queryRaw<
      Transaction[]
    >`SELECT * FROM paypal_transactions WHERE id=${id}::uuid AND player_id=${playerId}::uuid FOR UPDATE`;
    if (!found[0]) throw new NotFound();
    const p = view(found[0]) as unknown as Transaction;
    if (!incoming(p)) throw new BadRequest("payment_not_routable");
    if (p.routed_record_id) {
      if (
        p.routed_record_type !== input.record_type ||
        (input.record_id && p.routed_record_id !== input.record_id)
      )
        throw new Conflict("payment_already_routed");
      return { transaction: p };
    }
    let row: LedgerRow;
    if (input.record_type === "first") {
      if (input.record_id) {
        const existing = await tx.logEntry.findFirst({ where: { id: input.record_id, playerId } });
        if (!existing) throw new NotFound();
        row = existing as unknown as LedgerRow;
      } else {
        row = (await tx.logEntry.create({
          data: {
            playerId,
            platform: z
              .enum(["Prolific", "Rev", "TranscribeMe", "SideShift", "Microworkers", "Other"])
              .parse(input.platform),
            amountCents: p.net_cents,
            minutes: 0,
            workedOn: new Date(`${p.occurred_on}T00:00:00Z`),
            verified: false
          }
        })) as unknown as LedgerRow;
      }
      const expected = fixedSuggestion(p.payer);
      if (expected?.platform === row.platform && recordNet("first", row) === p.net_cents) {
        await tx.logEntry.update({
          where: { id: row.id },
          data: { verified: true, verificationSource: "paypal_csv" }
        });
        await claimEligibleRungs(tx, playerId);
      }
    } else {
      const key = input.record_type as TableKey;
      if (input.record_id) {
        row = await ownRow(tx, key, playerId, input.record_id);
        const paid =
          input.record_type === "gigs"
            ? { stage: "Paid", paid_on: p.occurred_on }
            : input.record_type === "income"
              ? { status: "paid", paid_on: p.occurred_on }
              : input.record_type === "sales"
                ? { status: "paid" }
                : null;
        if (paid) row = await updateRow(tx, key, playerId, row.id, paid);
      } else {
        const data = validateRow(key, newRecord(input.record_type, p, input.platform));
        row = await insertRow(tx, key, playerId, {
          ...data,
          ...(["income", "gigs"].includes(key) ? { paid_on: p.occurred_on } : {})
        });
      }
    }
    const other = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM paypal_transactions WHERE player_id=${playerId}::uuid AND routed_record_type=${input.record_type} AND routed_record_id=${row.id}::uuid`;
    if (other.length) throw new Conflict("record_already_linked");
    await tx.$executeRaw`UPDATE paypal_transactions SET routed_app=${routeApps[input.record_type]}, routed_record_type=${input.record_type},routed_record_id=${row.id}::uuid WHERE id=${id}::uuid AND player_id=${playerId}::uuid`;
    return {
      transaction: {
        ...p,
        routed_app: routeApps[input.record_type],
        routed_record_type: input.record_type,
        routed_record_id: row.id
      },
      mismatch: recordNet(input.record_type, row) !== p.net_cents
    };
  });
}
