import { seedDemo } from "../src/demo/seed.js";
import { createPayoutService } from "../src/paypal/payouts.js";
import type { PayoutClient } from "../src/paypal/payouts.js";
import { unzipSync, strFromU8 } from "fflate";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AppConfig } from "../src/config.js";
import type { PayPalIdentityClient } from "../src/auth/paypal.js";
import { claimEligibleRungs } from "../src/game/rungs.js";
import { parseBetaAllowlist } from "../src/auth/beta.js";

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
  paypalScope:
    "openid profile email https://uri.paypal.com/services/paypalattributes",
};

let container: StartedPostgreSqlContainer | undefined;
let prisma: PrismaClient;
let app: ReturnType<typeof import("../src/server.js").createApp>;
let paypalClient: PayPalIdentityClient;
let gameNow = new Date("2026-10-14T20:00:00Z");

beforeAll(async () => {
  const databaseUrl = await resolveDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  runPrismaMigrations(databaseUrl);

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  paypalClient = {
    exchangeCodeForToken: vi.fn(async () => ({
      access_token: "mock-access-token",
    })),
    fetchUserInfo: vi.fn(async () => ({
      user_id: "PAYPAL-USER-1",
      name: "First Player",
      email: "first@example.com",
    })),
  };

  const { createApp } = await import("../src/server.js");
  app = createApp({
    config: {
      ...testConfig,
      databaseUrl,
    },
    prisma,
    paypalClient,
    now: () => gameNow,
    // Fixtures exercise quest mechanics, never stand in for the missing pilot.
    quests: [{ id: "fixture-quest", title: "Test fixture only", xp: 50 }],
  });
}, 120_000);

beforeEach(async () => {
  vi.clearAllMocks();
  gameNow = new Date("2026-10-14T20:00:00Z");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      sessions,
      feedback,
      webhook_events,
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
    await request(app)
      .get("/auth/paypal/callback?code=abc&state=wrong")
      .expect(400);
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
      request(app).get(`/auth/paypal/callback?code=second&state=${state}`),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      302, 400,
    ]);
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
    await request(app)
      .get(`/auth/paypal/callback?code=first&state=${firstState}`)
      .expect(302);

    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({
      user_id: "PAYPAL-USER-1",
      name: "Updated Player",
      email: "updated@example.com",
    });

    const secondState = await beginPayPalLogin();
    await request(app)
      .get(`/auth/paypal/callback?code=second&state=${secondState}`)
      .expect(302);

    const players = await prisma.player.findMany();
    expect(players).toHaveLength(1);
    expect(players[0].displayName).toBe("Updated Player");
    expect(players[0].email).toBe("updated@example.com");
  });

  it("rejects a second claim on the same rung", async () => {
    const player = await prisma.player.create({
      data: {
        paypalUserId: "PAYPAL-RUNG-1",
        displayName: "Rung Player",
      },
    });

    await prisma.rungClaim.create({
      data: {
        rungCents: 10,
        playerId: player.id,
      },
    });

    await expect(
      prisma.rungClaim.create({
        data: {
          rungCents: 10,
          playerId: player.id,
        },
      }),
    ).rejects.toMatchObject({
      code: "P2002",
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
      .set("Origin", testConfig.publicBaseUrl)
      .send({})
      .expect(204);

    expect(logoutResponse.headers["set-cookie"]?.[0]).toContain(
      "onedime_session=;",
    );
    await expect(prisma.session.count()).resolves.toBe(0);
  });
});

describe("beta allowlist", () => {
  async function configuredApp(value?: string) {
    const { createApp } = await import("../src/server.js");
    return createApp({ config: { ...testConfig, betaAllowlist: parseBetaAllowlist(value) }, prisma, paypalClient });
  }
  async function attemptLogin(target: typeof app) {
    const start = await request(target).get("/auth/paypal").expect(302);
    const state = new URL(start.headers.location).searchParams.get("state");
    return request(target).get(`/auth/paypal/callback?code=fixture&state=${state}`);
  }

  it("admits a listed account using normalized exact email matching", async () => {
    const target = await configuredApp("other@example.test, FIRST@EXAMPLE.COM ");
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({ user_id: "BETA-1", email: " First@Example.COM " });
    const response = await attemptLogin(target);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/app");
    const cookie = response.headers["set-cookie"]![0];
    await expect(prisma.player.count()).resolves.toBe(1);
    await expect(prisma.session.count()).resolves.toBe(1);
    await request(target).get("/api/me").set("Cookie", cookie).expect(200);
  });

  it("rejects an unlisted account without creating a player or session or logging an address", async () => {
    const target = await configuredApp("other@example.test");
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "error")];
    try {
      const response = await attemptLogin(target);
      expect(response.status).toBe(403);
      expect(response.text).toContain("OneDime is in a private beta");
      expect(response.text).not.toContain("first@example.com");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["set-cookie"]).toBeUndefined();
      await expect(prisma.player.count()).resolves.toBe(0);
      await expect(prisma.session.count()).resolves.toBe(0);
      for (const log of logs) expect(log).not.toHaveBeenCalled();
    } finally { for (const log of logs) log.mockRestore(); }
  });

  it.each([undefined, "", "  "])("rejects a missing or empty provider email when beta access is restricted", async email => {
    const target = await configuredApp("first@example.com");
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({ user_id: "BETA-MISSING", email });
    expect((await attemptLogin(target)).status).toBe(403);
    await expect(prisma.player.count()).resolves.toBe(0);
    await expect(prisma.session.count()).resolves.toBe(0);
  });

  it("does not treat plus aliases or dotted addresses as the same beta account", async () => {
    const target = await configuredApp("first@example.com");
    for (const email of ["first+beta@example.com", "f.irst@example.com"]) {
      vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({ user_id: "BETA-ALIAS", email });
      expect((await attemptLogin(target)).status).toBe(403);
    }
    await expect(prisma.player.count()).resolves.toBe(0);
  });

  it.each([undefined, "", "  "])("preserves login without provider email when the allowlist is unset or blank", async value => {
    const target = await configuredApp(value);
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({ user_id: "BETA-UNSET" });
    const response = await attemptLogin(target);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/app");
    await request(target).get("/api/me").set("Cookie", response.headers["set-cookie"]![0]).expect(200);
  });

  it("does not update an existing player or create a session for a denied login", async () => {
    await attemptLogin(app);
    const original = await prisma.player.findFirstOrThrow();
    const target = await configuredApp("other@example.test");
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({ user_id: original.paypalUserId, name: "Changed", email: "denied@example.test" });
    expect((await attemptLogin(target)).status).toBe(403);
    expect(await prisma.player.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
    await expect(prisma.session.count()).resolves.toBe(1);
  });

  it("consumes OAuth state once even when beta admission is denied", async () => {
    const target = await configuredApp("other@example.test");
    const start = await request(target).get("/auth/paypal").expect(302);
    const state = new URL(start.headers.location).searchParams.get("state");
    const callback = `/auth/paypal/callback?code=fixture&state=${state}`;
    await request(target).get(callback).expect(403);
    await request(target).get(callback).expect(400);
    expect(paypalClient.exchangeCodeForToken).toHaveBeenCalledTimes(1);
    await expect(prisma.oauthState.count()).resolves.toBe(0);
  });

  it.each(["/api/me", "/api/entries", "/api/settings", "/api/paypal/transactions", "/api/overview"])(
    "rejects a removed account on the next request to %s", async route => {
      const response = await attemptLogin(app);
      const cookie = response.headers["set-cookie"]![0];
      const target = await configuredApp("other@example.test");
      await request(target).get(route).set("Cookie", cookie).expect(401);
      await expect(prisma.session.count()).resolves.toBe(0);
      await expect(prisma.player.count()).resolves.toBe(1);
    }
  );

  it("rejects a removed account before feedback is written", async () => {
    const response = await attemptLogin(app);
    const target = await configuredApp("other@example.test");
    await request(target).post("/api/feedback").set("Cookie", response.headers["set-cookie"]![0])
      .set("Origin", testConfig.publicBaseUrl).send({ app: "first", body: "Fictional feedback", blocking: false }).expect(401);
    await expect(prisma.feedback.count()).resolves.toBe(0);
    await expect(prisma.session.count()).resolves.toBe(0);
  });

  it.each(["/", "/app"])("removes a denied session when an existing player opens %s", async route => {
    const response = await attemptLogin(app);
    const cookie = response.headers["set-cookie"]![0];
    const target = await configuredApp("other@example.test");
    const page = await request(target).get(route).set("Cookie", cookie);
    expect(page.status).toBe(route === "/" ? 200 : 302);
    if (route === "/") expect(page.text).toContain("Log in with PayPal");
    else expect(page.headers.location).toBe("/");
    await expect(prisma.session.count()).resolves.toBe(0);
  });

  it("keeps a rejected cookie invalid after its account is re-added", async () => {
    const response = await attemptLogin(app);
    const cookie = response.headers["set-cookie"]![0];
    const denied = await configuredApp("other@example.test");
    await request(denied).get("/api/me").set("Cookie", cookie).expect(401);
    const restored = await configuredApp("first@example.com");
    await request(restored).get("/api/me").set("Cookie", cookie).expect(401);
    const fresh = await attemptLogin(restored);
    expect(fresh.status).toBe(302);
    await request(restored).get("/api/me").set("Cookie", fresh.headers["set-cookie"]![0]).expect(200);
  });

  it("rejects an older session whose stored account email is missing", async () => {
    const response = await attemptLogin(app);
    await prisma.player.updateMany({ data: { email: null } });
    const target = await configuredApp("first@example.com");
    await request(target).get("/api/me").set("Cookie", response.headers["set-cookie"]![0]).expect(401);
    await expect(prisma.session.count()).resolves.toBe(0);
  });
});

