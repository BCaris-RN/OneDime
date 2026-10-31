/*  (o) OneDime | src/game/rungs.ts
 *  ----------------------------------------------------------
 *  Per-player matched rung claims and their disabled-by-default payout outbox.
 */
import type { Prisma } from "@prisma/client";
import { RUNGS } from "./rules.js";

// Internal service for trusted verification code. There is deliberately no HTTP
// endpoint that accepts verified=true, claim IDs, or an earnings total.
// Call inside the same transaction that changes verified earnings.
export async function claimEligibleRungs(tx: Prisma.TransactionClient, playerId: string) {
  await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
  const total = await tx.logEntry.aggregate({
    where: { playerId, verified: true }, _sum: { amountCents: true }
  });
  const eligible = RUNGS.filter((rung) => rung <= (total._sum.amountCents ?? 0));
  if (!eligible.length) return;
  // The player row lock makes repeated/concurrent claims for one player idempotent.
  // The composite key lets every player keep the same rung claim.
  await tx.rungClaim.createMany({
    data: eligible.map((rungCents) => ({ rungCents, playerId })), skipDuplicates: true
  });
  const claims = await tx.rungClaim.findMany({ where: { playerId } });
  await tx.payout.createMany({ data: claims.map(({ rungCents }) => ({
    playerId, rungCents, senderBatchId: `${playerId}:${rungCents}`,
    amountCents: Math.max(10, Math.floor(rungCents / 10)), status: "ready"
  })), skipDuplicates: true });
}
