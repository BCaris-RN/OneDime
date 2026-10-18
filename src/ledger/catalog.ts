/*  (o) OneDime | src/ledger/catalog.ts
 *  ----------------------------------------------------------
 *  Schemas and fixed SQL identifiers for income workspaces.
 */
import { z } from "zod";

import { creatorPlatforms, freelancePlatforms, deliveryPlatforms, stores, dealStages, gigStages, streamTypes, apps } from "./options.js";
const cents = z.number().int().min(0).max(1_000_000);
const text = z.string().trim().max(120);
const date = z.iso.date();
const status = z.enum(["pending", "paid"]);
const income = z.strictObject({ platform: z.enum(creatorPlatforms), stream_type: z.enum(streamTypes), amount_cents: cents,
  earned_on: date, status, content_minutes: z.number().int().min(0).max(1440), note: text });
const deal = z.strictObject({ brand: text.min(1), platform: z.enum(creatorPlatforms), amount_cents: cents,
  due_on: date.nullable(), deliverables: text, stage: z.enum(dealStages) });
const expense = z.strictObject({ app: z.enum(apps), item: text.min(1), amount_cents: cents, spent_on: date });
const gig = z.strictObject({ platform: z.enum(freelancePlatforms), client: text.min(1), project: text.min(1),
  pricing: z.enum(["fixed", "hourly"]), gross_cents: cents, fee_cents: cents,
  hours_x100: z.number().int().min(0).max(2400), started_on: date, stage: z.enum(gigStages) });
const shift = z.strictObject({ platform: z.enum(deliveryPlatforms), worked_on: date, pay_cents: cents, tips_cents: cents,
  minutes_online: z.number().int().min(0).max(1440), miles_x10: z.number().int().min(0).max(20000) });
const sale = z.strictObject({ store: z.enum(stores), item: text.min(1), sold_on: date, price_cents: cents,
  fee_cents: cents, cost_cents: cents, ship_cents: cents,
  made_by: z.enum(["Own stock", "Printify", "Ninja Transfers", "Other"]), status });

export const tables = {
  income: { table: "creator_income", path: "/spotlight/income", schema: income, date: "earned_on", app: "spotlight" },
  deals: { table: "brand_deals", path: "/spotlight/deals", schema: deal, date: "due_on", app: "spotlight" },
  expenses: { table: "expenses", path: "/expenses", schema: expense, date: "spent_on", app: "spotlight" },
  gigs: { table: "freelance_gigs", path: "/freelance/gigs", schema: gig, date: "started_on", app: "freelance" },
  shifts: { table: "delivery_shifts", path: "/market/shifts", schema: shift, date: "worked_on", app: "market_delivery" },
  sales: { table: "sales", path: "/market/sales", schema: sale, date: "sold_on", app: "market_selling" }
} as const;
export type TableKey = keyof typeof tables;
export type LedgerRow = Record<string, string | number | null> & { id: string; player_id: string };

// Audience -> Spotlight; client skills -> Freelance; driving/goods -> Market.
// Everything else (including SideShift) -> First Dime. Count a payment once.
// Printify and Ninja Transfers supply items; Printify Shop is a buyer-facing store.
