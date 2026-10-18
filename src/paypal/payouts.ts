/*  (o) OneDime | src/paypal/payouts.ts
 *  ----------------------------------------------------------
 *  Persisted sandbox outbox; retry keys never change.
 */
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../config.js";
export type PayoutRequest = {
  sender_batch_header: { sender_batch_id: string; email_subject: string };
  items: {
    recipient_type: "EMAIL";
    receiver: string;
    amount: { value: string; currency: "USD" };
    sender_item_id: string;
  }[];
};
export type PayoutClient = {
  create(body: PayoutRequest): Promise<{ id: string; status: string }>;
  verify(headers: Record<string, string>, event: unknown): Promise<boolean>;
};
export function createPayoutService(
  prisma: PrismaClient,
  config: AppConfig,
  client: PayoutClient,
  now: () => Date
) {
  return async (playerId: string) => {
    if (!config.payoutsEnabled) return;
    const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });

    const rows = await prisma.payout.findMany({
      where: { playerId, status: { in: ["ready", "retry", "sending"] } }
    });
    for (const row of rows) {
      if (!row.senderBatchId || row.amountCents === null) continue;
      const email = z
        .email()
        .max(127)
        .safeParse(row.recipientEmail ?? player.email);
      if (!email.success) continue;
      const started = now();
      if (row.firstAttemptAt && started.getTime() - row.firstAttemptAt.getTime() >= 29 * 86400000) {
        await prisma.payout.update({ where: { id: row.id }, data: { status: "manual_review" } });
        continue;
      }
      const acquired = await prisma.payout.updateMany({
        where: {
          id: row.id,
          OR: [
            { status: { in: ["ready", "retry"] } },
            { status: "sending", lastAttemptAt: { lt: new Date(started.getTime() - 300000) } }
          ]
        },
        data: {
          recipientEmail: email.data,
          status: "sending",
          attemptStartedAt: started,
          lastAttemptAt: started,
          firstAttemptAt: row.firstAttemptAt ?? started
        }
      });
      if (!acquired.count) continue;
      try {
        const result = await client.create({
          sender_batch_header: {
            sender_batch_id: row.senderBatchId,
            email_subject: "OneDime sandbox milestone bonus"
          },
          items: [
            {
              recipient_type: "EMAIL",
              receiver: email.data,
              amount: { value: (row.amountCents / 100).toFixed(2), currency: "USD" },
              sender_item_id: row.id
            }
          ]
        });
        // A verified webhook can arrive before the create response; preserve its terminal result.
        await prisma.payout.updateMany({
          where: { id: row.id, status: "sending" },
          data: { paypalBatchId: result.id, status: result.status }
        });
      } catch {
        await prisma.payout.updateMany({
          where: { id: row.id, status: "sending" },
          data: { status: "retry" }
        });
      }
    }
  };
}
