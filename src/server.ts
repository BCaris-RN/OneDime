import "dotenv/config";
import express from "express";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, type AppConfig } from "./config.js";
import { createPayPalRouter, type PayPalIdentityClient } from "./auth/paypal.js";
import { SessionStore } from "./auth/session.js";
import { prisma as defaultPrisma } from "./db/client.js";
import type { PrismaClient } from "@prisma/client";

type CreateAppOptions = {
  config?: AppConfig;
  prisma?: PrismaClient;
  paypalClient?: PayPalIdentityClient;
};

const publicDir = path.join(process.cwd(), "public");

export function createApp(options: CreateAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? defaultPrisma;
  const sessions = new SessionStore(prisma, config);
  const app = express();

  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

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

      response.json({
        player: {
          id: currentSession.player.id,
          displayName: currentSession.player.displayName,
          email: currentSession.player.email
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/app", sessions.requirePlayer(), (_request, response) => {
    response.sendFile(path.join(publicDir, "app.html"));
  });

  app.post("/logout", async (request, response, next) => {
    try {
      await sessions.destroySession(request, response);
      response.redirect("/");
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(publicDir));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error.message);
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
