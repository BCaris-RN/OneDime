/*  (o) OneDime | src/settings/router.ts
 *  ----------------------------------------------------------
 *  Owned player preferences behind the shared write guards.
 */
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth/session.js";
import { z } from "zod";
import type { SessionStore } from "../auth/session.js";
export function createSettingsRouter(prisma: PrismaClient, sessions: SessionStore) {
  const router = Router();
  router.get("/settings", (req: AuthedRequest, res) => {
    res.json({ smartSuggestions: req.currentSession!.player.smartSuggestions });
  });
  router.patch("/settings", async (req: AuthedRequest, res) => {
    const data = z.strictObject({ smartSuggestions: z.boolean() }).parse(req.body);
    await prisma.player.update({ where: { id: req.currentSession!.player.id }, data });
    res.json(data);
  });
  router.delete("/settings/data", async (req: AuthedRequest, res) => {
    z.strictObject({ confirmation: z.literal("DELETE MY DATA") }).parse(req.body);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM players WHERE id=${req.currentSession!.player.id}::uuid FOR UPDATE`;
      await tx.player.delete({ where: { id: req.currentSession!.player.id } });
    });
    await sessions.destroySession(req,res);
    res.status(204).end();
  });
  return router;
}
