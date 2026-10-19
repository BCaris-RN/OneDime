/*  (o) OneDime | src/exports/router.ts
 *  ----------------------------------------------------------
 *  A consistent owned snapshot for file exports and monthly totals.
 */
import { Router } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.js";
import { localDay } from "../game/rules.js";
import { transactions } from "../paypal/routing.js";
import { allRows } from "../ledger/router.js";
import { tables, type TableKey } from "../ledger/catalog.js";
import { summary } from "../ledger/summary.js";
import { BadRequest } from "../http/errors.js";
import {
  combine,
  csv,
  xlsx,
  zip,
  type ExportSheet,
  type ExportRow,
} from "./files.js";

const querySchema = z.strictObject({
  tab: z.enum(["first", "spotlight", "freelance", "market", "all"]),
  format: z.enum(["csv", "xlsx", "zip"]),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export function createExportRouter(prisma: PrismaClient, now: () => Date) {
  const router = Router();
  const buckets = new Map<string, { count: number; until: number }>();
  router.get("/exports", async (req: AuthedRequest, res) => {
    const query = querySchema.parse(req.query);
    if (
      (query.month && (query.from || query.to)) ||
      (query.from && query.to && query.from > query.to) ||
      (query.tab === "all" && query.format === "csv") ||
      (query.tab !== "all" && query.format === "zip")
    )
      throw new BadRequest();
    const player = req.currentSession!.player;
    const time = now().getTime();
    for (const [id, bucket] of buckets)
      if (bucket.until <= time) buckets.delete(id);
    const bucket = buckets.get(player.id) ?? { count: 0, until: time + 60_000 };
    if (bucket.count >= 6) {
      res
        .set("Retry-After", String(Math.ceil((bucket.until - time) / 1000)))
        .status(429)
        .json({ error: "export_rate_limited" });
      return;
    }
    bucket.count++;
    buckets.set(player.id, bucket);
    const inRange = (day: string) =>
      (!query.month || day.startsWith(query.month)) &&
      (!query.from || day >= query.from) &&
      (!query.to || day <= query.to);
    const sheets = await prisma.$transaction(
      async (tx) => {
        const data = await allRows(tx, player.id);
        const entries = await tx.logEntry.findMany({
          where: { playerId: player.id },
          orderBy: { workedOn: "asc" },
        });
        const first: ExportSheet = {
          name: "first_dime",
          columns: [
            "id",
            "platform",
            "worked_on",
            "amount_cents",
            "minutes",
            "verified",
            "note",
          ],
          rows: entries.map((row) => ({
            id: row.id,
            platform: row.platform,
            worked_on: row.workedOn.toISOString().slice(0, 10),
            amount_cents: row.amountCents,
            minutes: row.minutes,
            verified: row.verified,
            note: row.note,
          })),
        };
        const all: ExportSheet[] = [first];
        for (const key of Object.keys(tables) as TableKey[]) {
          const config = tables[key];
          const columns = [
            "id",
            ...Object.keys(config.schema.shape),
            ...(["income", "gigs"].includes(key) ? ["paid_on"] : []),
          ];
          const rows = data[key]
            .filter((row) => {
              const day = String(row[config.date] ?? "");
              // Include payments in range even when the work started earlier.
              return (
                (day && inRange(day)) ||
                (row.paid_on && inRange(String(row.paid_on))) ||
                (!query.month && !query.from && !query.to)
              );
            })
            .map(
              (row) =>
                Object.fromEntries(
                  columns.map((col) => [col, row[col] ?? null]),
                ) as ExportRow,
            );
          all.push({ name: config.table, columns, rows });
        }
        const months = new Set<string>();
        for (const sheet of [
          first,
          ...Object.keys(tables).map((key) => ({
            rows: data[key as TableKey],
          })),
        ]) {
          for (const row of sheet.rows)
            for (const [field, value] of Object.entries(row))
              if (
                field.endsWith("_on") &&
                typeof value === "string" &&
                inRange(value)
              )
                months.add(value.slice(0, 7));
        }
        if (query.month) months.add(query.month);
        const totals: ExportRow[] = [];
        for (const month of [...months].sort()) {
          const logged = first.rows.filter(
            (row) =>
              String(row.worked_on).startsWith(month) &&
              inRange(String(row.worked_on)),
          );
          const earned = logged.reduce(
              (s, row) => s + Number(row.amount_cents),
              0,
            ),
            paid = logged
              .filter((row) => row.verified)
              .reduce((s, row) => s + Number(row.amount_cents), 0);
          totals.push({
            app: "first",
            month,
            earned_cents: earned,
            paid_cents: paid,
            pending_cents: earned - paid,
            fees_cents: 0,
            expenses_cents: 0,
            net_cents: earned,
          });
          for (const app of [
            "spotlight",
            "freelance",
            "market_delivery",
            "market_selling",
          ]) {
            const value = summary(app, data, month, inRange);
            const rows =
              app === "spotlight"
                ? data.income
                : app === "freelance"
                  ? data.gigs
                  : app === "market_delivery"
                    ? data.shifts
                    : data.sales;
            const date =
              app === "spotlight"
                ? "earned_on"
                : app === "freelance"
                  ? "started_on"
                  : app === "market_delivery"
                    ? "worked_on"
                    : "sold_on";
            const pending = rows
              .filter(
                (row) =>
                  String(row[date]).startsWith(month) &&
                  inRange(String(row[date])) &&
                  row.status !== "paid" &&
                  row.stage !== "Paid",
              )
              .reduce(
                (sum, row) =>
                  sum +
                  Number(
                    row.amount_cents ?? row.gross_cents ?? row.price_cents ?? 0,
                  ) -
                  Number(row.fee_cents ?? 0),
                0,
              );
            totals.push({
              app,
              month,
              earned_cents: value.earnedCents,
              paid_cents: value.paidCents,
              pending_cents: pending,
              fees_cents: value.feesCents,
              expenses_cents: value.expensesCents,
              net_cents: value.netCents,
            });
          }
        }
        const summarySheet: ExportSheet = {
          name: "Summary",
          columns: [
            "app",
            "month",
            "earned_cents",
            "paid_cents",
            "pending_cents",
            "fees_cents",
            "expenses_cents",
            "net_cents",
          ],
          rows: totals,
        };
        first.rows = first.rows.filter((row) => inRange(String(row.worked_on)));
        if (query.tab === "all") {
          const columns = [
            "txn_id",
            "occurred_on",
            "payer",
            "gross_cents",
            "fee_cents",
            "net_cents",
            "currency",
            "kind",
            "routed_app",
            "routed_record_type",
            "routed_record_id",
          ];
          const payments = await transactions(tx, player.id);
          const payouts = await tx.payout.findMany({
            where: { playerId: player.id },
          });
          const quests = await tx.questProgress.findMany({
            where: { playerId: player.id },
          });
          const claims = await tx.rungClaim.findMany({
            where: { playerId: player.id },
          });
          return [
            summarySheet,
            ...all,
            {
              name: "paypal_transactions",
              columns,
              rows: payments
                .filter((row) => inRange(row.occurred_on))
                .map((row) =>
                  Object.fromEntries(
                    columns.map((key) => [
                      key,
                      (row as unknown as ExportRow)[key] ?? null,
                    ]),
                  ),
                ),
            },
            {
              name: "payouts",
              columns: [
                "rung_cents",
                "amount_cents",
                "status",
                  "batch_status",
                "sender_batch_id",
                "paypal_batch_id",
                "created_on",
              ],
              rows: payouts
                .filter((row) =>
                  inRange(localDay(row.createdAt, player.timeZone ?? "UTC")),
                )
                .map((row) => ({
                  rung_cents: row.rungCents,
                  amount_cents: row.amountCents,
                  status: row.status,
                    batch_status: row.batchStatus,
                  sender_batch_id: row.senderBatchId,
                  paypal_batch_id: row.paypalBatchId,
                  created_on: localDay(row.createdAt, player.timeZone ?? "UTC"),
                })),
            },
            {
              name: "quests",
              columns: ["quest_id", "completed_on"],
              rows: quests
                .filter((row) =>
                  inRange(localDay(row.completedAt, player.timeZone ?? "UTC")),
                )
                .map((row) => ({
                  quest_id: row.questId,
                  completed_on: localDay(
                    row.completedAt,
                    player.timeZone ?? "UTC",
                  ),
                })),
            },
            {
              name: "rung_claims",
              columns: ["rung_cents", "claimed_on"],
              rows: claims
                .filter((row) =>
                  inRange(localDay(row.claimedAt, player.timeZone ?? "UTC")),
                )
                .map((row) => ({
                  rung_cents: row.rungCents,
                  claimed_on: localDay(row.claimedAt, player.timeZone ?? "UTC"),
                })),
            },
          ];
        }
        if (query.tab === "first") return [first];
        const expenses = all.find((sheet) => sheet.name === "expenses")!;
        if (query.tab === "market")
          return [
            combine("Delivery", [
              all.find((sheet) => sheet.name === "delivery_shifts")!,
              {
                ...expenses,
                rows: expenses.rows.filter(
                  (row) => row.app === "market_delivery",
                ),
              },
            ]),
            combine("Selling", [
              all.find((sheet) => sheet.name === "sales")!,
              {
                ...expenses,
                rows: expenses.rows.filter(
                  (row) => row.app === "market_selling",
                ),
              },
            ]),
          ];
        return all
          .filter((sheet) =>
            query.tab === "spotlight"
              ? ["creator_income", "brand_deals", "expenses"].includes(
                  sheet.name,
                )
              : ["freelance_gigs", "expenses"].includes(sheet.name),
          )
          .map((sheet) =>
            sheet.name === "expenses"
              ? {
                  ...sheet,
                  rows: sheet.rows.filter((row) => row.app === query.tab),
                }
              : sheet,
          );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const body =
      query.format === "xlsx"
        ? await xlsx(sheets)
        : query.format === "zip"
          ? zip(sheets)
          : csv(combine(query.tab, sheets));
    const filename = `onedime-${query.tab}-${localDay(now(), player.timeZone ?? "UTC")}.${query.format}`;
    res
      .set({
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Content-Type":
          query.format === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : query.format === "zip"
              ? "application/zip"
              : "text/csv; charset=utf-8",
      })
      .send(body);
  });
  return router;
}
