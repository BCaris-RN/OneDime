/*  (o) OneDime | src/paypal/webhooks.ts
 *  ----------------------------------------------------------
 *  Only verified, deduplicated provider events update payout state.
 */
import type { RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { PayoutClient } from "./payouts.js";
const eventSchema = z.object({
  id: z.string().min(1).max(120),
  event_type: z.string().min(1).max(120),
  resource: z.record(z.string(), z.unknown())
});
const statuses: Record<string, string> = {
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "SUCCESS",
  "PAYMENT.PAYOUTS-ITEM.FAILED": "FAILED",
  "PAYMENT.PAYOUTS-ITEM.DENIED": "DENIED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED": "RETURNED",
  "PAYMENT.PAYOUTS-ITEM.REFUNDED": "REFUNDED",
  "PAYMENT.PAYOUTS-ITEM.CANCELED": "CANCELED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "UNCLAIMED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": "BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.HELD": "HELD"
};
const batchStatuses: Record<string, string> = {
  "PAYMENT.PAYOUTSBATCH.SUCCESS": "SUCCESS",
  "PAYMENT.PAYOUTSBATCH.DENIED": "DENIED",
  "PAYMENT.PAYOUTSBATCH.PROCESSING": "PROCESSING"
};
export function webhookHandler(
  prisma: PrismaClient,
  config: AppConfig,
  client: PayoutClient
): RequestHandler {
  let windowUntil = 0;
  let received = 0;
  return async (req, res) => {
    if (!config.payoutsEnabled) {
      res.status(503).json({ error: "payouts_disabled" });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: "json_required" });
      return;
    }
    if (Date.now() >= windowUntil) {
      windowUntil = Date.now() + 60_000;
      received = 0;
    }
    if (++received > 100) {
      res.set("Retry-After", "60").status(429).json({ error: "webhook_rate_limited" });
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    );
    let valid = false;
    try {
      valid = await client.verify(headers, req.body);
    } catch {
      res.status(503).json({ error: "signature_verification_unavailable" });
      return;
    }
    if (!valid) {
      res.status(401).json({ error: "invalid_webhook_signature" });
      return;
    }
    const event = eventSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const inserted =
        await tx.$executeRaw`INSERT INTO webhook_events(event_id,event_type) VALUES(${event.id},${event.event_type}) ON CONFLICT DO NOTHING`;
      if (!inserted) return;
      const header = event.resource.batch_header as { payout_batch_id?: unknown } | undefined;
      const batchId = z
        .string()
        .max(120)
        .safeParse(event.resource.payout_batch_id ?? header?.payout_batch_id);
      const status = Object.hasOwn(statuses, event.event_type) ? statuses[event.event_type] : null;
      const batchStatus = Object.hasOwn(batchStatuses, event.event_type) ? batchStatuses[event.event_type] : null;
      if (!batchId.success || (!status && !batchStatus)) return;
      const terminal = ["SUCCESS", "DENIED", "FAILED", "CANCELED", "RETURNED", "REFUNDED", "BLOCKED"];
      const sender = z
        .string()
        .max(256)
        .safeParse(
          (header as { sender_batch_header?: { sender_batch_id?: unknown } } | undefined)
            ?.sender_batch_header?.sender_batch_id
        );
      const item = z
        .uuid()
        .safeParse(
          (event.resource.payout_item as { sender_item_id?: unknown } | undefined)?.sender_item_id
        );
      const target = {
          OR: [
            { paypalBatchId: batchId.data },
            ...(sender.success ? [{ senderBatchId: sender.data }] : []),
            ...(item.success ? [{ id: item.data }] : [])
          ]
      };
      if (batchStatus) {
        await tx.payout.updateMany({
          where: { AND: [target, { OR: [{ batchStatus: null }, { batchStatus: { notIn: ["SUCCESS", "DENIED", "CANCELED"] } }] }] },
          data: { batchStatus, paypalBatchId: batchId.data }
        });
        return;
      }
      await tx.payout.updateMany({
        where: {
          ...target,
          ...(["RETURNED", "REFUNDED"].includes(status!) ? {} : { status: { notIn: terminal } })
        },
        data: { status: status!, paypalBatchId: batchId.data }
      });
    });
    res.status(200).json({ ok: true });
  };
}
