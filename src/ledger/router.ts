/*  (o) OneDime | src/ledger/router.ts
 *  ----------------------------------------------------------
 *  Owned workspace records; game progression stays in First Dime.
 */
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { localDay } from "../game/rules.js";
import { tables, type TableKey } from "./catalog.js";
import { identifier, insertRow, listRows, ownRow, stampPayment, updateRow, validateRow } from "./store.js";
import { summary } from "./summary.js";
import { NotFound } from "../http/errors.js";

export function createLedgerRouter(prisma: PrismaClient, now: () => Date) {
  const router = Router();
  const player = (req: AuthedRequest) => req.currentSession!.player;
  const today = (req: AuthedRequest) => localDay(now(), player(req).timeZone ?? "UTC");
  // Mounted after gameRouter so every route shares its session, JSON/origin guard and write limiter.
  for (const key of Object.keys(tables) as TableKey[]) {
    const config = tables[key];
    const paths = key === "expenses" ? ["/spotlight/expenses", "/freelance/expenses", "/market/expenses"] : [config.path];
    for (const path of paths) {
      const allowedExpense = (app: unknown) => path.startsWith("/market") ? String(app).startsWith("market_") : app === path.split("/")[1];
      router.get(path, async (req: AuthedRequest, res) => {
        const { id } = z.strictObject({ id: z.uuid().optional() }).parse(req.query);
        let rows = await listRows(prisma, key, player(req).id);
        if (key === "expenses") rows = rows.filter(row => allowedExpense(row.app));
        if (id) { rows = rows.filter(row => row.id === id); if (!rows.length) throw new NotFound(); }
        res.json({ rows });
      });
      router.post(path, async (req: AuthedRequest, res) => {
        const data = validateRow(key, req.body);
        if (key === "expenses" && !allowedExpense("app" in data ? data.app : null)) throw new NotFound();
        const row = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player(req).id}::uuid FOR UPDATE`;
          return stampPayment(tx, key, player(req).id, await insertRow(tx, key, player(req).id, data), today(req));
        });
        res.status(201).json({ row });
      });
      router.patch(`${path}/:id`, async (req: AuthedRequest, res) => {
        const id = z.uuid().parse(req.params.id);
        const patch = config.schema.partial().parse(req.body);
        const row = await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player(req).id}::uuid FOR UPDATE`;
          const existing = await ownRow(tx, key, player(req).id, id);
          if (key === "expenses" && !allowedExpense(existing.app)) throw new NotFound();
          const input = Object.fromEntries(Object.keys(config.schema.shape).map(field => [field, existing[field]]));
          const data = validateRow(key, { ...input, ...patch });
          if (key === "expenses" && !allowedExpense("app" in data ? data.app : null)) throw new NotFound();
          return stampPayment(tx, key, player(req).id, await updateRow(tx, key, player(req).id, id, data), today(req));
        });
        res.json({ row });
      });
      router.delete(`${path}/:id`, async (req: AuthedRequest, res) => {
        const id = z.uuid().parse(req.params.id);
        z.strictObject({}).parse(req.body);
        await prisma.$transaction(async tx => {
          const row = await ownRow(tx, key, player(req).id, id);
          if (key === "expenses" && !allowedExpense(row.app)) throw new NotFound();
          await tx.$executeRaw(Prisma.sql`DELETE FROM ${identifier(config.table)} WHERE id = ${id}::uuid AND player_id = ${player(req).id}::uuid`);
        });
        res.status(204).end();
      });
    }
  }
  for (const app of ["spotlight", "freelance", "market"] as const) {
    router.get(`/${app}/summary`, async (req: AuthedRequest, res) => {
      const query = z.strictObject({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).parse(req.query);
      const data = await allRows(prisma, player(req).id);
      const month = query.month ?? today(req).slice(0, 7);
      res.json(app === "market" ? { delivery: summary("market_delivery", data, month), selling: summary("market_selling", data, month) } : summary(app, data, month));
    });
  }
  return router;
}
export async function allRows(prisma: PrismaClient, playerId: string) {
  const [income, deals, expenses, gigs, shifts, sales] = await Promise.all((Object.keys(tables) as TableKey[]).map(key => listRows(prisma, key, playerId)));
  return { income, deals, expenses, gigs, shifts, sales };
}
