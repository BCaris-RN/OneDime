import { PrismaClient, Prisma } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import type { PayPalIdentityClient } from "../src/auth/paypal.js";

const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 0,
  databaseUrl: undefined,
  sessionSecret: "test-session-secret-that-is-long-enough",
  sessionTtlDays: 14,
  cookieSecure: false,
  publicBaseUrl: "http://127.0.0.1:3000",
  paypalClientId: "sandbox-client-id",
  paypalClientSecret: "sandbox-client-secret",
  paypalRedirectUri: "http://127.0.0.1:3000/auth/paypal/callback",
  paypalAuthUrl: "https://www.sandbox.paypal.com/connect",
  paypalApiBaseUrl: "https://api-m.sandbox.paypal.com",
  paypalScope: "openid profile email https://uri.paypal.com/services/paypalattributes"
};

let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient;
let app: ReturnType<typeof import("../src/server.js").createApp>;
let paypalClient: PayPalIdentityClient;

beforeAll(async () => {
  const databaseUrl = await resolveDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  runPrismaMigrations(databaseUrl);

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });

  paypalClient = {
    exchangeCodeForToken: vi.fn(async () => ({ access_token: "mock-access-token" })),
    fetchUserInfo: vi.fn(async () => ({
      user_id: "PAYPAL-USER-1",
      name: "First Player",
      email: "first@example.com"
    }))
  };

  const { createApp } = await import("../src/server.js");
  app = createApp({
    config: {
      ...testConfig,
      databaseUrl
    },
    prisma,
    paypalClient
  });
}, 120_000);

beforeEach(async () => {
  vi.clearAllMocks();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      sessions,
      oauth_states,
      payouts,
      receipts,
      rung_claims,
      quest_progress,
      log_entries,
      players
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

describe("server", () => {
  it("returns 200 for GET /health", async () => {
    await request(app).get("/health").expect(200, { ok: true });
  });

  it("rejects an OAuth callback with missing state", async () => {
    await request(app).get("/auth/paypal/callback?code=abc").expect(400);
    expect(paypalClient.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("rejects an OAuth callback with mismatched state", async () => {
    await request(app).get("/auth/paypal/callback?code=abc&state=wrong").expect(400);
    expect(paypalClient.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("creates a player and session from a mocked PayPal response", async () => {
    const state = await beginPayPalLogin();

    const response = await request(app)
      .get(`/auth/paypal/callback?code=auth-code&state=${state}`)
      .expect(302);

    expect(response.headers.location).toBe("/app");
    expect(response.headers["set-cookie"]?.[0]).toContain("onedime_session=");

    const players = await prisma.player.findMany();
    const sessions = await prisma.session.findMany();

    expect(players).toHaveLength(1);
    expect(players[0].paypalUserId).toBe("PAYPAL-USER-1");
    expect(players[0].displayName).toBe("First Player");
    expect(players[0].email).toBe("first@example.com");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].playerId).toBe(players[0].id);
  });

  it("allows only one simultaneous callback to consume an OAuth state", async () => {
    const state = await beginPayPalLogin();

    const responses = await Promise.all([
      request(app).get(`/auth/paypal/callback?code=first&state=${state}`),
      request(app).get(`/auth/paypal/callback?code=second&state=${state}`)
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([302, 400]);
    expect(paypalClient.exchangeCodeForToken).toHaveBeenCalledTimes(1);
    await expect(prisma.player.count()).resolves.toBe(1);
    await expect(prisma.session.count()).resolves.toBe(1);
  });

  it("stores a hash of the session ID instead of the raw cookie value", async () => {
    const state = await beginPayPalLogin();
    const response = await request(app)
      .get(`/auth/paypal/callback?code=auth-code&state=${state}`)
      .expect(302);
    const rawSessionId = readRawSessionId(response.headers["set-cookie"]?.[0]);
    const sessions = await prisma.session.findMany();

    expect(rawSessionId).toBeTruthy();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).not.toBe(rawSessionId);
    expect(sessions[0].id).toBe(sha256(rawSessionId));
  });

  it("updates an existing player on a second login with the same PayPal user", async () => {
    const firstState = await beginPayPalLogin();
    await request(app).get(`/auth/paypal/callback?code=first&state=${firstState}`).expect(302);

    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({
      user_id: "PAYPAL-USER-1",
      name: "Updated Player",
      email: "updated@example.com"
    });

    const secondState = await beginPayPalLogin();
    await request(app).get(`/auth/paypal/callback?code=second&state=${secondState}`).expect(302);

    const players = await prisma.player.findMany();
    expect(players).toHaveLength(1);
    expect(players[0].displayName).toBe("Updated Player");
    expect(players[0].email).toBe("updated@example.com");
  });

  it("rejects a second claim on the same rung", async () => {
    const player = await prisma.player.create({
      data: {
        paypalUserId: "PAYPAL-RUNG-1",
        displayName: "Rung Player"
      }
    });

    await prisma.rungClaim.create({
      data: {
        rungCents: 10,
        playerId: player.id
      }
    });

    await expect(
      prisma.rungClaim.create({
        data: {
          rungCents: 10,
          playerId: player.id
        }
      })
    ).rejects.toMatchObject({
      code: "P2002"
    } satisfies Partial<Prisma.PrismaClientKnownRequestError>);
  });

  it("clears the session on logout", async () => {
    const state = await beginPayPalLogin();
    const loginResponse = await request(app)
      .get(`/auth/paypal/callback?code=auth-code&state=${state}`)
      .expect(302);
    const cookie = loginResponse.headers["set-cookie"]?.[0];

    expect(cookie).toBeDefined();

    const logoutResponse = await request(app)
      .post("/logout")
      .set("Cookie", cookie)
      .expect(302);

    expect(logoutResponse.headers.location).toBe("/");
    expect(logoutResponse.headers["set-cookie"]?.[0]).toContain("onedime_session=;");
    await expect(prisma.session.count()).resolves.toBe(0);
  });
});

async function beginPayPalLogin(): Promise<string> {
  const response = await request(app).get("/auth/paypal").expect(302);
  const location = response.headers.location;
  expect(location).toMatch(/^https:\/\/www\.sandbox\.paypal\.com\/connect/);

  const authorizationUrl = new URL(location);
  const state = authorizationUrl.searchParams.get("state");
  expect(state).toBeTruthy();
  return state!;
}

function readRawSessionId(setCookie: string | undefined): string {
  expect(setCookie).toBeDefined();
  const encodedCookieValue = setCookie!.split(";")[0].split("=")[1];
  return decodeURIComponent(encodedCookieValue).split(".")[0];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function resolveDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  container = await new PostgreSqlContainer("postgres:16").start();
  return container.getConnectionUri();
}

function runPrismaMigrations(databaseUrl: string): void {
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    shell: true,
    stdio: "inherit"
  });
}
