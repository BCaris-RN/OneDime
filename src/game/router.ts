/*  (o) OneDime | src/game/router.ts
 *  ----------------------------------------------------------
 *  Player-owned game progress, profession ranks and leaderboard.
 */
import { Router, type RequestHandler } from "express";
import type { LogEntry, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { SessionStore, type AuthedRequest } from "../auth/session.js";
import { QUESTS, PILOT_AVAILABLE, TITLES, type QuestDefinition } from "./catalog.js";
import { gameStats, localDay } from "./rules.js";
import { claimEligibleRungs } from "./rungs.js";
import { loadProfessionTotals, professionClass, professionView } from "./professions.js";
import { markStartRecordComplete } from "./onboarding.js";
import { emptyBody, entrySchema, idSchema, platformSchema, timeZoneSchema } from "./validation.js";

type Options = {
  prisma: PrismaClient; config: AppConfig; sessions: SessionStore;
  now?: () => Date; quests?: readonly QuestDefinition[];
  writeLimit?: { count: number; windowMs: number };
};

function entryView(entry: LogEntry) {
  return { ...entry, workedOn: entry.workedOn.toISOString().slice(0, 10) };
}

export function createGameRouter(options: Options) {
  const { prisma, config, sessions } = options;
  const now = options.now ?? (() => new Date());
  const quests = options.quests ?? QUESTS;
  const router = Router();
  const writes = new Map<string, { count: number; resets: number }>();
  const limit = options.writeLimit ?? { count: 60, windowMs: 60_000 };
  const player = (request: AuthedRequest) => request.currentSession!.player;

  router.use(async (request: AuthedRequest, response, next) => {
    const currentSession = await sessions.getCurrentSession(request);
    if (!currentSession) { response.status(401).json({ error: "unauthenticated" }); return; }
    request.currentSession = currentSession;
    response.set("Cache-Control", "no-store");
    next();
  });
  const writeGuard: RequestHandler = (request: AuthedRequest, response, next) => {
    if (!request.is("application/json")) { response.status(415).json({ error: "json_required" }); return; }
    if (request.get("Origin") !== new URL(config.publicBaseUrl).origin ||
        request.get("Sec-Fetch-Site") === "cross-site") {
      response.status(403).json({ error: "same_origin_required" }); return;
    }
    const timestamp = now().getTime();
    for (const [key, item] of writes) if (item.resets <= timestamp) writes.delete(key);
    const id = player(request).id;
    const bucket = writes.get(id) ?? { count: 0, resets: timestamp + limit.windowMs };
    if (bucket.count >= limit.count) {
      response.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resets - timestamp) / 1000))));
      response.status(429).json({ error: "write_rate_limited" }); return;
    }
    bucket.count++;
    writes.set(id, bucket);
    next();
  };
  router.use((request, response, next) => {
    if (["POST", "DELETE", "PATCH", "PUT"].includes(request.method)) return writeGuard(request, response, next);
    next();
  });

  router.post("/logout", async (request, response) => {
    emptyBody.parse(request.body);
    await sessions.destroySession(request, response);
    response.status(204).end();
  });

  const onboardingApps = ["first", "spotlight", "freelance", "market"] as const;
  const onboardingInput = z.strictObject({
    workTypes: z.array(z.enum(onboardingApps)).max(onboardingApps.length)
      .refine((items) => new Set(items).size === items.length)
  });
  router.get("/onboarding", (request: AuthedRequest, response) => {
    const current = player(request);
    response.json({ complete: current.welcomeCompletedAt !== null });
  });
  router.post("/onboarding", async (request: AuthedRequest, response) => {
    const { workTypes } = onboardingInput.parse(request.body);
    const playerId = player(request).id;
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
      return tx.player.updateMany({
        where: { id: playerId, welcomeCompletedAt: null },
        data: { welcomeCompletedAt: now() }
      });
    });
    response.json({ complete: true, workTypes: result.count ? workTypes : [] });
  });

  router.get("/entries", async (request: AuthedRequest, response) => {
    const query = z.strictObject({ id: idSchema.optional() }).parse(request.query);
    const entries = await prisma.logEntry.findMany({
      where: { playerId: player(request).id, ...(query.id ? { id: query.id } : {}) },
      orderBy: [{ workedOn: "desc" }, { createdAt: "desc" }]
    });
    if (query.id && !entries.length) { response.status(404).json({ error: "entry_not_found" }); return; }
    response.json({ entries: entries.map(entryView) });
  });

  router.post("/entries", async (request: AuthedRequest, response) => {
    const data = entrySchema.parse(request.body);
    const currentPlayer = player(request);
    if (data.workedOn > localDay(now(), currentPlayer.timeZone ?? "UTC")) {
      response.status(400).json({ error: "future_date" }); return;
    }
    const entry = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${currentPlayer.id}::uuid FOR UPDATE`;
      const row = await tx.logEntry.create({ data: {
        ...data, workedOn: new Date(`${data.workedOn}T00:00:00Z`),
        playerId: currentPlayer.id, verified: false
      } });
      if (quests.some((quest) => quest.id === "start-record"))
        await markStartRecordComplete(tx, currentPlayer.id);
      await claimEligibleRungs(tx, currentPlayer.id);
      return row;
    });
    response.status(201).json({ entry: entryView(entry) });
  });

  const deleteEntry: RequestHandler = async (request: AuthedRequest, response) => {
    const id = request.params.id
      ? (emptyBody.parse(request.body), idSchema.parse(request.params.id))
      : z.strictObject({ id: idSchema }).parse(request.body).id;
    const result = await prisma.logEntry.deleteMany({ where: { id, playerId: player(request).id } });
    if (!result.count) { response.status(404).json({ error: "entry_not_found" }); return; }
    response.status(204).end();
  };
  router.delete("/entries", deleteEntry);
  router.delete("/entries/:id", deleteEntry);

  router.post("/me/time-zone", async (request: AuthedRequest, response) => {
    const { timeZone } = z.strictObject({ timeZone: timeZoneSchema }).parse(request.body);
    await prisma.player.update({ where: { id: player(request).id }, data: { timeZone } });
    response.json({ timeZone });
  });

  router.get("/clock", (request: AuthedRequest, response) => {
    const currentPlayer = player(request);
    response.json({ platform: currentPlayer.clockPlatform, startedAt: currentPlayer.clockStartedAt });
  });
  router.post("/clock/in", async (request: AuthedRequest, response) => {
    const { platform } = z.strictObject({ platform: platformSchema }).parse(request.body);
    const startedAt = now();
    const result = await prisma.player.updateMany({
      where: { id: player(request).id, clockStartedAt: null },
      data: { clockPlatform: platform, clockStartedAt: startedAt }
    });
    if (!result.count) { response.status(409).json({ error: "already_clocked_in" }); return; }
    response.json({ platform, startedAt });
  });
  router.post("/clock/out", async (request: AuthedRequest, response) => {
    emptyBody.parse(request.body);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${player(request).id}::uuid FOR UPDATE`;
      const current = await tx.player.findUniqueOrThrow({ where: { id: player(request).id } });
      if (!current.clockStartedAt) return null;
      const endedAt = now();
      const minutes = Math.max(0, Math.floor((endedAt.getTime() - current.clockStartedAt.getTime()) / 60_000));
      await tx.player.update({
        where: { id: current.id }, data: { clockStartedAt: null, clockPlatform: null }
      });
      return { platform: current.clockPlatform, minutes, workedOn: localDay(endedAt, current.timeZone ?? "UTC") };
    });
    if (!result) { response.status(409).json({ error: "not_clocked_in" }); return; }
    response.json(result);
  });

  async function statsFor(id: string, timeZone: string) {
    const [entries, progress, claimedRungs, claims] = await Promise.all([
      prisma.logEntry.findMany({ where: { playerId: id } }),
      prisma.questProgress.findMany({ where: { playerId: id } }),
      prisma.rungClaim.count({ where: { playerId: id } }),
      prisma.professionRankClaim.findMany({ where: { playerId: id }, select: { profession: true, rank: true } })
    ]);
    const questXp = progress.reduce((xp, item) => xp + (quests.find((quest) => quest.id === item.questId)?.xp ?? 0), 0);
    const totals = await loadProfessionTotals(prisma, id, entries);
    const verifiedOtherCents = totals.creator + totals.freelancer + totals.driver + totals.seller;
    const stats = gameStats(entries, {
      now: now(), timeZone, questXp, claimedRungs, verifiedOtherCents,
      claimedProfessionRanks: claims.length
    });
    return {
      ...stats, professions: professionView(totals, claims), professionClass: professionClass(totals, claims),
      professionRankClaims: claims.length, verifiedOtherCents
    };
  }
  router.get("/me/stats", async (request: AuthedRequest, response) => {
    response.json(await statsFor(player(request).id, player(request).timeZone ?? "UTC"));
  });
  router.get("/quests", async (request: AuthedRequest, response) => {
    const progress = await prisma.questProgress.findMany({ where: { playerId: player(request).id } });
    response.json({ quests, completed: progress.map((item) => item.questId), pilotAvailable: PILOT_AVAILABLE, titles: TITLES });
  });
  router.post("/quests/:id", async (request: AuthedRequest, response) => {
    emptyBody.parse(request.body);
    const id = z.string().min(1).max(80).parse(request.params.id);
    if (!quests.some((quest) => quest.id === id)) {
      response.status(quests.length ? 404 : 503).json({ error: quests.length ? "quest_not_found" : "quest_catalog_unavailable" }); return;
    }
    const playerId = player(request).id;
    const completed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
      const removed = await tx.questProgress.deleteMany({ where: { playerId, questId: id } });
      if (removed.count) return false;
      await tx.questProgress.create({ data: { playerId, questId: id } });
      return true;
    });
    response.json({ id, completed });
  });
  for (const [action, leaderboardOptIn] of [["join", true], ["leave", false]] as const) {
    router.post(`/leaderboard/${action}`, async (request: AuthedRequest, response) => {
      emptyBody.parse(request.body);
      const playerId = player(request).id;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM players WHERE id = ${playerId}::uuid FOR UPDATE`;
        await tx.player.update({ where: { id: playerId }, data: { leaderboardOptIn } });
        if (leaderboardOptIn && quests.some((quest) => quest.id === "lb-join")) {
          await tx.questProgress.upsert({
            where: { playerId_questId: { playerId, questId: "lb-join" } },
            create: { playerId, questId: "lb-join" }, update: {}
          });
        }
      });
      response.json({ leaderboardOptIn });
    });
  }
  router.get("/leaderboard", async (_request, response) => {
    const optedIn = await prisma.player.findMany({
      where: { leaderboardOptIn: true },
      select: { id: true, displayName: true, timeZone: true, rungClaims: { select: { rungCents: true, claimedAt: true } } }
    });
    const leaders = await Promise.all(optedIn.map(async (row) => {
      const stats = await statsFor(row.id, row.timeZone ?? "UTC");
      // Explicit whitelist: never spread a player, entry, or private stats object.
      return {
        displayName: row.displayName ?? "Player",
        verifiedTotalCents: stats.totals.verifiedCents + stats.verifiedOtherCents,
        xp: stats.xp, level: stats.level,
        professionClass: stats.professionClass,
        professions: stats.professions.filter(rank => rank.rank > 0)
          .sort((left, right) => right.rank - left.rank || right.verifiedCents - left.verifiedCents)
          .slice(0, 2),
        sites: stats.sites.filter((site) => site.verifiedCents > 0).map((site) => ({ platform: site.platform, verifiedCents: site.verifiedCents })),
        rungClaims: row.rungClaims
      };
    }));
    leaders.sort((a, b) => b.verifiedTotalCents - a.verifiedTotalCents || b.xp - a.xp || a.displayName.localeCompare(b.displayName));
    response.json({ players: leaders });
  });
  return router;
}
