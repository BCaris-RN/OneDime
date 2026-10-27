import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { SessionStore } from "../src/auth/session.js";
import { localDay } from "../src/game/rules.js";
import { seedDemo } from "../src/demo/seed.js";
const container = await new PostgreSqlContainer("postgres:16").start();
let prisma: PrismaClient | undefined;
try {
  const databaseUrl = container.getConnectionUri();
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: true,
    stdio: "ignore"
  });
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config = loadConfig({
    NODE_ENV: "test",
    DEMO_VIDEO: "true",
    PORT: "3403",
    PUBLIC_BASE_URL: "http://127.0.0.1:3403",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    PAYOUTS_ENABLED: "false"
  });
  const player = await seedDemo(prisma, localDay(new Date(), "Pacific/Honolulu"));
  const sessions = new SessionStore(prisma, config);
  const app = createApp({
    config,
    prisma,
    paypalClient: {
      exchangeCodeForToken: async () => ({ access_token: "fictional-demo-token" }),
      fetchUserInfo: async () => ({
        user_id: "onedime-fictional-demo",
        name: "Demo player",
        email: "demo@example.test"
      })
    }
  });
  app.get("/demo-login", async (_req, res) => {
    await sessions.createSession(player.id, res);
    res.redirect("/app");
  });
  const server = app.listen(3403, "127.0.0.1", () =>
    console.log("fictional demo: http://127.0.0.1:3403/demo-login")
  );
  const close = async () => {
    server.close();
    await prisma?.$disconnect();
    await container.stop();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  server.on("error", async () => {
    await prisma?.$disconnect();
    await container.stop();
    console.error("demo could not start");
    process.exit(1);
  });
} catch {
  await prisma?.$disconnect();
  await container.stop();
  console.error("demo setup failed");
  process.exitCode = 1;
}
