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
  // PostgreSQL INSERT ... ON CONFLICT DO NOTHING handles the global race without
  // aborting the losing transaction. The rung_cents primary key picks one winner.
  await tx.rungClaim.createMany({
    data: eligible.map((rungCents) => ({ rungCents, playerId })), skipDuplicates: true
  });
}
