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

type CreateAppOptions = {
  config?: AppConfig;
  prisma?: PrismaClient;
  paypalClient?: PayPalIdentityClient;
  now?: () => Date;
  quests?: readonly QuestDefinition[];
  writeLimit?: { count: number; windowMs: number };
};

const publicDir = path.join(process.cwd(), "public");

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? defaultPrisma;
  const sessions = new SessionStore(prisma, config);
  const app = express();

  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false }));
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
          timeZone: currentSession.player.timeZone,
          leaderboardOptIn: currentSession.player.leaderboardOptIn
        }
      });
    } catch (error) {
      next(error);
    }
  });

  const gameRouter = createGameRouter({ prisma, config, sessions, now: options.now, quests: options.quests, writeLimit: options.writeLimit });
  app.use("/api", gameRouter);
  app.post("/logout", gameRouter);

  app.get("/app", sessions.requirePlayer(), (_request, response) => {
    response.sendFile(path.join(publicDir, "app.html"));
  });

  app.use(express.static(publicDir));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
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

  app.listen(config.port, () => {
    console.log(`OneDime listening on http://localhost:${config.port}`);
  });
}