describe("Phase 2 game API", () => {
  const origin = testConfig.publicBaseUrl;
  const validEntry = {
    platform: "Test site",
    amountCents: 123,
    minutes: 15,
    workedOn: "2026-10-14",
    note: "Private work note",
  };

  async function login(suffix: string) {
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({
      user_id: `game-${suffix}`,
      name: `Player ${suffix}`,
      email: `${suffix}@example.com`,
    });
    const state = await beginPayPalLogin();
    const result = await request(app)
      .get(`/auth/paypal/callback?code=fixture&state=${state}`)
      .expect(302);
    const player = await prisma.player.findUniqueOrThrow({
      where: { paypalUserId: `game-${suffix}` },
    });
    return { player, cookie: result.headers["set-cookie"]![0] };
  }
  function write(cookie: string, route: string, body: unknown = {}) {
    return request(app)
      .post(route)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .send(body);
  }

  it.each([
    "/api/entries",
    "/api/me/stats",
    "/api/clock",
    "/api/quests",
    "/api/leaderboard",
  ])("requires a session for GET %s", async (route) => {
    await request(app).get(route).expect(401);
  });
  it.each([
    "/api/entries",
    "/api/clock/in",
    "/api/clock/out",
    "/api/quests/fixture-quest",
    "/api/leaderboard/join",
    "/api/leaderboard/leave",
    "/api/me/time-zone",
    "/api/logout",
    "/api/feedback",
  ])("requires a session for POST %s", async (route) => {
    await request(app).post(route).set("Origin", origin).send({}).expect(401);
  });
  it("requires a session to delete entries", async () => {
    await request(app)
      .delete("/api/entries")
      .set("Origin", origin)
      .send({})
      .expect(401);
  });
  it("logs only owned, unverified entries and keeps private stats private", async () => {
    const alice = await login("alice");
    const bob = await login("bob");
    const created = await write(
      alice.cookie,
      "/api/entries",
      validEntry,
    ).expect(201);
    expect(created.body.entry).toMatchObject({
      ...validEntry,
      playerId: alice.player.id,
      verified: false,
    });
    const own = await request(app)
      .get("/api/entries")
      .set("Cookie", alice.cookie)
      .expect(200);
    expect(own.body.entries).toHaveLength(1);
    expect(
      (await request(app).get("/api/entries").set("Cookie", bob.cookie)).body
        .entries,
    ).toEqual([]);
    await request(app)
      .get(`/api/entries?id=${created.body.entry.id}`)
      .set("Cookie", bob.cookie)
      .expect(404);
    await request(app)
      .delete("/api/entries")
      .set("Cookie", bob.cookie)
      .set("Origin", origin)
      .send({ id: created.body.entry.id })
      .expect(404);
    await write(bob.cookie, "/api/entries", {
      ...validEntry,
      playerId: alice.player.id,
    }).expect(400);
    await write(bob.cookie, "/api/entries", {
      ...validEntry,
      id: created.body.entry.id,
    }).expect(400);
    await request(app)
      .patch(`/api/entries/${created.body.entry.id}`)
      .set("Cookie", bob.cookie)
      .set("Origin", origin)
      .send({ minutes: 0 })
      .expect(404);
    const stats = await request(app)
      .get("/api/me/stats")
      .set("Cookie", alice.cookie)
      .expect(200);
    expect(stats.body).toMatchObject({
      totals: { amountCents: 123, verifiedCents: 0, minutes: 15 },
      xp: 27,
      streak: 1,
    });
    expect(
      (await request(app).get("/api/me/stats").set("Cookie", bob.cookie)).body
        .totals.amountCents,
    ).toBe(0);
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
    await request(app)
      .delete("/api/entries")
      .set("Cookie", alice.cookie)
      .set("Origin", origin)
      .send({ id: created.body.entry.id })
      .expect(204);
    await expect(prisma.logEntry.count()).resolves.toBe(0);
  });
  it.each([-1, 0.5, 1_000_001, "100", null])(
    "rejects amount %s",
    async (amountCents) => {
      const current = await login("invalid");
      await write(current.cookie, "/api/entries", {
        ...validEntry,
        amountCents,
      }).expect(400);
      await expect(prisma.logEntry.count()).resolves.toBe(0);
    },
  );
  it.each([0, 1_000_000])("accepts boundary amount %s", async (amountCents) => {
    const current = await login("boundary");
    await write(current.cookie, "/api/entries", {
      ...validEntry,
      amountCents,
    }).expect(201);
  });
  it.each([
    { verified: true },
    { playerId: "other-player" },
    { platform: "" },
    { minutes: -1 },
    { minutes: 0.1 },
    { workedOn: "2026-02-30" },
    { workedOn: "2026-10-15" },
    { note: "x".repeat(2001) },
  ])("rejects invalid or privileged entry fields: %j", async (fields) => {
    const current = await login("fields");
    await write(current.cookie, "/api/entries", {
      ...validEntry,
      ...fields,
    }).expect(400);
  });
  it("rejects missing, null, cross-origin and malformed origins, plus non-JSON writes", async () => {
    const current = await login("csrf");
    for (const value of [
      "null",
      "https://evil.example",
      `${origin}.evil.example`,
      `${origin}/path`,
    ]) {
      await request(app)
        .post("/api/entries")
        .set("Cookie", current.cookie)
        .set("Origin", value)
        .send(validEntry)
        .expect(403);
    }
    await request(app)
      .post("/api/entries")
      .set("Cookie", current.cookie)
      .send(validEntry)
      .expect(403);
    await request(app)
      .post("/api/entries")
      .set("Cookie", current.cookie)
      .set("Origin", origin)
      .set("Sec-Fetch-Site", "cross-site")
      .send(validEntry)
      .expect(403);
    await request(app)
      .post("/api/entries")
      .set("Cookie", current.cookie)
      .set("Origin", origin)
      .type("form")
      .send(validEntry)
      .expect(415);
    await request(app)
      .post("/api/entries")
      .set("Cookie", current.cookie)
      .set("Origin", origin)
      .type("json")
      .send("{")
      .expect(400);
    await request(app)
      .delete("/api/entries")
      .set("Cookie", current.cookie)
      .send({ id: current.player.id })
      .expect(403);
    await request(app)
      .post("/logout")
      .set("Cookie", current.cookie)
      .type("form")
      .send({})
      .expect(415);
    await request(app)
      .post("/api/logout")
      .set("Cookie", current.cookie)
      .send({})
      .expect(403);
    await request(app).get("/api/me").set("Cookie", current.cookie).expect(200);
  });
  it("persists the browser time zone and computes dates in it", async () => {
    const current = await login("zone");
    gameNow = new Date("2026-10-14T02:00:00Z");
    await write(current.cookie, "/api/me/time-zone", {
      timeZone: "Pacific/Honolulu",
    }).expect(200);
    await write(current.cookie, "/api/me/time-zone", {
      timeZone: "not/a-zone",
    }).expect(400);
    await write(current.cookie, "/api/entries", validEntry).expect(400);
    await write(current.cookie, "/api/entries", {
      ...validEntry,
      workedOn: "2026-10-13",
    }).expect(201);
    const stats = await request(app)
      .get("/api/me/stats")
      .set("Cookie", current.cookie)
      .expect(200);
    expect(stats.body).toMatchObject({
      today: "2026-10-13",
      timeZone: "Pacific/Honolulu",
      streak: 1,
    });
  });
  it("makes concurrent entries safe for the same player", async () => {
    const current = await login("parallel");
    const results = await Promise.all([
      write(current.cookie, "/api/entries", validEntry),
      write(current.cookie, "/api/entries", validEntry),
    ]);
    expect(results.map((row) => row.status)).toEqual([201, 201]);
    await expect(prisma.logEntry.count()).resolves.toBe(2);
  });
  it("clock out returns whole minutes rounded down without auto-logging", async () => {
    const alice = await login("clock-alice");
    const bob = await login("clock-bob");
    await write(alice.cookie, "/api/clock/out").expect(409);
    await write(alice.cookie, "/api/clock/in", {
      platform: "Test site",
    }).expect(200);
    await write(alice.cookie, "/api/clock/in", {
      platform: "Other site",
    }).expect(409);
    await write(bob.cookie, "/api/clock/out").expect(409);
    expect(
      (await request(app).get("/api/clock").set("Cookie", alice.cookie)).body
        .platform,
    ).toBe("Test site");
    gameNow = new Date(gameNow.getTime() + 125_000);
    const results = await Promise.all([
      write(alice.cookie, "/api/clock/out"),
      write(alice.cookie, "/api/clock/out"),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
    expect(results.find((row) => row.status === 200)!.body).toMatchObject({
      minutes: 2,
      platform: "Test site",
      workedOn: "2026-10-14",
    });
    await expect(prisma.logEntry.count()).resolves.toBe(0);
    expect(
      (
        await prisma.player.findUniqueOrThrow({
          where: { id: alice.player.id },
        })
      ).clockStartedAt,
    ).toBeNull();
  });
  it("only allows one concurrent clock in", async () => {
    const current = await login("clock-race");
    const results = await Promise.all([
      write(current.cookie, "/api/clock/in", { platform: "A" }),
      write(current.cookie, "/api/clock/in", { platform: "B" }),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
  });
  it("toggles only a player's own quest and counts its XP once", async () => {
    const alice = await login("quest-alice");
    const bob = await login("quest-bob");
    await write(alice.cookie, "/api/quests/fixture-quest").expect(200, {
      id: "fixture-quest",
      completed: true,
    });
    expect(
      (await request(app).get("/api/me/stats").set("Cookie", alice.cookie)).body
        .xp,
    ).toBe(50);
    expect(
      (await request(app).get("/api/quests").set("Cookie", bob.cookie)).body
        .completed,
    ).toEqual([]);
    await write(bob.cookie, "/api/quests/fixture-quest", {
      playerId: alice.player.id,
    }).expect(400);
    await write(alice.cookie, "/api/quests/unknown").expect(404);
    const results = await Promise.all([
      write(alice.cookie, "/api/quests/fixture-quest"),
      write(alice.cookie, "/api/quests/fixture-quest"),
    ]);
    expect(results.map((row) => row.status)).toEqual([200, 200]);
    await expect(
      prisma.questProgress.count({ where: { playerId: alice.player.id } }),
    ).resolves.toBe(1);
    await write(alice.cookie, "/api/quests/fixture-quest").expect(200, {
      id: "fixture-quest",
      completed: false,
    });
    expect(
      (await request(app).get("/api/me/stats").set("Cookie", alice.cookie)).body
        .xp,
    ).toBe(0);
  });
  it("serves the 19 real quests and rejects unknown quest IDs", async () => {
    const current = await login("no-pilot");
    const { createApp } = await import("../src/server.js");
    const productionCatalogApp = createApp({
      config: testConfig,
      prisma,
      paypalClient,
    });
    const catalog = await request(productionCatalogApp)
      .get("/api/quests")
      .set("Cookie", current.cookie)
      .expect(200);
    expect(catalog.body.pilotAvailable).toBe(true);
    expect(catalog.body.quests).toHaveLength(19);
    await request(productionCatalogApp)
      .post("/api/quests/invented")
      .set("Cookie", current.cookie)
      .set("Origin", origin)
      .send({})
      .expect(404);
  });
  it.each([
    [0, 0],
    [45_000, 0],
    [59_999, 0],
    [60_000, 1],
    [90_000, 1],
    [119_999, 1],
    [120_000, 2],
  ])("floors clock duration %s ms to %s minutes", async (elapsed, expected) => {
    const current = await login("clock-round");
    await write(current.cookie, "/api/clock/in", {
      platform: "Prolific",
    }).expect(200);
    gameNow = new Date(gameNow.getTime() + elapsed);
    const result = await write(current.cookie, "/api/clock/out").expect(200);
    expect(result.body.minutes).toBe(expected);
  });
  it("joining completes the pilot's leaderboard quest once and leaving retains that progress", async () => {
    const current = await login("real-join");
    const { createApp } = await import("../src/server.js");
    const realApp = createApp({
      config: testConfig,
      prisma,
      paypalClient,
      now: () => gameNow,
    });
    const action = (value: string) =>
      request(realApp)
        .post(`/api/leaderboard/${value}`)
        .set("Cookie", current.cookie)
        .set("Origin", origin)
        .send({});
    await action("join").expect(200);
    await action("join").expect(200);
    const stats = () =>
      request(realApp).get("/api/me/stats").set("Cookie", current.cookie);
    expect((await stats()).body.xp).toBe(20);
    await action("leave").expect(200);
    expect((await stats()).body.xp).toBe(20);
    await expect(
      prisma.questProgress.count({
        where: { playerId: current.player.id, questId: "lb-join" },
      }),
    ).resolves.toBe(1);
  });
  it("sorts leaderboard by verified total descending, then XP descending", async () => {
    const low = await login("sort-low");
    const highXp = await login("sort-high-xp");
    const highTotal = await login("sort-high-total");
    for (const [current, amountCents, minutes] of [
      [low, 100, 0],
      [highXp, 100, 60],
      [highTotal, 200, 0],
    ] as const) {
      await prisma.logEntry.create({
        data: {
          ...validEntry,
          playerId: current.player.id,
          amountCents,
          minutes,
          verified: true,
          workedOn: new Date("2026-10-14"),
        },
      });
      await write(current.cookie, "/api/leaderboard/join").expect(200);
    }
    const result = await request(app)
      .get("/api/leaderboard")
      .set("Cookie", low.cookie)
      .expect(200);
    expect(
      result.body.players.map(
        (row: { displayName: string }) => row.displayName,
      ),
    ).toEqual([
      "Player sort-high-total",
      "Player sort-high-xp",
      "Player sort-low",
    ]);
  });
  it("requires opt-in and whitelists leaderboard fields", async () => {
    const alice = await login("leader-alice");
    const bob = await login("leader-bob");
    await write(alice.cookie, "/api/entries", {
      ...validEntry,
      amountCents: 99999,
      platform: "Unverified-only site",
    }).expect(201);
    await prisma.logEntry.create({
      data: {
        ...validEntry,
        playerId: alice.player.id,
        amountCents: 10,
        workedOn: new Date("2026-10-14"),
        verified: true,
      },
    });
    await prisma.$transaction((tx) => claimEligibleRungs(tx, alice.player.id));
    expect(
      (await request(app).get("/api/leaderboard").set("Cookie", bob.cookie))
        .body.players,
    ).toEqual([]);
    await write(alice.cookie, "/api/leaderboard/join").expect(200);
    const result = await request(app)
      .get("/api/leaderboard")
      .set("Cookie", bob.cookie)
      .expect(200);
    expect(result.body.players).toHaveLength(1);
    expect(result.body.players[0]).toMatchObject({
      displayName: "Player leader-alice",
      verifiedTotalCents: 10,
      sites: [{ platform: "Test site", verifiedCents: 10 }],
    });
    expect(Object.keys(result.body.players[0]).sort()).toEqual([
      "displayName",
      "level",
      "rungClaims",
      "sites",
      "verifiedTotalCents",
      "xp",
    ]);
    const serialized = JSON.stringify(result.body);
    for (const forbidden of [
      "@example.com",
      validEntry.note,
      "99999",
      "Unverified-only site",
      "email",
      "note",
      "amountCents",
      "playerId",
    ])
      expect(serialized).not.toContain(forbidden);
    expect(result.body.players[0].rungClaims[0]).toMatchObject({
      rungCents: 10,
      claimedAt: expect.any(String),
    });
    await write(alice.cookie, "/api/leaderboard/leave").expect(200);
    expect(
      (await request(app).get("/api/leaderboard").set("Cookie", bob.cookie))
        .body.players,
    ).toEqual([]);
  });
  it("unverified earnings cannot claim rungs, verified earnings can claim all crossed rungs", async () => {
    const current = await login("rungs");
    const entry = await write(current.cookie, "/api/entries", {
      ...validEntry,
      amountCents: 100000,
    }).expect(201);
    await prisma.$transaction((tx) =>
      claimEligibleRungs(tx, current.player.id),
    );
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
    await prisma.$transaction(async (tx) => {
      await tx.logEntry.update({
        where: { id: entry.body.entry.id },
        data: { verified: true },
      });
      await claimEligibleRungs(tx, current.player.id);
    });
    await expect(prisma.rungClaim.count()).resolves.toBe(8);
    await prisma.$transaction((tx) =>
      claimEligibleRungs(tx, current.player.id),
    );
    await expect(prisma.rungClaim.count()).resolves.toBe(8);
    expect(
      (await request(app).get("/api/me/stats").set("Cookie", current.cookie))
        .body.xp,
    ).toBe(10815);
    const claims = await prisma.rungClaim.findMany({
      orderBy: { rungCents: "asc" },
    });
    await request(app)
      .delete(`/api/entries/${entry.body.entry.id}`)
      .set("Cookie", current.cookie)
      .set("Origin", origin)
      .send({})
      .expect(204);
    expect(
      await prisma.rungClaim.findMany({ orderBy: { rungCents: "asc" } }),
    ).toEqual(claims);
  });
  it("two players crossing a rung simultaneously yield exactly one winner and no loser error", async () => {
    const alice = await login("race-alice");
    const bob = await login("race-bob");
    await Promise.all(
      [alice, bob].map((current) =>
        prisma.logEntry.create({
          data: {
            ...validEntry,
            playerId: current.player.id,
            amountCents: 10,
            verified: true,
            workedOn: new Date("2026-10-14"),
          },
        }),
      ),
    );
    await Promise.all(
      [alice, bob].map((current) =>
        prisma.$transaction((tx) => claimEligibleRungs(tx, current.player.id)),
      ),
    );
    const claims = await prisma.rungClaim.findMany();
    expect(claims).toHaveLength(1);
    expect(claims[0].rungCents).toBe(10);
    expect([alice.player.id, bob.player.id]).toContain(claims[0].playerId);
  });
  it("rolls back a claim with its enclosing verification transaction", async () => {
    const current = await login("rollback");
    await prisma.logEntry.create({
      data: {
        ...validEntry,
        playerId: current.player.id,
        amountCents: 10,
        verified: true,
        workedOn: new Date("2026-10-14"),
      },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await claimEligibleRungs(tx, current.player.id);
        throw new Error("rollback fixture");
      }),
    ).rejects.toThrow("rollback fixture");
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
  });
  const workspaceCases = [
    [
      "/spotlight/income",
      {
        platform: "YouTube",
        stream_type: "Ad revenue",
        amount_cents: 199,
        earned_on: "2026-10-14",
        status: "pending",
        content_minutes: 30,
        note: "private",
      },
    ],
    [
      "/spotlight/deals",
      {
        brand: "Fictional studio",
        platform: "TikTok",
        amount_cents: 5000,
        due_on: null,
        deliverables: "One clip",
        stage: "Agreed",
      },
    ],
    [
      "/spotlight/expenses",
      {
        app: "spotlight",
        item: "Microphone",
        amount_cents: 100,
        spent_on: "2026-10-14",
      },
    ],
    [
      "/freelance/expenses",
      {
        app: "freelance",
        item: "Tool",
        amount_cents: 100,
        spent_on: "2026-10-14",
      },
    ],
    [
      "/market/expenses",
      {
        app: "market_delivery",
        item: "Fuel",
        amount_cents: 100,
        spent_on: "2026-10-14",
      },
    ],
    [
      "/freelance/gigs",
      {
        platform: "Upwork",
        client: "Fictional client",
        project: "Demo",
        pricing: "fixed",
        gross_cents: 10000,
        fee_cents: 1000,
        hours_x100: 125,
        started_on: "2026-10-14",
        stage: "In progress",
      },
    ],
    [
      "/market/shifts",
      {
        platform: "DoorDash",
        worked_on: "2026-10-14",
        pay_cents: 1000,
        tips_cents: 199,
        minutes_online: 75,
        miles_x10: 123,
      },
    ],
    [
      "/market/sales",
      {
        store: "Printify Shop",
        item: "Demo print",
        sold_on: "2026-10-14",
        price_cents: 2000,
        fee_cents: 100,
        cost_cents: 700,
        ship_cents: 200,
        made_by: "Printify",
        status: "pending",
      },
    ],
  ] as const;
  it.each(workspaceCases)(
    "isolates reads, edits and deletes for %s",
    async (path, data) => {
      const alice = await login("workspace-alice");
      const bob = await login("workspace-bob");
      await request(app).get(`/api${path}`).expect(401);
      await request(app)
        .post(`/api${path}`)
        .set("Origin", origin)
        .send(data)
        .expect(401);
      await request(app)
        .post(`/api${path}`)
        .set("Cookie", alice.cookie)
        .set("Origin", "https://wrong.example")
        .send(data)
        .expect(403);
      const created = await write(alice.cookie, `/api${path}`, data).expect(
        201,
      );
      const id = created.body.row.id;
      expect(
        (await request(app).get(`/api${path}`).set("Cookie", bob.cookie)).body
          .rows,
      ).toEqual([]);
      await request(app)
        .get(`/api${path}?id=${id}`)
        .set("Cookie", bob.cookie)
        .expect(404);
      await request(app)
        .patch(`/api${path}/${id}`)
        .set("Cookie", bob.cookie)
        .set("Origin", origin)
        .send(data)
        .expect(404);
      await request(app)
        .delete(`/api${path}/${id}`)
        .set("Cookie", bob.cookie)
        .set("Origin", origin)
        .send({})
        .expect(404);
      const updated = await request(app)
        .patch(`/api${path}/${id}`)
        .set("Cookie", alice.cookie)
        .set("Origin", origin)
        .send(data)
        .expect(200);
      for (const [key, value] of Object.entries(data))
        expect(updated.body.row[key]).toEqual(value);
      expect(
        (await request(app).get("/api/me/stats").set("Cookie", alice.cookie))
          .body.xp,
      ).toBe(0);
      await request(app)
        .delete(`/api${path}/${id}`)
        .set("Cookie", alice.cookie)
        .set("Origin", origin)
        .send({})
        .expect(204);
    },
  );
  it.each([-1, 1.5, 1000001])(
    "rejects invalid workspace money %s",
    async (amount) => {
      const alice = await login("workspace-invalid");
      for (const [path, data] of workspaceCases) {
        const field = Object.keys(data).find((key) => key.endsWith("_cents"))!;
        await write(alice.cookie, `/api${path}`, {
          ...data,
          [field]: amount,
        }).expect(400);
      }
    },
  );
  it("rejects excessive fees on creates and partial edits", async () => {
    const alice = await login("fees");
    const [path, data] = workspaceCases[5];
    await write(alice.cookie, `/api${path}`, {
      ...data,
      fee_cents: 10001,
    }).expect(400);
    const row = (await write(alice.cookie, `/api${path}`, data).expect(201))
      .body.row;
    await request(app)
      .patch(`/api${path}/${row.id}`)
      .set("Cookie", alice.cookie)
      .set("Origin", origin)
      .send({ gross_cents: 999 })
      .expect(400);
  });
  it("creates one paid income row when a brand deal is paid concurrently or repeatedly", async () => {
    const alice = await login("deal-paid");
    const [path, data] = workspaceCases[1];
    const deal = (await write(alice.cookie, `/api${path}`, data).expect(201))
      .body.row;
    const paid = () =>
      request(app)
        .patch(`/api${path}/${deal.id}`)
        .set("Cookie", alice.cookie)
        .set("Origin", origin)
        .send({ stage: "Paid" });
    expect(
      (await Promise.all([paid(), paid(), paid()])).map((r) => r.status),
    ).toEqual([200, 200, 200]);
    const income = (
      await request(app)
        .get("/api/spotlight/income")
        .set("Cookie", alice.cookie)
    ).body.rows;
    expect(income).toHaveLength(1);
    expect(income[0]).toMatchObject({
      brand_deal_id: deal.id,
      amount_cents: 5000,
      status: "paid",
      paid_on: "2026-10-14",
      earned_on: "2026-10-14",
    });
  });
  it("uses the player's local month for workspace summaries", async () => {
    const alice = await login("workspace-month");
    gameNow = new Date("2026-11-01T02:00:00Z");
    await write(alice.cookie, "/api/me/time-zone", {
      timeZone: "Pacific/Honolulu",
    }).expect(200);
    const [path, data] = workspaceCases[0];
    await write(alice.cookie, `/api${path}`, {
      ...data,
      earned_on: "2026-10-31",
    }).expect(201);
    await write(alice.cookie, `/api${path}`, {
      ...data,
      earned_on: "2026-11-01",
      amount_cents: 10000,
    }).expect(201);
    const result = await request(app)
      .get("/api/spotlight/summary")
      .set("Cookie", alice.cookie)
      .expect(200);
    expect(result.body).toMatchObject({ month: "2026-10", earnedCents: 199 });
    expect(
      (
        await request(app)
          .get("/api/spotlight/summary?month=2026-11")
          .set("Cookie", alice.cookie)
      ).body.earnedCents,
    ).toBe(10000);
  });
  it("cascades workspace rows on player deletion", async () => {
    const alice = await login("workspace-cascade");
    for (const [path, data] of workspaceCases)
      await write(alice.cookie, `/api${path}`, data).expect(201);
    await prisma.player.delete({ where: { id: alice.player.id } });
    for (const table of [
      "creator_income",
      "brand_deals",
      "expenses",
      "freelance_gigs",
      "delivery_shifts",
      "sales",
    ]) {
      const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT count(*) AS count FROM ${table}`,
      );
      expect(Number(rows[0].count)).toBe(0);
    }
  });
  function parseBinary(
    response: NodeJS.ReadableStream,
    callback: (error: Error | null, data?: Buffer) => void,
  ) {
    const chunks: Buffer[] = [];
    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    response.on("end", () => callback(null, Buffer.concat(chunks)));
    response.on("error", callback);
  }
  it("exports only the current player's data and makes Summary agree with monthly workspace totals", async () => {
    const alice = await login("export-alice"),
      bob = await login("export-bob");
    await write(alice.cookie, "/api/spotlight/income", {
      ...workspaceCases[0][1],
      note: "=ALICE()",
    }).expect(201);
    await write(bob.cookie, "/api/spotlight/income", {
      ...workspaceCases[0][1],
      note: "BOB PRIVATE",
      amount_cents: 999999,
    }).expect(201);
    await write(alice.cookie, "/api/entries", validEntry).expect(201);
    await prisma.payout.createMany({
      data: [
        {
          playerId: alice.player.id,
          rungCents: 10,
          amountCents: 10,
          status: "queued",
          createdAt: new Date("2026-10-14T20:00:00Z"),
        },
        {
          playerId: alice.player.id,
          rungCents: 20,
          amountCents: 10,
          status: "queued",
          createdAt: new Date("2026-09-14T20:00:00Z"),
        },
      ],
    });
    const file = await request(app)
      .get("/api/exports?tab=spotlight&format=csv")
      .set("Cookie", alice.cookie)
      .expect(200);
    expect(file.text).toContain("'=ALICE()");
    expect(file.text).toContain('"1.99"');
    expect(file.text).not.toContain("BOB PRIVATE");
    expect(file.headers["content-disposition"]).toContain(
      "onedime-spotlight-2026-10-14.csv",
    );
    const archive = await request(app)
      .get("/api/exports?tab=all&format=zip&month=2026-10")
      .set("Cookie", alice.cookie)
      .buffer(true)
      .parse(parseBinary)
      .expect(200);
    const files = unzipSync(archive.body);
    const payoutCsv = strFromU8(files["payouts.csv"]);
    expect(payoutCsv).toContain("2026-10-14");
    expect(payoutCsv).not.toContain("2026-09-14");
    const text = Object.values(files).map(strFromU8).join("\n");
    expect(text).not.toContain("BOB PRIVATE");
    expect(text).not.toContain(bob.player.id);
    const total = (
      await request(app)
        .get("/api/spotlight/summary?month=2026-10")
        .set("Cookie", alice.cookie)
    ).body;
    expect(strFromU8(files["Summary.csv"])).toContain(
      `"spotlight","2026-10","${(total.earnedCents / 100).toFixed(2)}","0.00","1.99","0.00","0.00","1.99"`,
    );
    const market = await request(app)
      .get("/api/exports?tab=market&format=xlsx")
      .set("Cookie", alice.cookie)
      .buffer(true)
      .parse(parseBinary)
      .expect(200);
    const workbook = strFromU8(unzipSync(market.body)["xl/workbook.xml"]);
    expect(workbook).toContain('name="Delivery"');
    expect(workbook).toContain('name="Selling"');
  });
  it("validates export filters and rate limits exports without blocking other reads", async () => {
    const alice = await login("export-limit");
    await request(app).get("/api/exports?tab=first&format=csv").expect(401);
    for (const query of [
      "tab=first&format=csv&playerId=other",
      "tab=first&format=csv&month=2026-13",
      "tab=first&format=csv&from=2026-10-15&to=2026-10-14",
      "tab=all&format=csv",
    ]) {
      await request(app)
        .get(`/api/exports?${query}`)
        .set("Cookie", alice.cookie)
        .expect(400);
    }
    for (let i = 0; i < 6; i++)
      await request(app)
        .get("/api/exports?tab=first&format=csv")
        .set("Cookie", alice.cookie)
        .expect(200);
    await request(app)
      .get("/api/exports?tab=first&format=csv")
      .set("Cookie", alice.cookie)
      .expect(429);
    await request(app)
      .get("/api/entries")
      .set("Cookie", alice.cookie)
      .expect(200);
  });
  const activityCsv = (
    id = "PAYPAL-DEMO",
    payer = "Hyperwallet",
    currency = "USD",
    gross = "1.99",
    fee = "0.00",
    net = "1.99",
  ) =>
    `Date,Name,Gross,Fee,Net,Currency,Transaction ID,Type,Email,IP Address\n10/14/2026,${payer},${gross},${fee},${net},${currency},${id},General Payment,discard@example.test,192.0.2.1`;
  const activity = (cookie: string) =>
    request(app).get("/api/paypal/transactions").set("Cookie", cookie);
  it("imports whitelisted fields once per player and isolates routing", async () => {
    const alice = await login("paypal-alice"),
      bob = await login("paypal-bob");
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv(),
    }).expect(200, {
      added: 1,
      duplicates: 0,
    });
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv(),
    }).expect(200, {
      added: 0,
      duplicates: 1,
    });
    const rows = (await activity(alice.cookie).expect(200)).body.rows;
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("discard@example.test");
    expect((await activity(bob.cookie)).body.rows).toEqual([]);
    await write(bob.cookie, `/api/paypal/transactions/${rows[0].id}/route`, {
      record_type: "first",
      platform: "Prolific",
    }).expect(404);
    const owned = (
      await write(bob.cookie, "/api/entries", validEntry).expect(201)
    ).body.entry;
    await write(alice.cookie, `/api/paypal/transactions/${rows[0].id}/route`, {
      record_type: "first",
      platform: "Prolific",
      record_id: owned.id,
    }).expect(404);
    const route = () =>
      write(alice.cookie, `/api/paypal/transactions/${rows[0].id}/route`, {
        record_type: "first",
        platform: "Prolific",
      });
    expect(
      (await Promise.all([route(), route(), route()])).map(
        (result) => result.status,
      ),
    ).toEqual([200, 200, 200]);
    const entries = await prisma.logEntry.findMany({
      where: { playerId: alice.player.id },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      amountCents: 199,
      verified: true,
      verificationSource: "paypal_csv",
    });
    const claims = await prisma.rungClaim.count();
    expect(claims).toBe(2);
    await request(app)
      .delete(`/api/entries/${entries[0].id}`)
      .set("Cookie", alice.cookie)
      .set("Origin", origin)
      .send({})
      .expect(204);
    expect((await activity(alice.cookie)).body.rows[0]).toMatchObject({
      routed_app: null,
      routed_record_id: null,
    });
    expect(await prisma.rungClaim.count()).toBe(claims);
  });
  it.each([
    ["gross", 1000, true],
    ["net", 970, true],
    ["another amount", 985, false],
  ])(
    "checks a fee-bearing payment against the logged %s amount",
    async (_kind, amountCents, verified) => {
      const alice = await login("paypal-fee-match");
      const entry = (
        await write(alice.cookie, "/api/entries", {
          ...validEntry,
          platform: "Prolific",
          amountCents,
        }).expect(201)
      ).body.entry;
      await write(alice.cookie, "/api/paypal/import", {
        csv: activityCsv(
          "FEE-MATCH",
          "Hyperwallet",
          "USD",
          "10.00",
          "-0.30",
          "9.70",
        ),
      }).expect(200);
      const payment = (await activity(alice.cookie)).body.rows[0];
      const routed = await write(
        alice.cookie,
        `/api/paypal/transactions/${payment.id}/route`,
        {
          record_type: "first",
          platform: "Prolific",
          record_id: entry.id,
        },
      ).expect(200);
      expect(routed.body.mismatch).toBe(!verified);
      expect(
        await prisma.logEntry.findUniqueOrThrow({ where: { id: entry.id } }),
      ).toMatchObject({
        amountCents,
        verified,
        verificationSource: verified ? "paypal_csv" : null,
      });
      expect((await activity(alice.cookie)).body.rows[0]).toMatchObject({
        gross_cents: 1000,
        fee_cents: 30,
        net_cents: 970,
        mismatch: !verified,
      });
      const financial=(await request(app).get("/api/overview?month=2026-10").set("Cookie",alice.cookie)).body.rows[0];
      expect(financial).toMatchObject(verified
        ? {earnedCents:1000,paidCents:970,feesCents:30,netCents:970,pendingCents:0}
        : {earnedCents:985,paidCents:0,feesCents:0,netCents:985,pendingCents:985});
      const archive=await request(app).get("/api/exports?tab=all&format=zip&month=2026-10")
        .set("Cookie",alice.cookie).buffer(true).parse(parseBinary).expect(200);
      expect(strFromU8(unzipSync(archive.body)["Summary.csv"]))
        .toContain(verified?'"first","2026-10","10.00","9.70","0.00","0.30","0.00","9.70"':'"first","2026-10","9.85","0.00","9.85","0.00","0.00","9.85"');
    },
  );
  it.each([1000, 970])("counts a linked %i-cent entry as paid in the payment month", async amountCents => {
    const alice = await login("paypal-payment-month");
    const entry = (await write(alice.cookie, "/api/entries", {
      ...validEntry, platform: "Prolific", amountCents, workedOn: "2026-09-30",
    }).expect(201)).body.entry;
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv("NEXT-MONTH", "Hyperwallet", "USD", "10.00", "-0.30", "9.70"),
    }).expect(200);
    const payment = (await activity(alice.cookie)).body.rows[0];
    await write(alice.cookie, `/api/paypal/transactions/${payment.id}/route`, {
      record_type: "first", platform: "Prolific", record_id: entry.id,
    }).expect(200);
    for (const [month, expected] of [
      ["2026-09", { earnedCents: 1000, paidCents: 0, feesCents: 30, netCents: 970 }],
      ["2026-10", { earnedCents: 0, paidCents: 970, feesCents: 0, netCents: 0 }],
    ] as const) {
      const result = await request(app).get(`/api/overview?month=${month}`)
        .set("Cookie", alice.cookie).expect(200);
      expect(result.body.rows[0]).toMatchObject({ app: "first", ...expected, pendingCents: 0 });
      expect(result.body.rows.at(-1)).toMatchObject({ app: "total", ...expected, pendingCents: 0 });
    }
    for (const filter of ["", "&month=2026-10", "&from=2026-10-01&to=2026-10-31"]) {
      const archive = await request(app).get(`/api/exports?tab=all&format=zip${filter}`)
        .set("Cookie", alice.cookie).buffer(true).parse(parseBinary).expect(200);
      const totals = strFromU8(unzipSync(archive.body)["Summary.csv"]);
      expect(totals).toContain('"first","2026-10","0.00","9.70","0.00","0.00","0.00","0.00"');
      if (!filter) expect(totals)
        .toContain('"first","2026-09","10.00","0.00","0.00","0.30","0.00","9.70"');
      else expect(totals).not.toContain('"first","2026-09"');
    }
  });
  it("allows one payment to verify only one entry even when gross and net race", async () => {
    const alice = await login("paypal-single-verification");
    const entries = [];
    for (const amountCents of [1000, 970]) {
      entries.push(
        (
          await write(alice.cookie, "/api/entries", {
            ...validEntry,
            platform: "Prolific",
            amountCents,
          }).expect(201)
        ).body.entry,
      );
    }
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv(
        "ONLY-ONE",
        "Hyperwallet",
        "USD",
        "10.00",
        "-0.30",
        "9.70",
      ),
    }).expect(200);
    const payment = (await activity(alice.cookie)).body.rows[0];
    const route = (recordId: string) =>
      write(alice.cookie, `/api/paypal/transactions/${payment.id}/route`, {
        record_type: "first",
        platform: "Prolific",
        record_id: recordId,
      });
    const responses = await Promise.all(
      entries.map((entry) => route(entry.id)),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const verifiedEntries = await prisma.logEntry.findMany({
      where: { playerId: alice.player.id, verified: true },
    });
    expect(verifiedEntries).toHaveLength(1);
    const loser = entries.find((entry) => entry.id !== verifiedEntries[0].id)!;
    await route(loser.id).expect(409);
    expect(
      await prisma.logEntry.count({
        where: { playerId: alice.player.id, verified: true },
      }),
    ).toBe(1);
    expect((await activity(alice.cookie)).body.rows[0].routed_record_id).toBe(
      verifiedEntries[0].id,
    );
  });
  it("does not verify unmatched payers or mismatched existing amounts", async () => {
    const alice = await login("paypal-match");
    const entry = (
      await write(alice.cookie, "/api/entries", {
        ...validEntry,
        platform: "Prolific",
      }).expect(201)
    ).body.entry;
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv(),
    }).expect(200);
    const row = (await activity(alice.cookie)).body.rows[0];
    await write(alice.cookie, `/api/paypal/transactions/${row.id}/route`, {
      record_type: "first",
      platform: "Prolific",
      record_id: entry.id,
    }).expect(200);
    expect(
      await prisma.logEntry.findUniqueOrThrow({ where: { id: entry.id } }),
    ).toMatchObject({
      amountCents: 123,
      verified: false,
    });
    expect((await activity(alice.cookie)).body.rows[0].mismatch).toBe(true);
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv("PAYPAL-UNKNOWN", "Unknown payer"),
    }).expect(200);
    const other = (await activity(alice.cookie)).body.rows.find(
      (p: { txn_id: string }) => p.txn_id === "PAYPAL-UNKNOWN",
    );
    await write(alice.cookie, `/api/paypal/transactions/${other.id}/route`, {
      record_type: "first",
      platform: "Prolific",
    }).expect(200);
    expect(
      await prisma.logEntry.count({
        where: { playerId: alice.player.id, verified: true },
      }),
    ).toBe(0);
  });
  it("lists non-USD activity without permitting routing", async () => {
    const alice = await login("paypal-eur");
    await write(alice.cookie, "/api/paypal/import", {
      csv: activityCsv("EUR-DEMO", "Hyperwallet", "EUR"),
    }).expect(200);
    const row = (await activity(alice.cookie)).body.rows[0];
    expect(row.eligible).toBe(false);
    await write(alice.cookie, `/api/paypal/transactions/${row.id}/route`, {
      record_type: "first",
      platform: "Prolific",
    }).expect(400);
  });
  it.each([
    ["income", "YouTube", "/spotlight/income"],
    ["gigs", "Upwork", "/freelance/gigs"],
    ["shifts", "Uber", "/market/shifts"],
    ["sales", "eBay", "/market/sales"],
  ])(
    "routes and unlinks %s without granting game XP",
    async (recordType, platform, path) => {
      const alice = await login(`paypal-${recordType}`);
      await write(alice.cookie, "/api/paypal/import", {
        csv: activityCsv(
          "ROUTE-DEMO",
          "Demo payer",
          "USD",
          "20.00",
          "-1.00",
          "19.00",
        ),
      }).expect(200);
      const payment = (await activity(alice.cookie)).body.rows[0];
      const result = await write(
        alice.cookie,
        `/api/paypal/transactions/${payment.id}/route`,
        {
          record_type: recordType,
          platform,
        },
      ).expect(200);
      const id = result.body.transaction.routed_record_id;
      expect(
        (await request(app).get(`/api${path}`).set("Cookie", alice.cookie)).body
          .rows,
      ).toHaveLength(1);
      expect(
        (await request(app).get("/api/me/stats").set("Cookie", alice.cookie))
          .body.xp,
      ).toBe(0);
      await request(app)
        .delete(`/api${path}/${id}`)
        .set("Cookie", alice.cookie)
        .set("Origin", origin)
        .send({})
        .expect(204);
      expect(
        (await activity(alice.cookie)).body.rows[0].routed_record_id,
      ).toBeNull();
    },
  );
  it("reserves an idempotent payout outbox before API calls and retries with identical keys", async () => {
    const alice = await login("payout");
    await prisma.logEntry.create({
      data: {
        ...validEntry,
        playerId: alice.player.id,
        amountCents: 10,
        verified: true,
        workedOn: new Date("2026-10-14"),
      },
    });
    await prisma.$transaction((tx) => claimEligibleRungs(tx, alice.player.id));
    const outbox = await prisma.payout.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ amountCents: 10, status: "ready" });
    const client: PayoutClient = {
      create: vi
        .fn()
        .mockRejectedValueOnce(new Error("temporary"))
        .mockResolvedValue({ id: "BATCH-DEMO", status: "PENDING" }),
      verify: vi.fn(async () => true),
    };
    const off = createPayoutService(
      prisma,
      { ...testConfig, payoutsEnabled: false },
      client,
      () => gameNow,
    );
    await off(alice.player.id);
    expect(client.create).not.toHaveBeenCalled();
    const flush = createPayoutService(
      prisma,
      { ...testConfig, payoutsEnabled: true },
      client,
      () => gameNow,
    );
    await flush(alice.player.id);
    await prisma.player.update({
      where: { id: alice.player.id },
      data: { email: "changed@example.test" },
    });
    await Promise.all([flush(alice.player.id), flush(alice.player.id)]);
    await flush(alice.player.id);
    expect(client.create).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(client.create).mock.calls;
    expect(calls[0][0]).toEqual(calls[1][0]);
    expect(calls[0][0].items[0]).toMatchObject({
      amount: { value: "0.10", currency: "USD" },
      receiver: "payout@example.com",
    });
    expect((await prisma.payout.findMany())[0]).toMatchObject({
      status: "PENDING",
      paypalBatchId: "BATCH-DEMO",
    });
  });
  it("rejects failed webhook signatures and processes an event only once", async () => {
    const alice = await login("webhook");
    const payout = await prisma.payout.create({
      data: {
        playerId: alice.player.id,
        rungCents: 10,
        amountCents: 10,
        senderBatchId: "webhook-demo",
        paypalBatchId: "BATCH-HOOK",
        status: "PENDING",
      },
    });
    const client: PayoutClient = {
      create: vi.fn(),
      verify: vi.fn(async () => false),
    };
    const { createApp } = await import("../src/server.js");
    const on = createApp({
      config: { ...testConfig, payoutsEnabled: true },
      prisma,
      paypalClient,
      payoutClient: client,
    });
    const event = {
      id: "EVENT-DEMO",
      event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS",
      resource: { batch_header: { payout_batch_id: "BATCH-HOOK" } },
    };
    await request(on).post("/api/paypal/webhook").send(event).expect(401);
    vi.mocked(client.verify).mockResolvedValue(true);
    await request(on).post("/api/paypal/webhook").send(event).expect(200);
    await request(on)
      .post("/api/paypal/webhook")
      .send({ ...event, event_type: "PAYMENT.PAYOUTSBATCH.DENIED" })
      .expect(200);
    expect(await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } }))
      .toMatchObject({ status: "PENDING", batchStatus: "SUCCESS" });
    const events = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) AS count FROM webhook_events`;
    expect(Number(events[0].count)).toBe(1);
    vi.mocked(client.verify).mockClear();
    const off = createApp({
      config: { ...testConfig, payoutsEnabled: false },
      prisma,
      paypalClient,
      payoutClient: client,
    });
    await request(off).post("/api/paypal/webhook").send(event).expect(503);
    expect(client.verify).not.toHaveBeenCalled();
  });
  it("keeps the item pending when create reports a completed batch", async () => {
    const alice = await login("created-batch-success");
    const payout = await prisma.payout.create({data:{playerId:alice.player.id,rungCents:10,
      amountCents:10,status:"ready",senderBatchId:"created-batch",recipientEmail:"fake@example.test"}});
    const client:PayoutClient={create:vi.fn(async()=>({id:"CREATED-BATCH",status:"SUCCESS"})),verify:vi.fn()};
    await createPayoutService(prisma,{...testConfig,payoutsEnabled:true},client,()=>gameNow)(alice.player.id);
    expect(await prisma.payout.findUniqueOrThrow({where:{id:payout.id}}))
      .toMatchObject({status:"PENDING",batchStatus:"SUCCESS"});
  });
  it.each(["SUCCESS", "DENIED"])("preserves early batch %s when the create response arrives later", async batchStatus => {
    const alice=await login("early-batch");
    const payout=await prisma.payout.create({data:{playerId:alice.player.id,rungCents:10,
      amountCents:10,status:"ready",senderBatchId:"early-batch",recipientEmail:"fake@example.test"}});
    const {createApp}=await import("../src/server.js");
    const client:PayoutClient={create:vi.fn(async()=>{
      await request(on).post("/api/paypal/webhook").send({id:"EARLY-BATCH-EVENT",
        event_type:`PAYMENT.PAYOUTSBATCH.${batchStatus}`,resource:{batch_header:{payout_batch_id:"EARLY-BATCH",
          sender_batch_header:{sender_batch_id:"early-batch"}}}}).expect(200);
      return {id:"EARLY-BATCH",status:"PROCESSING"};
    }),verify:vi.fn(async()=>true)};
    const on=createApp({config:{...testConfig,payoutsEnabled:true},prisma,paypalClient,payoutClient:client});
    await createPayoutService(prisma,{...testConfig,payoutsEnabled:true},client,()=>gameNow)(alice.player.id);
    expect(await prisma.payout.findUniqueOrThrow({where:{id:payout.id}}))
      .toMatchObject({status:"PENDING",batchStatus,paypalBatchId:"EARLY-BATCH"});
  });
  it.each(["FAILED", "DENIED", "CANCELED", "BLOCKED", "HELD"])(
    "applies item %s after batch success and exposes the owned item state", async (status) => {
      const alice = await login("item-status");
      const bob = await login("other-item-status");
      const payout = await prisma.payout.create({data:{playerId:alice.player.id,
        rungCents:10,amountCents:10,status:"PENDING",paypalBatchId:"BATCH-STATUS"}});
      const { createApp } = await import("../src/server.js");
      const on = createApp({config:{...testConfig,payoutsEnabled:true},prisma,paypalClient,
        payoutClient:{create:vi.fn(),verify:vi.fn(async()=>true)}});
      const send = (id:string,type:string) => request(on).post("/api/paypal/webhook").send({
        id,event_type:type,resource:{payout_batch_id:"BATCH-STATUS",payout_item:{sender_item_id:payout.id}}});
      await send("BATCH-DONE","PAYMENT.PAYOUTSBATCH.SUCCESS").expect(200);
      expect((await prisma.payout.findUniqueOrThrow({where:{id:payout.id}})).status).toBe("PENDING");
      await send("ITEM-STATE",`PAYMENT.PAYOUTS-ITEM.${status}`).expect(200);
      expect((await activity(alice.cookie)).body.payouts[0]).toMatchObject({status,batchStatus:"SUCCESS"});
      expect((await activity(bob.cookie)).body.payouts).toEqual([]);
      await send("ITEM-STATE","PAYMENT.PAYOUTS-ITEM.SUCCEEDED").expect(200);
      expect((await prisma.payout.findUniqueOrThrow({where:{id:payout.id}})).status).toBe(status);
      await send("LATER-SUCCESS","PAYMENT.PAYOUTS-ITEM.SUCCEEDED").expect(200);
      expect((await prisma.payout.findUniqueOrThrow({where:{id:payout.id}})).status)
        .toBe(status==="HELD"?"SUCCESS":status);
    });
  it("stores feedback for each app and returns only a thank-you acknowledgement", async () => {
    const alice = await login("feedback-apps");
    for (const appKey of ["first", "spotlight", "freelance", "market", "paypal"]) {
      await write(alice.cookie, "/api/feedback", { app: appKey, body: "  Fictional beta feedback.  " })
        .expect(201, { ok: true });
    }
    const rows = await prisma.feedback.findMany();
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.playerId === alice.player.id && row.body === "Fictional beta feedback."
      && !row.blocking && row.status === "new")).toBe(true);
    expect(await prisma.logEntry.count()).toBe(0);
    expect(await prisma.rungClaim.count()).toBe(0);
  });
  it.each([
    { app: "first", body: "" },
    { app: "first", body: "   " },
    { app: "first", body: "x".repeat(1001) },
    { app: "first", body: "bad\0text" },
    { app: "admin", body: "Fictional feedback" },
    { app: "first", body: "Fictional feedback", blocking: "yes" },
    { app: "first", body: "Fictional feedback", playerId: "another-player" },
    { app: "first", body: "Fictional feedback", status: "fixed" },
  ])("rejects invalid or unowned feedback fields: %j", async body => {
    const alice = await login("feedback-invalid");
    await write(alice.cookie, "/api/feedback", body).expect(400);
    expect(await prisma.feedback.count()).toBe(0);
  });
  it("requires JSON and same-origin requests for feedback", async () => {
    const alice = await login("feedback-guards");
    const body = { app: "first", body: "Fictional feedback" };
    await request(app).post("/api/feedback").set("Cookie", alice.cookie).set("Origin", origin)
      .type("form").send(body).expect(415);
    await request(app).post("/api/feedback").set("Cookie", alice.cookie).send(body).expect(403);
    await request(app).post("/api/feedback").set("Cookie", alice.cookie).set("Origin", "https://other.example.test")
      .send(body).expect(403);
    await request(app).post("/api/feedback").set("Cookie", alice.cookie).set("Origin", origin)
      .set("Sec-Fetch-Site", "cross-site").send(body).expect(403);
    expect(await prisma.feedback.count()).toBe(0);
  });
  it("accepts exactly one thousand feedback characters", async () => {
    const alice = await login("feedback-boundary");
    await write(alice.cookie, "/api/feedback", { app: "first", body: "x".repeat(1000) }).expect(201);
    expect((await prisma.feedback.findFirstOrThrow()).body).toHaveLength(1000);
  });
  it("exports persisted feedback without account metadata and honors the explicit database", async () => {
    const alice = await login("feedback-export");
    await write(alice.cookie, "/api/feedback", { app: "market", body: "Fictional export note", blocking: true }).expect(201);
    const directory = mkdtempSync(join(tmpdir(), "onedime-feedback-test-"));
    try {
      writeFileSync(join(directory, ".env"), "DATABASE_URL=postgresql://fictional:unused@127.0.0.1:1/missing_test\n");
      const output = execFileSync(process.execPath,
        [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/export-feedback.ts")],
        { cwd: directory, env: process.env, encoding: "utf8" });
      expect(output).toMatch(/^feedback exported to feedback\/feedback-\d{4}-\d{2}-\d{2}\.md\s*$/);
      const filenames = readdirSync(join(directory, "feedback"));
      expect(filenames).toHaveLength(1);
      expect(filenames[0]).toMatch(/^feedback-\d{4}-\d{2}-\d{2}\.md$/);
      const report = readFileSync(join(directory, "feedback", filenames[0]), "utf8");
      expect(report).toContain("## Market");
      expect(report).toContain("Fictional export note");
      expect(report).toContain("- Blocking: yes");
      expect(report).toMatch(/- Player: player-[a-f0-9]{12}/);
      for (const value of [alice.player.id, alice.player.displayName!, alice.player.email!]) {
        expect(report).not.toContain(value);
      }
      expect(await prisma.feedback.count()).toBe(1);
    } finally {
      const feedbackDirectory = join(directory, "feedback");
      if (existsSync(feedbackDirectory)) {
        for (const name of readdirSync(feedbackDirectory)) unlinkSync(join(feedbackDirectory, name));
        rmdirSync(feedbackDirectory);
      }
      unlinkSync(join(directory, ".env"));
      rmdirSync(directory);
    }
  }, 20_000);
  it("keeps database details out of failed feedback export output", () => {
    const databaseUrl = "postgresql://fictional_export_user:fictional_export_password@127.0.0.1:1/missing_test";
    const result = spawnSync(process.execPath,
      [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/export-feedback.ts")],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("feedback export failed; check database configuration and migrations privately");
    for (const value of [databaseUrl, "fictional_export_user", "fictional_export_password"]) {
      expect(result.stdout + result.stderr).not.toContain(value);
    }
  }, 20_000);
  it("allows at most five concurrent feedback submissions per player per rolling hour", async () => {
    const alice = await login("feedback-limit"), bob = await login("feedback-other");
    const body = { app: "paypal", body: "Fictional blocked action", blocking: true };
    const responses = await Promise.all(Array.from({ length: 6 }, () => write(alice.cookie, "/api/feedback", body)));
    expect(responses.map(row => row.status).sort()).toEqual([201, 201, 201, 201, 201, 429]);
    const limited = responses.find(row => row.status === 429)!;
    expect(limited.headers["retry-after"]).toBe("3600");
    expect(limited.body).toEqual({ error: "feedback_rate_limited" });
    await write(bob.cookie, "/api/feedback", body).expect(201);
    const rows = await prisma.feedback.findMany({ where: { playerId: alice.player.id } });
    expect(rows).toHaveLength(5);
    expect(rows.every(row => row.blocking)).toBe(true);
    const { createApp } = await import("../src/server.js");
    const restarted = createApp({ prisma, config: testConfig, paypalClient, now: () => gameNow });
    await request(restarted).post("/api/feedback").set("Cookie", alice.cookie).set("Origin", origin).send(body).expect(429);
    gameNow = new Date(gameNow.getTime() + 60 * 60 * 1000 - 1);
    await write(alice.cookie, "/api/feedback", body).expect(429);
    gameNow = new Date(gameNow.getTime() + 1);
    await write(alice.cookie, "/api/feedback", body).expect(201);
  });
  it("does not expose any player's feedback through HTTP", async () => {
    const alice = await login("feedback-private"), bob = await login("feedback-viewer");
    const body = "Fictional private feedback";
    await write(alice.cookie, "/api/feedback", { app: "market", body }).expect(201);
    const row = await prisma.feedback.findFirstOrThrow();
    for (const route of ["/api/feedback", `/api/feedback/${row.id}`, `/api/feedback?playerId=${alice.player.id}`]) {
      const response = await request(app).get(route).set("Cookie", bob.cookie).expect(404);
      expect(response.text).not.toContain(body);
    }
    await request(app).patch(`/api/feedback/${row.id}`).set("Cookie", bob.cookie).set("Origin", origin)
      .send({ status: "fixed" }).expect(404);
  });
  it("redirects public policy routes to the Google Sites policies", async () => {
    for (const [route, url] of [
      ["privacy", "https://sites.google.com/view/onedime-privacy-policy/home"],
      ["terms", "https://sites.google.com/view/onedime-user-agreement/home"],
    ]) {
      await request(app).get(`/${route}`).expect(302).expect("Location", url);
      await request(app).get(`/${route}?next=https://other.example.test`).expect(302).expect("Location", url);
      await request(app).get(`/${route}.html`).expect(404);
    }
  });
  it.each(["TaskRabbit","Rover","Thumbtack"])("accepts %s shifts without awarding game progression",async platform=>{
    const alice=await login("service-platform");
    const body=workspaceCases.find(([path])=>path==="/market/shifts")![1];
    await write(alice.cookie,"/api/market/shifts",{...body,platform}).expect(201);
    expect(await prisma.logEntry.count()).toBe(0);
  });
  it("totals one owned month without adding imported PayPal activity twice",async()=>{
    const alice=await login("overview-alice"),bob=await login("overview-bob");
    await write(alice.cookie,"/api/entries",validEntry).expect(201);
    await write(bob.cookie,"/api/entries",{...validEntry,amountCents:999999}).expect(201);
    await write(alice.cookie,"/api/spotlight/income",workspaceCases[0][1]).expect(201);
    await write(alice.cookie,"/api/paypal/import",{csv:activityCsv()}).expect(200);
    const result=(await request(app).get("/api/overview?month=2026-10").set("Cookie",alice.cookie).expect(200)).body;
    expect(result.rows.at(-1)).toMatchObject({app:"total",earnedCents:322,pendingCents:322,paidCents:0,netCents:322});
    const older=(await request(app).get("/api/overview?month=2026-09").set("Cookie",alice.cookie).expect(200)).body;
    expect(older.rows.at(-1).earnedCents).toBe(0);
    await request(app).get("/api/overview?month=2026-13").set("Cookie",alice.cookie).expect(400);
    await request(app).get("/api/overview").expect(401);
  });
  it("deletes every owned row after exact typed confirmation and ends the session",async()=>{
    const alice=await login("delete-alice"),bob=await login("delete-bob");
    for(const [path,body] of workspaceCases) await write(alice.cookie,`/api${path}`,body).expect(201);
    const entry=(await write(alice.cookie,"/api/entries",validEntry).expect(201)).body.entry;
    await write(bob.cookie,"/api/entries",validEntry).expect(201);
    await write(alice.cookie,"/api/feedback",{app:"first",body:"Fictional deletion feedback"}).expect(201);
    await write(bob.cookie,"/api/feedback",{app:"paypal",body:"Fictional retained feedback"}).expect(201);
    await prisma.receipt.create({data:{playerId:alice.player.id,logEntryId:entry.id,status:"fixture"}});
    await prisma.questProgress.create({data:{playerId:alice.player.id,questId:"fixture-quest"}});
    await prisma.rungClaim.create({data:{playerId:alice.player.id,rungCents:10}});
    await prisma.payout.create({data:{playerId:alice.player.id,rungCents:10,status:"ready",amountCents:10}});
    await write(alice.cookie,"/api/paypal/import",{csv:activityCsv()}).expect(200);
    const remove=(body:unknown)=>request(app).delete("/api/settings/data").set("Cookie",alice.cookie).set("Origin",origin).send(body);
    await remove({confirmation:"delete"}).expect(400);
    await remove({confirmation:"DELETE MY DATA",playerId:bob.player.id}).expect(400);
    await request(app).delete("/api/settings/data").set("Cookie",alice.cookie).set("Origin","https://other.example.test")
      .send({confirmation:"DELETE MY DATA"}).expect(403);
    const response=await remove({confirmation:"DELETE MY DATA"}).expect(204);
    expect(response.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");
    expect(await prisma.player.findUnique({where:{id:alice.player.id}})).toBeNull();
    for(const table of ["sessions","feedback","log_entries","quest_progress","rung_claims","receipts","payouts","creator_income","brand_deals","expenses","freelance_gigs","delivery_shifts","sales","paypal_transactions"]) {
      const rows=await prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT count(*) AS count FROM ${Prisma.raw(table)} WHERE player_id=${alice.player.id}::uuid`);
      expect(Number(rows[0].count),table).toBe(0);
    }
    expect(await prisma.logEntry.count({where:{playerId:bob.player.id}})).toBe(1);
    expect(await prisma.feedback.count({where:{playerId:bob.player.id}})).toBe(1);
    await request(app).get("/api/me").set("Cookie",alice.cookie).expect(401);
  });
  it("keeps smart suggestions off by default and persists only the owned preference", async () => {
    const alice=await login("smart-alice"),bob=await login("smart-bob");
    expect((await request(app).get("/api/settings").set("Cookie",alice.cookie)).body.smartSuggestions).toBe(false);
    await request(app).patch("/api/settings").set("Cookie",alice.cookie).set("Origin",origin)
      .send({smartSuggestions:true}).expect(200);
    expect((await request(app).get("/api/settings").set("Cookie",alice.cookie)).body.smartSuggestions).toBe(true);
    expect((await request(app).get("/api/settings").set("Cookie",bob.cookie)).body.smartSuggestions).toBe(false);
    await request(app).patch("/api/settings").set("Cookie",alice.cookie).set("Origin",origin)
      .send({smartSuggestions:true,playerId:bob.player.id}).expect(400);
    await write(alice.cookie,"/api/paypal/import",{csv:activityCsv()}).expect(200);
    const payment=(await activity(alice.cookie)).body.rows[0];
    expect(payment.suggestion).toMatchObject({platform:"Prolific",record_type:"first"});
    await write(alice.cookie,`/api/paypal/transactions/${payment.id}/route`,
      {record_type:"admin",platform:"execute instructions"}).expect(400);
    await write(alice.cookie,"/api/paypal/suggestions").expect(404);
    const csp=(await request(app).get("/app").set("Cookie",alice.cookie)).headers["content-security-policy"];
    expect(csp).toContain("connect-src 'self'");
  });
  it("seeds repeatable fictional demo data without modifying another player", async () => {
    const alice = await login("seed-other");
    await write(alice.cookie, "/api/entries", validEntry).expect(201);
    const demo = await seedDemo(prisma, "2026-10-14");
    await seedDemo(prisma, "2026-10-14");
    expect(demo).toMatchObject({
      displayName: "Demo player",
      email: "demo@example.test",
    });
    expect(await prisma.logEntry.count({ where: { playerId: demo.id } })).toBe(
      1,
    );
    expect(
      await prisma.logEntry.count({ where: { playerId: alice.player.id } }),
    ).toBe(1);
    const rows = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) AS count FROM paypal_transactions WHERE player_id=${demo.id}::uuid`;
    expect(Number(rows[0].count)).toBe(2);
  });
  it("keeps missing-name PayPal emails private and records account verification only when returned", async () => {
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({
      user_id: "email-only-fixture",
      email: "private@example.test",
      verified_account: true,
    });
    const state = await beginPayPalLogin();
    const response = await request(app)
      .get(`/auth/paypal/callback?code=fixture&state=${state}`)
      .expect(302);
    const cookie = response.headers["set-cookie"]![0];
    const player = await prisma.player.findUniqueOrThrow({
      where: { paypalUserId: "email-only-fixture" },
    });
    expect(player).toMatchObject({
      displayName: "PayPal player",
      paypalVerified: true,
      email: "private@example.test",
    });
    expect((await activity(cookie)).body.connection).toMatchObject({
      name: "PayPal player",
      verified: true,
    });
  });
  it("does not retry an ambiguous payout outside the safe idempotency window", async () => {
    const alice = await login("payout-old");
    await prisma.payout.create({
      data: {
        playerId: alice.player.id,
        rungCents: 10,
        amountCents: 10,
        senderBatchId: "old-fixture",
        status: "retry",
        firstAttemptAt: new Date("2026-09-01T00:00:00Z"),
      },
    });
    const client: PayoutClient = { create: vi.fn(), verify: vi.fn() };
    await createPayoutService(
      prisma,
      { ...testConfig, payoutsEnabled: true },
      client,
      () => gameNow,
    )(alice.player.id);
    expect(client.create).not.toHaveBeenCalled();
    expect((await prisma.payout.findMany())[0].status).toBe("manual_review");
  });
  it("reconciles a signed payout item event before the create response arrives", async () => {
    const alice = await login("webhook-early");
    const payout = await prisma.payout.create({
      data: {
        playerId: alice.player.id,
        rungCents: 10,
        amountCents: 10,
        senderBatchId: "early-event",
        status: "sending",
      },
    });
    const client: PayoutClient = {
      create: vi.fn(),
      verify: vi.fn(async () => true),
    };
    const { createApp } = await import("../src/server.js");
    const on = createApp({
      config: { ...testConfig, payoutsEnabled: true },
      prisma,
      paypalClient,
      payoutClient: client,
    });
    await request(on)
      .post("/api/paypal/webhook")
      .send({
        id: "EARLY-EVENT",
        event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        resource: {
          payout_batch_id: "EARLY-BATCH",
          payout_item: { sender_item_id: payout.id },
        },
      })
      .expect(200);
    expect(
      await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } }),
    ).toMatchObject({
      status: "SUCCESS",
      paypalBatchId: "EARLY-BATCH",
    });
  });
  it("rate limits writes per player and permits reads, other players, and later windows", async () => {
    const alice = await login("limit-alice");
    const bob = await login("limit-bob");
    const { createApp } = await import("../src/server.js");
    const limited = createApp({
      config: testConfig,
      prisma,
      paypalClient,
      now: () => gameNow,
      writeLimit: { count: 1, windowMs: 60_000 },
    });
    const send = (cookie: string) =>
      request(limited)
        .post("/api/leaderboard/join")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .send({});
    await send(alice.cookie).expect(200);
    const result = await send(alice.cookie).expect(429);
    expect(result.headers["retry-after"]).toBe("60");
    await request(limited)
      .get("/api/me/stats")
      .set("Cookie", alice.cookie)
      .expect(200);
    await send(bob.cookie).expect(200);
    gameNow = new Date(gameNow.getTime() + 60_000);
    await send(alice.cookie).expect(200);
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
    const target = new URL(process.env.DATABASE_URL);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      !/(^|_)test($|_)/.test(target.pathname.slice(1))
    ) {
      throw new Error(
        "Tests require a local disposable database named test or *_test. Unset DATABASE_URL for Testcontainers.",
      );
    }
    return process.env.DATABASE_URL;
  }

  container = await new PostgreSqlContainer("postgres:16").start();
  return container.getConnectionUri();
}

function runPrismaMigrations(databaseUrl: string): void {
  execSync("npx prisma migrate deploy", {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    shell: true,
    stdio: "inherit",
  });
}


