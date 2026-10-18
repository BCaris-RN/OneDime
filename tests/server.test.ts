import { PrismaClient, Prisma } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import type { PayPalIdentityClient } from "../src/auth/paypal.js";
import { claimEligibleRungs } from "../src/game/rungs.js";

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
let gameNow = new Date("2026-10-14T20:00:00Z");

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
    paypalClient,
    now: () => gameNow,
    // Fixtures exercise quest mechanics, never stand in for the missing pilot.
    quests: [{ id: "fixture-quest", title: "Test fixture only", xp: 50 }]
  });
}, 120_000);

beforeEach(async () => {
  vi.clearAllMocks();
  gameNow = new Date("2026-10-14T20:00:00Z");
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
      .set("Origin", testConfig.publicBaseUrl)
      .send({})
      .expect(204);

    expect(logoutResponse.headers["set-cookie"]?.[0]).toContain("onedime_session=;");
    await expect(prisma.session.count()).resolves.toBe(0);
  });
});

describe("Phase 2 game API", () => {
  const origin = testConfig.publicBaseUrl;
  const validEntry = { platform: "Test site", amountCents: 123, minutes: 15, workedOn: "2026-10-14", note: "Private work note" };

  async function login(suffix: string) {
    vi.mocked(paypalClient.fetchUserInfo).mockResolvedValueOnce({
      user_id: `game-${suffix}`, name: `Player ${suffix}`, email: `${suffix}@example.com`
    });
    const state = await beginPayPalLogin();
    const result = await request(app).get(`/auth/paypal/callback?code=fixture&state=${state}`).expect(302);
    const player = await prisma.player.findUniqueOrThrow({ where: { paypalUserId: `game-${suffix}` } });
    return { player, cookie: result.headers["set-cookie"]![0] };
  }
  function write(cookie: string, route: string, body: unknown = {}) {
    return request(app).post(route).set("Cookie", cookie).set("Origin", origin).send(body);
  }

  it.each(["/api/entries", "/api/me/stats", "/api/clock", "/api/quests", "/api/leaderboard"])("requires a session for GET %s", async (route) => {
    await request(app).get(route).expect(401);
  });
  it.each(["/api/entries", "/api/clock/in", "/api/clock/out", "/api/quests/fixture-quest", "/api/leaderboard/join", "/api/leaderboard/leave", "/api/me/time-zone", "/api/logout"])("requires a session for POST %s", async (route) => {
    await request(app).post(route).set("Origin", origin).send({}).expect(401);
  });
  it("requires a session to delete entries", async () => {
    await request(app).delete("/api/entries").set("Origin", origin).send({}).expect(401);
  });
  it("logs only owned, unverified entries and keeps private stats private", async () => {
    const alice = await login("alice");
    const bob = await login("bob");
    const created = await write(alice.cookie, "/api/entries", validEntry).expect(201);
    expect(created.body.entry).toMatchObject({ ...validEntry, playerId: alice.player.id, verified: false });
    const own = await request(app).get("/api/entries").set("Cookie", alice.cookie).expect(200);
    expect(own.body.entries).toHaveLength(1);
    expect((await request(app).get("/api/entries").set("Cookie", bob.cookie)).body.entries).toEqual([]);
    await request(app).get(`/api/entries?id=${created.body.entry.id}`).set("Cookie", bob.cookie).expect(404);
    await request(app).delete("/api/entries").set("Cookie", bob.cookie).set("Origin", origin).send({ id: created.body.entry.id }).expect(404);
    await write(bob.cookie, "/api/entries", { ...validEntry, playerId: alice.player.id }).expect(400);
    await write(bob.cookie, "/api/entries", { ...validEntry, id: created.body.entry.id }).expect(400);
    await request(app).patch(`/api/entries/${created.body.entry.id}`).set("Cookie", bob.cookie).set("Origin", origin).send({ minutes: 0 }).expect(404);
    const stats = await request(app).get("/api/me/stats").set("Cookie", alice.cookie).expect(200);
    expect(stats.body).toMatchObject({ totals: { amountCents: 123, verifiedCents: 0, minutes: 15 }, xp: 27, streak: 1 });
    expect((await request(app).get("/api/me/stats").set("Cookie", bob.cookie)).body.totals.amountCents).toBe(0);
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
    await request(app).delete("/api/entries").set("Cookie", alice.cookie).set("Origin", origin).send({ id: created.body.entry.id }).expect(204);
    await expect(prisma.logEntry.count()).resolves.toBe(0);
  });
  it.each([-1, 0.5, 1_000_001, "100", null])("rejects amount %s", async (amountCents) => {
    const current = await login("invalid");
    await write(current.cookie, "/api/entries", { ...validEntry, amountCents }).expect(400);
    await expect(prisma.logEntry.count()).resolves.toBe(0);
  });
  it.each([0, 1_000_000])("accepts boundary amount %s", async (amountCents) => {
    const current = await login("boundary");
    await write(current.cookie, "/api/entries", { ...validEntry, amountCents }).expect(201);
  });
  it.each([
    { verified: true }, { playerId: "other-player" }, { platform: "" }, { minutes: -1 },
    { minutes: 0.1 }, { workedOn: "2026-02-30" }, { workedOn: "2026-10-15" }, { note: "x".repeat(2001) }
  ])("rejects invalid or privileged entry fields: %j", async (fields) => {
    const current = await login("fields");
    await write(current.cookie, "/api/entries", { ...validEntry, ...fields }).expect(400);
  });
  it("rejects missing, null, cross-origin and malformed origins, plus non-JSON writes", async () => {
    const current = await login("csrf");
    for (const value of ["null", "https://evil.example", `${origin}.evil.example`, `${origin}/path`]) {
      await request(app).post("/api/entries").set("Cookie", current.cookie).set("Origin", value).send(validEntry).expect(403);
    }
    await request(app).post("/api/entries").set("Cookie", current.cookie).send(validEntry).expect(403);
    await request(app).post("/api/entries").set("Cookie", current.cookie).set("Origin", origin).set("Sec-Fetch-Site", "cross-site").send(validEntry).expect(403);
    await request(app).post("/api/entries").set("Cookie", current.cookie).set("Origin", origin).type("form").send(validEntry).expect(415);
    await request(app).post("/api/entries").set("Cookie", current.cookie).set("Origin", origin).type("json").send("{").expect(400);
    await request(app).delete("/api/entries").set("Cookie", current.cookie).send({ id: current.player.id }).expect(403);
    await request(app).post("/logout").set("Cookie", current.cookie).type("form").send({}).expect(415);
    await request(app).post("/api/logout").set("Cookie", current.cookie).send({}).expect(403);
    await request(app).get("/api/me").set("Cookie", current.cookie).expect(200);
  });
  it("persists the browser time zone and computes dates in it", async () => {
    const current = await login("zone");
    gameNow = new Date("2026-10-14T02:00:00Z");
    await write(current.cookie, "/api/me/time-zone", { timeZone: "Pacific/Honolulu" }).expect(200);
    await write(current.cookie, "/api/me/time-zone", { timeZone: "not/a-zone" }).expect(400);
    await write(current.cookie, "/api/entries", validEntry).expect(400);
    await write(current.cookie, "/api/entries", { ...validEntry, workedOn: "2026-10-13" }).expect(201);
    const stats = await request(app).get("/api/me/stats").set("Cookie", current.cookie).expect(200);
    expect(stats.body).toMatchObject({ today: "2026-10-13", timeZone: "Pacific/Honolulu", streak: 1 });
  });
  it("makes concurrent entries safe for the same player", async () => {
    const current = await login("parallel");
    const results = await Promise.all([write(current.cookie, "/api/entries", validEntry), write(current.cookie, "/api/entries", validEntry)]);
    expect(results.map((row) => row.status)).toEqual([201, 201]);
    await expect(prisma.logEntry.count()).resolves.toBe(2);
  });
  it("clock out returns whole minutes rounded down without auto-logging", async () => {
    const alice = await login("clock-alice");
    const bob = await login("clock-bob");
    await write(alice.cookie, "/api/clock/out").expect(409);
    await write(alice.cookie, "/api/clock/in", { platform: "Test site" }).expect(200);
    await write(alice.cookie, "/api/clock/in", { platform: "Other site" }).expect(409);
    await write(bob.cookie, "/api/clock/out").expect(409);
    expect((await request(app).get("/api/clock").set("Cookie", alice.cookie)).body.platform).toBe("Test site");
    gameNow = new Date(gameNow.getTime() + 125_000);
    const results = await Promise.all([write(alice.cookie, "/api/clock/out"), write(alice.cookie, "/api/clock/out")]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
    expect(results.find((row) => row.status === 200)!.body).toMatchObject({ minutes: 2, platform: "Test site", workedOn: "2026-10-14" });
    await expect(prisma.logEntry.count()).resolves.toBe(0);
    expect((await prisma.player.findUniqueOrThrow({ where: { id: alice.player.id } })).clockStartedAt).toBeNull();
  });
  it("only allows one concurrent clock in", async () => {
    const current = await login("clock-race");
    const results = await Promise.all([
      write(current.cookie, "/api/clock/in", { platform: "A" }),
      write(current.cookie, "/api/clock/in", { platform: "B" })
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
  });
  it("toggles only a player's own quest and counts its XP once", async () => {
    const alice = await login("quest-alice");
    const bob = await login("quest-bob");
    await write(alice.cookie, "/api/quests/fixture-quest").expect(200, { id: "fixture-quest", completed: true });
    expect((await request(app).get("/api/me/stats").set("Cookie", alice.cookie)).body.xp).toBe(50);
    expect((await request(app).get("/api/quests").set("Cookie", bob.cookie)).body.completed).toEqual([]);
    await write(bob.cookie, "/api/quests/fixture-quest", { playerId: alice.player.id }).expect(400);
    await write(alice.cookie, "/api/quests/unknown").expect(404);
    const results = await Promise.all([write(alice.cookie, "/api/quests/fixture-quest"), write(alice.cookie, "/api/quests/fixture-quest")]);
    expect(results.map((row) => row.status)).toEqual([200, 200]);
    await expect(prisma.questProgress.count({ where: { playerId: alice.player.id } })).resolves.toBe(1);
    await write(alice.cookie, "/api/quests/fixture-quest").expect(200, { id: "fixture-quest", completed: false });
    expect((await request(app).get("/api/me/stats").set("Cookie", alice.cookie)).body.xp).toBe(0);
  });
  it("serves the 19 real quests and rejects unknown quest IDs", async () => {
    const current = await login("no-pilot");
    const { createApp } = await import("../src/server.js");
    const productionCatalogApp = createApp({ config: testConfig, prisma, paypalClient });
    const catalog = await request(productionCatalogApp).get("/api/quests").set("Cookie", current.cookie).expect(200);
    expect(catalog.body.pilotAvailable).toBe(true);
    expect(catalog.body.quests).toHaveLength(19);
    await request(productionCatalogApp).post("/api/quests/invented").set("Cookie", current.cookie).set("Origin", origin).send({}).expect(404);
  });
  it.each([[0, 0], [45_000, 0], [59_999, 0], [60_000, 1], [90_000, 1], [119_999, 1], [120_000, 2]])("floors clock duration %s ms to %s minutes", async (elapsed, expected) => {
    const current = await login("clock-round");
    await write(current.cookie, "/api/clock/in", { platform: "Prolific" }).expect(200);
    gameNow = new Date(gameNow.getTime() + elapsed);
    const result = await write(current.cookie, "/api/clock/out").expect(200);
    expect(result.body.minutes).toBe(expected);
  });
  it("joining completes the pilot's leaderboard quest once and leaving retains that progress", async () => {
    const current = await login("real-join");
    const { createApp } = await import("../src/server.js");
    const realApp = createApp({ config: testConfig, prisma, paypalClient, now: () => gameNow });
    const action = (value: string) => request(realApp).post(`/api/leaderboard/${value}`).set("Cookie", current.cookie).set("Origin", origin).send({});
    await action("join").expect(200);
    await action("join").expect(200);
    const stats = () => request(realApp).get("/api/me/stats").set("Cookie", current.cookie);
    expect((await stats()).body.xp).toBe(20);
    await action("leave").expect(200);
    expect((await stats()).body.xp).toBe(20);
    await expect(prisma.questProgress.count({ where: { playerId: current.player.id, questId: "lb-join" } })).resolves.toBe(1);
  });
  it("sorts leaderboard by verified total descending, then XP descending", async () => {
    const low = await login("sort-low");
    const highXp = await login("sort-high-xp");
    const highTotal = await login("sort-high-total");
    for (const [current, amountCents, minutes] of [[low, 100, 0], [highXp, 100, 60], [highTotal, 200, 0]] as const) {
      await prisma.logEntry.create({ data: {
        ...validEntry, playerId: current.player.id, amountCents, minutes,
        verified: true, workedOn: new Date("2026-10-14")
      } });
      await write(current.cookie, "/api/leaderboard/join").expect(200);
    }
    const result = await request(app).get("/api/leaderboard").set("Cookie", low.cookie).expect(200);
    expect(result.body.players.map((row: { displayName: string }) => row.displayName)).toEqual([
      "Player sort-high-total", "Player sort-high-xp", "Player sort-low"
    ]);
  });
  it("requires opt-in and whitelists leaderboard fields", async () => {
    const alice = await login("leader-alice");
    const bob = await login("leader-bob");
    await write(alice.cookie, "/api/entries", { ...validEntry, amountCents: 99999, platform: "Unverified-only site" }).expect(201);
    await prisma.logEntry.create({ data: { ...validEntry, playerId: alice.player.id, amountCents: 10, workedOn: new Date("2026-10-14"), verified: true } });
    await prisma.$transaction((tx) => claimEligibleRungs(tx, alice.player.id));
    expect((await request(app).get("/api/leaderboard").set("Cookie", bob.cookie)).body.players).toEqual([]);
    await write(alice.cookie, "/api/leaderboard/join").expect(200);
    const result = await request(app).get("/api/leaderboard").set("Cookie", bob.cookie).expect(200);
    expect(result.body.players).toHaveLength(1);
    expect(result.body.players[0]).toMatchObject({ displayName: "Player leader-alice", verifiedTotalCents: 10, sites: [{ platform: "Test site", verifiedCents: 10 }] });
    expect(Object.keys(result.body.players[0]).sort()).toEqual(["displayName", "level", "rungClaims", "sites", "verifiedTotalCents", "xp"]);
    const serialized = JSON.stringify(result.body);
    for (const forbidden of ["@example.com", validEntry.note, "99999", "Unverified-only site", "email", "note", "amountCents", "playerId"]) expect(serialized).not.toContain(forbidden);
    expect(result.body.players[0].rungClaims[0]).toMatchObject({ rungCents: 10, claimedAt: expect.any(String) });
    await write(alice.cookie, "/api/leaderboard/leave").expect(200);
    expect((await request(app).get("/api/leaderboard").set("Cookie", bob.cookie)).body.players).toEqual([]);
  });
  it("unverified earnings cannot claim rungs, verified earnings can claim all crossed rungs", async () => {
    const current = await login("rungs");
    const entry = await write(current.cookie, "/api/entries", { ...validEntry, amountCents: 100000 }).expect(201);
    await prisma.$transaction((tx) => claimEligibleRungs(tx, current.player.id));
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
    await prisma.$transaction(async (tx) => {
      await tx.logEntry.update({ where: { id: entry.body.entry.id }, data: { verified: true } });
      await claimEligibleRungs(tx, current.player.id);
    });
    await expect(prisma.rungClaim.count()).resolves.toBe(8);
    await prisma.$transaction((tx) => claimEligibleRungs(tx, current.player.id));
    await expect(prisma.rungClaim.count()).resolves.toBe(8);
    expect((await request(app).get("/api/me/stats").set("Cookie", current.cookie)).body.xp).toBe(10815);
    const claims = await prisma.rungClaim.findMany({ orderBy: { rungCents: "asc" } });
    await request(app).delete(`/api/entries/${entry.body.entry.id}`).set("Cookie", current.cookie).set("Origin", origin).send({}).expect(204);
    expect(await prisma.rungClaim.findMany({ orderBy: { rungCents: "asc" } })).toEqual(claims);
  });
  it("two players crossing a rung simultaneously yield exactly one winner and no loser error", async () => {
    const alice = await login("race-alice");
    const bob = await login("race-bob");
    await Promise.all([alice, bob].map((current) => prisma.logEntry.create({ data: {
      ...validEntry, playerId: current.player.id, amountCents: 10, verified: true, workedOn: new Date("2026-10-14")
    } })));
    await Promise.all([alice, bob].map((current) => prisma.$transaction((tx) => claimEligibleRungs(tx, current.player.id))));
    const claims = await prisma.rungClaim.findMany();
    expect(claims).toHaveLength(1);
    expect(claims[0].rungCents).toBe(10);
    expect([alice.player.id, bob.player.id]).toContain(claims[0].playerId);
  });
  it("rolls back a claim with its enclosing verification transaction", async () => {
    const current = await login("rollback");
    await prisma.logEntry.create({ data: { ...validEntry, playerId: current.player.id, amountCents: 10, verified: true, workedOn: new Date("2026-10-14") } });
    await expect(prisma.$transaction(async (tx) => {
      await claimEligibleRungs(tx, current.player.id);
      throw new Error("rollback fixture");
    })).rejects.toThrow("rollback fixture");
    await expect(prisma.rungClaim.count()).resolves.toBe(0);
  });
  const workspaceCases = [
    ["/spotlight/income", { platform: "YouTube", stream_type: "Ad revenue", amount_cents: 199, earned_on: "2026-10-14", status: "pending", content_minutes: 30, note: "private" }],
    ["/spotlight/deals", { brand: "Fictional studio", platform: "TikTok", amount_cents: 5000, due_on: null, deliverables: "One clip", stage: "Agreed" }],
    ["/spotlight/expenses", { app: "spotlight", item: "Microphone", amount_cents: 100, spent_on: "2026-10-14" }],
    ["/freelance/expenses", { app: "freelance", item: "Tool", amount_cents: 100, spent_on: "2026-10-14" }],
    ["/market/expenses", { app: "market_delivery", item: "Fuel", amount_cents: 100, spent_on: "2026-10-14" }],
    ["/freelance/gigs", { platform: "Upwork", client: "Fictional client", project: "Demo", pricing: "fixed", gross_cents: 10000, fee_cents: 1000, hours_x100: 125, started_on: "2026-10-14", stage: "In progress" }],
    ["/market/shifts", { platform: "DoorDash", worked_on: "2026-10-14", pay_cents: 1000, tips_cents: 199, minutes_online: 75, miles_x10: 123 }],
    ["/market/sales", { store: "Printify Shop", item: "Demo print", sold_on: "2026-10-14", price_cents: 2000, fee_cents: 100, cost_cents: 700, ship_cents: 200, made_by: "Printify", status: "pending" }]
  ] as const;
  it.each(workspaceCases)("isolates reads, edits and deletes for %s", async (path, data) => {
    const alice = await login("workspace-alice"); const bob = await login("workspace-bob");
    await request(app).get(`/api${path}`).expect(401);
    await request(app).post(`/api${path}`).set("Origin", origin).send(data).expect(401);
    await request(app).post(`/api${path}`).set("Cookie", alice.cookie).set("Origin", "https://wrong.example").send(data).expect(403);
    const created = await write(alice.cookie, `/api${path}`, data).expect(201);
    const id = created.body.row.id;
    expect((await request(app).get(`/api${path}`).set("Cookie", bob.cookie)).body.rows).toEqual([]);
    await request(app).get(`/api${path}?id=${id}`).set("Cookie", bob.cookie).expect(404);
    await request(app).patch(`/api${path}/${id}`).set("Cookie", bob.cookie).set("Origin", origin).send(data).expect(404);
    await request(app).delete(`/api${path}/${id}`).set("Cookie", bob.cookie).set("Origin", origin).send({}).expect(404);
    const updated = await request(app).patch(`/api${path}/${id}`).set("Cookie", alice.cookie).set("Origin", origin).send(data).expect(200);
    for (const [key,value] of Object.entries(data)) expect(updated.body.row[key]).toEqual(value);
    expect((await request(app).get("/api/me/stats").set("Cookie", alice.cookie)).body.xp).toBe(0);
    await request(app).delete(`/api${path}/${id}`).set("Cookie", alice.cookie).set("Origin", origin).send({}).expect(204);
  });
  it.each([-1, 1.5, 1000001])("rejects invalid workspace money %s", async amount => {
    const alice = await login("workspace-invalid");
    for (const [path,data] of workspaceCases) {
      const field = Object.keys(data).find(key => key.endsWith("_cents"))!;
      await write(alice.cookie, `/api${path}`, { ...data, [field]: amount }).expect(400);
    }
  });
  it("rejects excessive fees on creates and partial edits", async () => {
    const alice = await login("fees"); const [path,data] = workspaceCases[5];
    await write(alice.cookie, `/api${path}`, { ...data, fee_cents: 10001 }).expect(400);
    const row = (await write(alice.cookie, `/api${path}`, data).expect(201)).body.row;
    await request(app).patch(`/api${path}/${row.id}`).set("Cookie",alice.cookie).set("Origin",origin).send({gross_cents: 999}).expect(400);
  });
  it("creates one paid income row when a brand deal is paid concurrently or repeatedly", async () => {
    const alice = await login("deal-paid"); const [path,data]=workspaceCases[1];
    const deal=(await write(alice.cookie, `/api${path}`, data).expect(201)).body.row;
    const paid=()=>request(app).patch(`/api${path}/${deal.id}`).set("Cookie",alice.cookie).set("Origin",origin).send({stage:"Paid"});
    expect((await Promise.all([paid(),paid(),paid()])).map(r=>r.status)).toEqual([200,200,200]);
    const income=(await request(app).get("/api/spotlight/income").set("Cookie",alice.cookie)).body.rows;
    expect(income).toHaveLength(1);expect(income[0]).toMatchObject({brand_deal_id:deal.id,amount_cents:5000,status:"paid",paid_on:"2026-10-14",earned_on:"2026-10-14"});
  });
  it("uses the player's local month for workspace summaries", async () => {
    const alice=await login("workspace-month");gameNow=new Date("2026-11-01T02:00:00Z");
    await write(alice.cookie,"/api/me/time-zone",{timeZone:"Pacific/Honolulu"}).expect(200);
    const [path,data]=workspaceCases[0];
    await write(alice.cookie,`/api${path}`,{...data,earned_on:"2026-10-31"}).expect(201);
    await write(alice.cookie,`/api${path}`,{...data,earned_on:"2026-11-01",amount_cents:10000}).expect(201);
    const result=await request(app).get("/api/spotlight/summary").set("Cookie",alice.cookie).expect(200);
    expect(result.body).toMatchObject({month:"2026-10",earnedCents:199});
    expect((await request(app).get("/api/spotlight/summary?month=2026-11").set("Cookie",alice.cookie)).body.earnedCents).toBe(10000);
  });
  it("cascades workspace rows on player deletion", async () => {
    const alice=await login("workspace-cascade");
    for(const [path,data] of workspaceCases) await write(alice.cookie,`/api${path}`,data).expect(201);
    await prisma.player.delete({where:{id:alice.player.id}});
    for(const table of ["creator_income","brand_deals","expenses","freelance_gigs","delivery_shifts","sales"]){
      const rows=await prisma.$queryRawUnsafe<{count:bigint}[]>(`SELECT count(*) AS count FROM ${table}`);
      expect(Number(rows[0].count)).toBe(0);
    }
  });
  it("rate limits writes per player and permits reads, other players, and later windows", async () => {
    const alice = await login("limit-alice");
    const bob = await login("limit-bob");
    const { createApp } = await import("../src/server.js");
    const limited = createApp({ config: testConfig, prisma, paypalClient, now: () => gameNow, writeLimit: { count: 1, windowMs: 60_000 } });
    const send = (cookie: string) => request(limited).post("/api/leaderboard/join").set("Cookie", cookie).set("Origin", origin).send({});
    await send(alice.cookie).expect(200);
    const result = await send(alice.cookie).expect(429);
    expect(result.headers["retry-after"]).toBe("60");
    await request(limited).get("/api/me/stats").set("Cookie", alice.cookie).expect(200);
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
