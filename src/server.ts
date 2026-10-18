/*  (o) OneDime | src/server.ts
 *  ----------------------------------------------------------
 *  Authenticated application and shared request boundaries.
 */
import "dotenv/config";
import express from "express";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, type AppConfig } from "./config.js";
import { createPayPalRouter, type PayPalIdentityClient } from "./auth/paypal.js";
import { SessionStore } from "./auth/session.js";
import { prisma as defaultPrisma } from "./db/client.js";
import type { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { createGameRouter } from "./game/router.js";
import type { QuestDefinition } from "./game/catalog.js";
import { createLedgerRouter } from "./ledger/router.js";
import { HttpError } from "./http/errors.js";
import { sandboxClient } from "./paypal/client.js";
import { createPayoutService, type PayoutClient } from "./paypal/payouts.js";
import { webhookHandler } from "./paypal/webhooks.js";
import { createAIRouter } from "./ai/router.js";
import type { AIClient } from "./ai/client.js";
import { createActivityRouter } from "./paypal/router.js";
import { createExportRouter } from "./exports/router.js";

type CreateAppOptions = {
  config?: AppConfig;
  prisma?: PrismaClient;
  paypalClient?: PayPalIdentityClient;
  payoutClient?: PayoutClient;
  aiClient?: AIClient;
  now?: () => Date;
  quests?: readonly QuestDefinition[];
  writeLimit?: { count: number; windowMs: number };
};

const publicDir = path.join(process.cwd(), "public");

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? defaultPrisma;
  const sessions = new SessionStore(prisma, config);
  const payoutClient = options.payoutClient ?? sandboxClient(config);
  const flushPayouts = createPayoutService(prisma, config, payoutClient, options.now ?? (() => new Date()));
  const app = express();

  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false }));
  app.use("/api/paypal/import", express.json({ limit: "1mb" }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ ok: true });
  });

  app.get("/", async (request, response, next) => {
    try {
      const currentSession = await sessions.getCurrentSession(request);
      if (currentSession) {
        response.redirect("/app");
        return;
      }

      response.sendFile(path.join(publicDir, "index.html"));
    } catch (error) {
      next(error);
    }
  });

  app.use(
    "/auth/paypal",
    createPayPalRouter({
      prisma,
      config,
      sessions,
      paypalClient: options.paypalClient
    })
  );

  app.get("/api/me", async (request, response, next) => {
    try {
      const currentSession = await sessions.getCurrentSession(request);
      if (!currentSession) {
        response.status(401).json({ error: "unauthenticated" });
        return;
      }

      response.set("Cache-Control", "no-store").json({
        player: {
          id: currentSession.player.id,
          displayName: currentSession.player.displayName,
          email: currentSession.player.email,
          paypalVerified: currentSession.player.paypalVerified,
          timeZone: currentSession.player.timeZone,
          leaderboardOptIn: currentSession.player.leaderboardOptIn
        }
      });
    } catch (error) {
      next(error);
    }
  });

  const gameRouter = createGameRouter({ prisma, config, sessions, now: options.now, quests: options.quests, writeLimit: options.writeLimit });
  app.post("/api/paypal/webhook", webhookHandler(prisma, config, payoutClient));
  app.use("/api", gameRouter);
  app.use("/api", createActivityRouter(prisma, options.now ?? (() => new Date()), flushPayouts));
  app.locals.flushPayouts = flushPayouts;
  app.use("/api", createAIRouter(prisma, config, options.now ?? (() => new Date()), options.aiClient));
  app.use("/api", createLedgerRouter(prisma, options.now ?? (() => new Date())));
  app.use("/api", createExportRouter(prisma, options.now ?? (() => new Date())));
  app.post("/logout", gameRouter);

  app.get("/app", sessions.requirePlayer(), (_request, response) => {
    response.sendFile(path.join(publicDir, "app.html"));
  });

  app.use(express.static(publicDir));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.code });
      return;
    }
    if (error instanceof ZodError) {
      response.status(400).json({ error: "invalid_input", issues: error.issues.map(({ path, message }) => ({ path, message })) });
      return;
    }
    if ("status" in error && (error.status === 400 || error.status === 413)) {
      response.status(error.status).json({ error: error.status === 413 ? "body_too_large" : "invalid_json" });
      return;
    }
    console.error("Request failed.");
    response.status(500).send("Something went wrong.");
  });

  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const config = loadConfig();
  const app = createApp({ config });

  if (config.payoutsEnabled) {
    setInterval(async () => {
      try {
        const rows = await defaultPrisma.payout.findMany({ where: { status: { in: ["ready", "retry", "sending"] } }, distinct: ["playerId"], select: { playerId: true } });
        for (const row of rows) await app.locals.flushPayouts(row.playerId);
      } catch { console.error("payout worker failed"); }
    }, 60000).unref();
  }
  app.listen(config.port, () => {
    console.log(`OneDime listening on http://localhost:${config.port}`);
  });
}
