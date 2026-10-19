/*  (o) OneDime | src/settings/router.ts
 *  ----------------------------------------------------------
 *  Owned player preferences behind the shared write guards.
 */
import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { AuthedRequest } from "../auth/session.js";
import { z } from "zod";
export function createSettingsRouter(prisma: PrismaClient) {
  const router = Router();
  router.get("/settings", (req: AuthedRequest, res) => {
    res.json({ smartSuggestions: req.currentSession!.player.smartSuggestions });
  });
  router.patch("/settings", async (req: AuthedRequest, res) => {
    const data = z.strictObject({ smartSuggestions: z.boolean() }).parse(req.body);
    await prisma.player.update({ where: { id: req.currentSession!.player.id }, data });
    res.json(data);
  });
  return router;
}
