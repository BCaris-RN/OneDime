/*  (o) OneDime | src/game/professions.ts
 *  ----------------------------------------------------------
 *  Verified per-workspace totals and permanent profession rank claims.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { incoming } from "../paypal/activity.js";
import { allRows } from "../ledger/router.js";
import type { LedgerRow } from "../ledger/catalog.js";

export const RANK_THRESHOLDS_CENTS = [100, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000] as const;

export type Profession = "creator" | "freelancer" | "driver" | "seller" | "starter";
export type ProfessionTotals = Record<Profession, number>;

type Payment = {
  routed_record_type: string | null;
  routed_record_id: string | null;
  currency: string;
  gross_cents: number;
  fee_cents: number;
  net_cents: number;
  kind: string;
};

const emptyTotals = (): ProfessionTotals => ({ creator: 0, freelancer: 0, driver: 0, seller: 0, starter: 0 });
const value = (row: LedgerRow, field: string) => Number(row[field] ?? 0);

function matchedAmount(row: LedgerRow, type: string, payment: Payment | undefined, amounts: number[]) {
  if (!payment || payment.routed_record_type !== type || payment.routed_record_id !== row.id || !incoming(payment)) return 0;
  return amounts.find(amount => amount === payment.gross_cents || amount === payment.net_cents) ?? 0;
}

export function verifiedProfessionTotals(
  data: Awaited<ReturnType<typeof allRows>>,
  payments: readonly Payment[],
  starterEntries: readonly { amountCents: number; verified: boolean }[]
): ProfessionTotals {
  const totals = emptyTotals();
  const paymentFor = (type: string, id: string) => payments.find(payment =>
    payment.routed_record_type === type && payment.routed_record_id === id);

  for (const row of data.income) {
    if (row.status === "paid") totals.creator += matchedAmount(row, "income", paymentFor("income", row.id), [value(row, "amount_cents")]);
  }
  for (const row of data.gigs) {
    const gross = value(row, "gross_cents");
    if (row.stage === "Paid") totals.freelancer += matchedAmount(row, "gigs", paymentFor("gigs", row.id), [gross, gross - value(row, "fee_cents")]);
  }
  for (const row of data.shifts) {
    const amount = value(row, "pay_cents") + value(row, "tips_cents");
    totals.driver += matchedAmount(row, "shifts", paymentFor("shifts", row.id), [amount]);
  }
  for (const row of data.sales) {
    const price = value(row, "price_cents");
    if (row.status === "paid") totals.seller += matchedAmount(row, "sales", paymentFor("sales", row.id), [price, price - value(row, "fee_cents")]);
  }
  totals.starter = starterEntries.reduce((sum, entry) => sum + (entry.verified ? entry.amountCents : 0), 0);
  return totals;
}

export function professionRank(verifiedCents: number) {
  return RANK_THRESHOLDS_CENTS.filter(threshold => threshold <= verifiedCents).length;
}

type RankClaim = { profession: string; rank: number };

export function professionView(totals: ProfessionTotals, claims: readonly RankClaim[] = []) {
  return (Object.entries(totals) as [Profession, number][]).map(([profession, verifiedCents]) => {
    const savedRank = claims.reduce((rank, claim) => claim.profession === profession ? Math.max(rank, claim.rank) : rank, 0);
    const rank = Math.max(savedRank, professionRank(verifiedCents));
    return { profession, rank, verifiedCents, nextRankCents: RANK_THRESHOLDS_CENTS[rank] ?? null };
  });
}

export function professionClass(totals: ProfessionTotals, claims: readonly RankClaim[] = []) {
  const rows = professionView(totals, claims).filter(row => row.rank > 0);
  rows.sort((a, b) => b.rank - a.rank || b.verifiedCents - a.verifiedCents || a.profession.localeCompare(b.profession));
  return rows[0] ?? null;
}

export async function syncProfessionRankClaims(tx: Prisma.TransactionClient, playerId: string) {
  const [data, entries, rawPayments] = await Promise.all([
    allRows(tx, playerId),
    tx.logEntry.findMany({ where: { playerId }, select: { amountCents: true, verified: true } }),
    tx.$queryRaw<Record<string, unknown>[]>`
      SELECT routed_record_type, routed_record_id, currency, gross_cents, fee_cents, net_cents, kind
      FROM paypal_transactions WHERE player_id = ${playerId}::uuid
    `
  ]);
  const totals = verifiedProfessionTotals(data, rawPayments as Payment[], entries);
  const professions = ["creator", "freelancer", "driver", "seller"] as const;
  const claims = professions.flatMap(profession => RANK_THRESHOLDS_CENTS
    .map((threshold, index) => ({ threshold, rank: index + 1 }))
    .filter(item => totals[profession] >= item.threshold)
    .map(item => ({ playerId, profession, rank: item.rank })));
  if (claims.length) await tx.professionRankClaim.createMany({ data: claims, skipDuplicates: true });
}

export async function loadProfessionTotals(prisma: PrismaClient, playerId: string, starterEntries: readonly { amountCents: number; verified: boolean }[]) {
  const [data, rawPayments] = await Promise.all([
    allRows(prisma, playerId),
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT routed_record_type, routed_record_id, currency, gross_cents, fee_cents, net_cents, kind
      FROM paypal_transactions WHERE player_id = ${playerId}::uuid
    `
  ]);
  return verifiedProfessionTotals(data, rawPayments as Payment[], starterEntries);
}
