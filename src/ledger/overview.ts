/*  (o) OneDime | src/ledger/overview.ts
 *  ----------------------------------------------------------
 *  Owned monthly ledger totals; imported payments are not counted twice.
 */
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { localDay } from "../game/rules.js";
import { allRows } from "./router.js";
import { summary } from "./summary.js";
import { firstDimeTotals } from "./first-totals.js";
import { transactions } from "../paypal/routing.js";
export function createOverviewRouter(prisma: PrismaClient, now: () => Date) {
  const router = Router();
  router.get("/overview", async (req: AuthedRequest, res) => {
    const query = z.strictObject({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).parse(req.query);
    const player = req.currentSession!.player;
    const month = query.month ?? localDay(now(), player.timeZone ?? "UTC").slice(0, 7);
    const rows = await prisma.$transaction(async tx => {
      const data = await allRows(tx, player.id);
      const entries = await tx.logEntry.findMany({ where: { playerId: player.id } });
      const result = [{ app: "first", ...firstDimeTotals(entries, await transactions(tx,player.id), month) }];
      for (const app of ["spotlight","freelance","market_delivery","market_selling"]) {
        const value = summary(app,data,month);
        const records = app === "spotlight" ? data.income : app === "freelance" ? data.gigs : app === "market_delivery" ? data.shifts : data.sales;
        const date = app === "spotlight" ? "earned_on" : app === "freelance" ? "started_on" : app === "market_delivery" ? "worked_on" : "sold_on";
        const pendingCents = app === "market_delivery" ? 0 : records.filter(row => String(row[date]).startsWith(month) && row.status !== "paid" && row.stage !== "Paid")
          .reduce((sum,row) => sum + Number(row.amount_cents ?? row.gross_cents ?? row.price_cents ?? 0) - Number(row.fee_cents ?? 0), 0);
        result.push({ app, earnedCents: value.earnedCents, paidCents: value.paidNetCents, pendingCents,
          feesCents: value.feesCents, expensesCents: value.expensesCents, netCents: value.netCents });
      }
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const total = { app: "total", earnedCents:0, paidCents:0, pendingCents:0, feesCents:0, expensesCents:0, netCents:0 };
    for (const row of rows) for (const key of ["earnedCents","paidCents","pendingCents","feesCents","expensesCents","netCents"] as const) total[key] += row[key];
    res.json({ month, rows: [...rows,total] });
  });
  return router;
}
