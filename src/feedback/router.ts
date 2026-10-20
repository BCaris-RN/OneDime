/*  (o) OneDime | src/feedback/router.ts
 *  ----------------------------------------------------------
 *  Private player feedback behind the shared session and write guards.
 */
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { HttpError } from "../http/errors.js";

const feedbackSchema = z.strictObject({
  app: z.enum(["first", "spotlight", "freelance", "market", "paypal"]),
  body: z.string().trim().min(1).max(1000).refine(value => !value.includes("\0")),
  blocking: z.boolean().default(false),
});
const hourMs = 60 * 60 * 1000;

export function createFeedbackRouter(prisma: PrismaClient, now: () => Date) {
  const router = Router();
  router.post("/feedback", async (req: AuthedRequest, res) => {
    const data = feedbackSchema.parse(req.body);
    const playerId = req.currentSession!.player.id;
    const timestamp = now();
    const retryAfter = await prisma.$transaction(async tx => {
      // The player lock keeps concurrent requests and separate servers within the same limit.
      const players = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM players WHERE id=${playerId}::uuid FOR UPDATE`;
      if (!players.length) throw new HttpError(401, "unauthenticated");
      const recent = await tx.feedback.findMany({
        where: { playerId, createdAt: { gt: new Date(timestamp.getTime() - hourMs) } },
        select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 5,
      });
      if (recent.length >= 5) {
        return Math.max(1, Math.ceil((recent[0].createdAt.getTime() + hourMs - timestamp.getTime()) / 1000));
      }
      await tx.feedback.create({ data: { ...data, playerId, createdAt: timestamp } });
      return null;
    });
    if (retryAfter !== null) {
      res.set("Retry-After", String(retryAfter)).status(429).json({ error: "feedback_rate_limited" });
      return;
    }
    res.status(201).json({ ok: true });
  });
  return router;
}
