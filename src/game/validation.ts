import { z } from "zod";

export const emptyBody = z.strictObject({});
export const idSchema = z.uuid();
export const platformSchema = z.string().trim().min(1).max(80);
export const timeZoneSchema = z.string().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; }
  catch { return false; }
}, "Use a valid IANA time zone.");
export const entrySchema = z.strictObject({
  platform: platformSchema,
  amountCents: z.number().int().min(0).max(1_000_000),
  minutes: z.number().int().min(0).max(2_147_483_647),
  workedOn: z.iso.date(),
  note: z.string().trim().max(2000).optional()
});
