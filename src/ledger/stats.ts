/*  (o) OneDime | src/ledger/stats.ts
 *  ----------------------------------------------------------
 *  Player-scoped, read-only data for the Stats screen.
 */
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { localDay } from "../game/rules.js";
import { professionView, verifiedProfessionTotals } from "../game/professions.js";
import { incoming, fixedSuggestion } from "../paypal/activity.js";
import { allRows } from "./router.js";
import { firstDimeTotals } from "./first-totals.js";
import { summary, numeric } from "./summary.js";
import { transactions } from "../paypal/routing.js";

const dayOf = (row: Record<string, unknown>, key: string) => String(row[key] ?? "").slice(0, 10);

export function createStatsRouter(prisma: PrismaClient, now: () => Date) {
  const router = Router();
  router.get("/stats", async (req: AuthedRequest, res) => {
    const query = z.strictObject({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).parse(req.query);
    const player = req.currentSession!.player;
    const month = query.month ?? localDay(now(), player.timeZone ?? "UTC").slice(0, 7);
    const result = await prisma.$transaction(async tx => {
      const [data, entries, payments] = await Promise.all([
        allRows(tx, player.id),
        tx.logEntry.findMany({ where: { playerId: player.id }, orderBy: { workedOn: "asc" } }),
        transactions(tx, player.id)
      ]);
      const monthList: string[] = [];
      const [year, m] = month.split("-").map(Number);
      for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(year!, m! - 1 - i, 1)); monthList.push(d.toISOString().slice(0, 7)); }
      const monthly = monthList.map(mm => {
        const first = firstDimeTotals(entries, payments, mm);
        return {
          month: mm,
          first: first.netCents,
          spotlight: summary("spotlight", data, mm).netCents,
          freelance: summary("freelance", data, mm).netCents,
          market: summary("market_delivery", data, mm).netCents + summary("market_selling", data, mm).netCents
        };
      });
      const allDates = new Set<string>();
      const dated: { date: string; cents: number; rateCents: number; verifiedCents: number; minutesX100: number; platform: string; app: string }[] = [];
      for (const entry of entries) {
        const date = entry.workedOn.toISOString().slice(0, 10); allDates.add(date);
        const payment = payments.find(p => p.routed_record_type === "first" && p.routed_record_id === entry.id);
        const verified = entry.verified && payment && incoming(payment) && fixedSuggestion(payment.payer)?.platform === entry.platform && [payment.gross_cents, payment.net_cents].includes(entry.amountCents);
        const cents = entry.amountCents;
        dated.push({ date, cents, rateCents: entry.amountCents, verifiedCents: verified ? cents : 0, minutesX100: entry.minutes * 100, platform: entry.platform, app: "first" });
      }
      const descriptors = [
        { rows: data.income, app: "spotlight", date: "earned_on", amount: "amount_cents", minutes: "content_minutes", platform: "platform", type: "income", paid: (r: Record<string, unknown>) => r.status === "paid" },
        { rows: data.gigs, app: "freelance", date: "started_on", amount: "gross_cents", minutes: "hours_x100", platform: "platform", type: "gigs", paid: (r: Record<string, unknown>) => r.stage === "Paid" },
        { rows: data.shifts, app: "market", date: "worked_on", amount: "pay_cents", minutes: "minutes_online", platform: "platform", type: "shifts", paid: () => true },
        { rows: data.sales, app: "market", date: "sold_on", amount: "price_cents", minutes: "", platform: "store", type: "sales", paid: (r: Record<string, unknown>) => r.status === "paid" }
      ];
      for (const desc of descriptors) for (const row of desc.rows) {
        const date = dayOf(row, desc.date); if (!date) continue; allDates.add(date);
        const payment = payments.find(p => p.routed_record_type === desc.type && p.routed_record_id === row.id);
        const amount = numeric(row, desc.amount);
        const matchingAmounts = desc.type === "shifts" ? [amount + numeric(row, "tips_cents")] : desc.type === "gigs" || desc.type === "sales" ? [amount, amount - numeric(row, "fee_cents")] : [amount];
        const verified = desc.paid(row) && payment && incoming(payment) && matchingAmounts.some(value => value === payment.gross_cents || value === payment.net_cents);
        const minutesX100 = desc.minutes === "hours_x100" ? numeric(row, desc.minutes) * 60 : desc.minutes ? numeric(row, desc.minutes) * 100 : 0;
        const matchedAmount = payment && matchingAmounts.find(value => value === payment.gross_cents || value === payment.net_cents);
        const cents = desc.type === "shifts" ? amount + numeric(row, "tips_cents") : amount;
        const rateCents = desc.type === "gigs" ? cents - numeric(row, "fee_cents") : cents;
        dated.push({ date, cents, rateCents, verifiedCents: verified ? matchedAmount! : 0, minutesX100, platform: String(row[desc.platform] ?? "Other"), app: desc.app });
      }
      const current = dated.filter(x => x.date.startsWith(month));
      const earnedCents = current.reduce((s, x) => s + x.cents, 0);
      const verifiedCents = current.reduce((s, x) => s + x.verifiedCents, 0);
      const rates = new Map<string, { cents: number; minutesX100: number }>();
      for (const item of dated.filter(x => x.minutesX100 > 0)) {
        const rate = rates.get(item.platform) ?? { cents: 0, minutesX100: 0 };
        rate.cents += item.rateCents; rate.minutesX100 += item.minutesX100; rates.set(item.platform, rate);
      }
      const hourly = [...rates].map(([platform, r]) => ({ platform, centsPerHour: Math.round(r.cents * 6000 / r.minutesX100) })).sort((a, b) => b.centsPerHour - a.centsPerHour).slice(0, 8);
      const today = localDay(now(), player.timeZone ?? "UTC");
      let streak = 0; const cursor = new Date(`${allDates.has(today) ? today : new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)}T00:00:00Z`);
      while (allDates.has(cursor.toISOString().slice(0, 10))) { streak++; cursor.setUTCDate(cursor.getUTCDate() - 1); }
      const activeDays = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${today}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10)).filter(d => allDates.has(d)).length;
      const first = firstDimeTotals(entries, payments, month);
      const overviewRows = [
        { app: "first", ...first },
        ...["spotlight", "freelance", "market_delivery", "market_selling"].map(app => { const s = summary(app, data, month); return { app, earnedCents: s.earnedCents, paidCents: s.paidNetCents, pendingCents: s.pendingCents, netCents: s.netCents }; })
      ];
      const overviewTotal = overviewRows.reduce((s, row) => s + row.earnedCents, 0);
      const professions = professionView(verifiedProfessionTotals(data, payments, entries));
      return { month, earnedCents: overviewTotal, verifiedCents, activeDays, streak, hourly, monthly, professions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json(result);
  });
  return router;
}
