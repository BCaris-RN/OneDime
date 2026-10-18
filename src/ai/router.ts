/*  (o) OneDime | src/ai/router.ts
 *  ----------------------------------------------------------
 *  AI reads and suggests; the server owns budget, schema and routing.
 */
import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { AuthedRequest } from "../auth/session.js";
import { transactions } from "../paypal/routing.js";
import { incoming, fixedSuggestion } from "../paypal/activity.js";
import {
  MODEL,
  redactPayer,
  parseSuggestions,
  suggestionSchema,
  type AIClient,
  type Suggestion,
  anthropicClient
} from "./client.js";
type Cache = { payer_hash: string; state: string; payload: unknown; updated_at: Date };
const hash = (payer: string) =>
  createHash("sha256").update(payer.trim().toLowerCase()).digest("hex");
export function createAIRouter(
  prisma: PrismaClient,
  config: AppConfig,
  now: () => Date,
  injected?: AIClient
) {
  const router = Router();
  router.post("/paypal/suggestions", async (req: AuthedRequest, res) => {
    z.strictObject({}).parse(req.body);
    const playerId = req.currentSession!.player.id,
      model = config.anthropicModel ?? MODEL;
    const rows = (await transactions(prisma, playerId)).filter(
      (row) => incoming(row) && !row.routed_record_id
    );
    const results = new Map<
      string,
      { record_type: string; app: string; platform: string; confidence: number } | null
    >();
    for (const row of rows) results.set(row.id, fixedSuggestion(row.payer));
    const send = (status: string) =>
      res.json({
        status,
        suggestions: rows.map((row) => ({ id: row.id, suggestion: results.get(row.id) ?? null }))
      });
    if (model !== MODEL) return send("unsupported_model");
    if (!injected && !config.anthropicApiKey) return send("missing_key");
    const client = injected ?? anthropicClient(config.anthropicApiKey!);
    const candidates = [
      ...new Map(
        rows.filter((row) => !fixedSuggestion(row.payer)).map((row) => [hash(row.payer), row])
      ).entries()
    ];
    const caches = await prisma.$queryRaw<
      Cache[]
    >`SELECT payer_hash,state,payload,updated_at FROM ai_cache WHERE player_id=${playerId}::uuid AND model=${model}`;
    const fresh = (cache: Cache) =>
      now().getTime() - cache.updated_at.getTime() <
      (cache.state === "pending" ? 300000 : 30 * 86400000);
    const applyCache = (payerHash: string, payload: unknown) => {
      const parsed = suggestionSchema.safeParse(payload);
      const value = parsed.success && parsed.data.confidence >= 0.7 ? parsed.data : null;
      for (const row of rows)
        if (hash(row.payer) === payerHash && !fixedSuggestion(row.payer))
          results.set(row.id, value);
    };
    for (const cache of caches.filter(fresh))
      if (cache.state === "complete") applyCache(cache.payer_hash, cache.payload);
    const missing = candidates
      .filter(
        ([payerHash]) => !caches.some((cache) => cache.payer_hash === payerHash && fresh(cache))
      )
      .slice(0, 10);
    if (!missing.length)
      return send(
        caches.some((cache) => cache.state === "pending" && fresh(cache)) ? "pending" : "cached"
      );
    const requestId = randomUUID(),
      month = now().toISOString().slice(0, 7),
      budget = config.aiMonthlyBudgetCents ?? 100;
    // Two cents reserve more than the bounded text request plus 2,048 output tokens
    // at the checked Haiku 5.5 rate. Failures retain the reservation conservatively.
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id=${playerId}::uuid FOR UPDATE`;
      const current = await tx.$queryRaw<
        Cache[]
      >`SELECT payer_hash,state,payload,updated_at FROM ai_cache WHERE player_id=${playerId}::uuid AND model=${model}`;
      const pending = missing.filter(
        ([payerHash]) => !current.some((cache) => cache.payer_hash === payerHash && fresh(cache))
      );
      if (!pending.length) return { status: "pending", pending };
      await tx.$executeRaw`INSERT INTO ai_budget(month,reserved_cents) VALUES(${month},0) ON CONFLICT DO NOTHING`;
      const counters = await tx.$queryRaw<
        { reserved_cents: number }[]
      >`SELECT reserved_cents FROM ai_budget WHERE month=${month} FOR UPDATE`;
      if (counters[0].reserved_cents + 2 > budget) return { status: "budget_reached", pending: [] };
      await tx.$executeRaw`UPDATE ai_budget SET reserved_cents=reserved_cents+2 WHERE month=${month}`;
      await tx.$executeRaw`INSERT INTO ai_usage(request_id,player_id,month,reserved_cents,status) VALUES(${requestId}::uuid,${playerId}::uuid,${month},2,'reserved')`;
      for (const [payerHash] of pending)
        await tx.$executeRaw`INSERT INTO ai_cache(player_id,payer_hash,model,request_id,state,updated_at) VALUES(${playerId}::uuid,${payerHash},${model},${requestId}::uuid,'pending',${now()})
        ON CONFLICT(player_id,payer_hash,model) DO UPDATE SET request_id=EXCLUDED.request_id,state='pending',payload=NULL,updated_at=EXCLUDED.updated_at`;
      return { status: "reserved", pending };
    });
    if (reservation.status !== "reserved") return send(reservation.status);
    let suggestions: Suggestion[] = [],
      status = "complete",
      inputTokens = 0,
      outputTokens = 0;
    try {
      const result = await client.classify(
        reservation.pending.map(([, row]) => ({
          payer: redactPayer(row.payer),
          amount_cents: row.net_cents,
          kind: row.kind
        })),
        model
      );
      inputTokens = result.usage.input_tokens;
      outputTokens = result.usage.output_tokens;
      try {
        suggestions = parseSuggestions(result, reservation.pending.length);
      } catch {
        status = "invalid";
      }
    } catch {
      status = "failed";
    }
    await prisma.$transaction(async (tx) => {
      for (const [index, [payerHash]] of reservation.pending.entries()) {
        const found = suggestions.find((s) => s.index === index);
        const suggestion = found && found.confidence >= 0.7 ? found : null;
        await tx.$executeRaw(Prisma.sql`UPDATE ai_cache SET state='complete',payload=${JSON.stringify(suggestion)}::jsonb,updated_at=${now()}
          WHERE player_id=${playerId}::uuid AND payer_hash=${payerHash} AND model=${model} AND request_id=${requestId}::uuid`);
        applyCache(payerHash, suggestion);
      }
      const cost =
        status === "failed"
          ? 2
          : Math.min(2, Math.ceil((inputTokens * 10 + outputTokens * 50) / 1000000));
      await tx.$executeRaw`UPDATE ai_usage SET status=${status},cost_cents=${cost},input_tokens=${inputTokens},output_tokens=${outputTokens} WHERE request_id=${requestId}::uuid AND player_id=${playerId}::uuid`;
    });
    send(status);
  });
  return router;
}
