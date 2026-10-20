import { PrismaClient } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/000006_payout_batch_status/migration.sql", import.meta.url),
  "utf8",
);
let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient;

beforeAll(async () => {
  let databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const target = new URL(databaseUrl);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      !/(^|_)test($|_)/.test(target.pathname.slice(1))
    ) {
      throw new Error("Migration tests require a local disposable test database.");
    }
  } else {
    container = await new PostgreSqlContainer("postgres:16").start();
    databaseUrl = container.getConnectionUri();
  }
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

type MigratedPayout = { id: string; status: string; batch_status: string | null };

async function migrateRows(statuses: string[], batchId: string | null = "FICTIONAL-BATCH") {
  return prisma.$transaction(async (tx) => {
    // A transaction-local table shadows payouts without touching shared application data.
    await tx.$executeRawUnsafe(`CREATE TEMP TABLE payouts (
      id text PRIMARY KEY,
      status text NOT NULL,
      paypal_batch_id text
    ) ON COMMIT DROP`);
    for (const status of statuses) {
      await tx.$executeRaw`INSERT INTO payouts (id, status, paypal_batch_id)
        VALUES (${status}, ${status}, ${batchId})`;
    }
    for (const statement of migration.split(";").filter((sql) => sql.trim())) {
      await tx.$executeRawUnsafe(statement);
    }
    return tx.$queryRaw<MigratedPayout[]>`
      SELECT id, status, batch_status FROM payouts ORDER BY id COLLATE "C"`;
  });
}

describe("payout batch status migration", () => {
  it("moves pending and processing batch states while keeping the item pending", async () => {
    expect(await migrateRows(["PENDING", "PROCESSING"])).toEqual([
      { id: "PENDING", status: "PENDING", batch_status: "PENDING" },
      { id: "PROCESSING", status: "PENDING", batch_status: "PROCESSING" },
    ]);
  });

  it("requires review when a legacy terminal state could have come from a batch or item", async () => {
    expect(await migrateRows(["SUCCESS", "DENIED", "CANCELED"])).toEqual([
      { id: "CANCELED", status: "manual_review", batch_status: "CANCELED" },
      { id: "DENIED", status: "manual_review", batch_status: "DENIED" },
      { id: "SUCCESS", status: "manual_review", batch_status: "SUCCESS" },
    ]);
  });

  it("preserves item-only outcomes and internal outbox states", async () => {
    const statuses = [
      "ready", "retry", "sending", "manual_review", "FAILED", "RETURNED", "REFUNDED",
      "UNCLAIMED", "BLOCKED", "HELD",
    ].sort();
    expect(await migrateRows(statuses)).toEqual(
      statuses.map((status) => ({ id: status, status, batch_status: null })),
    );
  });

  it("normalizes legacy batch state even when a batch identifier is missing", async () => {
    expect(await migrateRows(["SUCCESS"], null)).toEqual([
      { id: "SUCCESS", status: "manual_review", batch_status: "SUCCESS" },
    ]);
  });
});
