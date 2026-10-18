import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/demo/seed.js";
import { localDay } from "../src/game/rules.js";
if (process.env.NODE_ENV === "production" || process.env.DEMO_SEED_ENABLED !== "true")
  throw new Error("Demo seed requires DEMO_SEED_ENABLED=true outside production.");
const host = new URL(process.env.DATABASE_URL ?? "").hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host))
  throw new Error("Demo seed requires a local database.");
const prisma = new PrismaClient();
try {
  await seedDemo(prisma, localDay(new Date(), "Pacific/Honolulu"));
  console.log("fictional demo data ready");
} finally {
  await prisma.$disconnect();
}
