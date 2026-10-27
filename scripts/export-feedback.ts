import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { formatFeedbackReport } from "../src/feedback/export.js";

dotenv.config({ quiet: true });

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("missing database configuration");
  }
  const prisma = new PrismaClient({ log: [], errorFormat: "minimal" });
  try {
    const rows = await prisma.feedback.findMany({
      select: {
        id: true,
        playerId: true,
        app: true,
        body: true,
        blocking: true,
        status: true,
        createdAt: true,
      },
    });
    const exportedAt = new Date();
    const directory = resolve("feedback");
    const filename = `feedback-${exportedAt.toISOString().slice(0, 10)}.md`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, filename), formatFeedbackReport(rows, exportedAt), {
      encoding: "utf8", mode: 0o600,
    });
    console.log(`feedback exported to feedback/${filename}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Driver errors can contain credentials or submitted feedback.
  console.error("feedback export failed; check database configuration and migrations privately");
  process.exitCode = 1;
});
