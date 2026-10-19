import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { chromium } from "playwright";
import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { SessionStore } from "../src/auth/session.js";
import { seedDemo } from "../src/demo/seed.js";
const container = await new PostgreSqlContainer("postgres:16").start();
const prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
try {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() }, stdio: "ignore"
  });
  const player = await seedDemo(prisma, "2026-10-18");
  const canary = "creator audience income advertisements sponsorships CANARY-DEVICE";
  await prisma.$executeRaw`INSERT INTO paypal_transactions(player_id,txn_id,occurred_on,payer,gross_cents,fee_cents,net_cents,currency,kind)
    VALUES(${player.id}::uuid,'FAKE-SMART','2026-10-18'::date,${canary},1000,0,1000,'USD','General Payment')`;
  const config = loadConfig({ NODE_ENV: "test", PORT: "3404", PUBLIC_BASE_URL: "http://127.0.0.1:3404",
    SESSION_SECRET: randomBytes(32).toString("hex"), PAYOUTS_ENABLED: "false" });
  const sessions = new SessionStore(prisma, config);
  const app = createApp({ config, prisma });
  app.get("/browser-login", async (_req, res) => { await sessions.createSession(player.id, res); res.redirect("/app"); });
  server = await new Promise(resolve => { const value = app.listen(3404, "127.0.0.1", () => resolve(value)); });
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [], requests: { url: string; body: string }[] = [];
  context.on("request", req => requests.push({ url: req.url(), body: req.postData() ?? "" }));
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3404/browser-login");
  await page.getByRole("tab", { name: "PayPal", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Smart suggestions", exact: true });
  await toggle.waitFor();
  await page.waitForFunction(() => !(document.querySelector('input[type="checkbox"]') as HTMLInputElement)?.disabled);
  assert.equal(await toggle.isChecked(), false);
  assert.equal(requests.some(req => req.url.includes("/models/")), false);
  await page.getByText("Suggested: First Dime / Prolific. Confirm or change it.", { exact: true }).waitFor();
  const begin = requests.length;
  await toggle.focus();
  await toggle.press("Space");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Download and suggest" && !b.disabled));
  const button = page.getByRole("button", { name: "Download and suggest", exact: true });
  await button.focus();
  await button.press("Enter");
  await page.getByText(/^Suggestions ready\./).waitFor({ timeout: 125000 });
  await page.getByText("Suggested: Spotlight / Other. Confirm or change it.", { exact: true }).waitFor();
  const firstRequests = requests.slice(begin);
  assert(firstRequests.some(req => req.url.endsWith("model_quantized.onnx")));
  assert(firstRequests.every(req => !`${req.url}${req.body}`.includes("CANARY-DEVICE")));
  assert(firstRequests.every(req => new URL(req.url).origin === "http://127.0.0.1:3404"));
  assert.equal(errors.length, 0, errors.join("\n"));
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/p2-phone-smart.png", fullPage: true });
  await page.reload();
  await page.getByRole("tab", { name: "PayPal", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Download and suggest" && !b.disabled));
  assert.equal(await toggle.isChecked(), true);
  const secondStart = requests.length;
  await button.focus(); await button.press("Enter");
  await page.getByText(/^Suggestions ready\./).waitFor({ timeout: 125000 });
  assert.equal(requests.slice(secondStart).filter(req => req.url.endsWith("model_quantized.onnx")).length, 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("browser smart check passed: opt-in, inference, private requests, cached reload");
} finally {
  await browser?.close();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
  await prisma.$disconnect();
  await container.stop();
}
