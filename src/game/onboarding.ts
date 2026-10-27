import type { Prisma } from "@prisma/client";

export async function markStartRecordComplete(tx: Prisma.TransactionClient, playerId: string) {
  await tx.questProgress.upsert({
    where: { playerId_questId: { playerId, questId: "start-record" } },
    create: { playerId, questId: "start-record" },
    update: {}
  });
}
