import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { chromium, type BrowserContextOptions, type Page } from "playwright";
import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { SessionStore } from "../src/auth/session.js";
import { seedDemo } from "../src/demo/seed.js";
import { measureText } from "./pixel-contrast.js";

type Rgb = [number, number, number];

const args = process.argv.slice(2);
const screenshotDirectory = args[0] === "--screenshots" ? args[1] : undefined;
const port = 3408;
const baseUrl = `http://127.0.0.1:${port}`;
const day = "2026-10-18";
const tabs = [["First Dime", "first"], ["Spotlight", "spotlight"], ["Freelance", "freelance"], ["Market", "market"],
  ["Stats", "stats"], ["Vault", "vault"], ["PayPal", "paypal"]] as const;
const accents: Record<string, string> = { first: "#E8B54A", spotlight: "#E2558C", freelance: "#8F8CFF", market: "#3CC6B4",
  paypal: "#5BA8FF", stats: "#9BBC0F", vault: "#F2C35B" };

// --- composite math ----------------------------------------------------------------------------------
// Worst case from the handoff: the panel color over the brightest shape (accent or the second gradient
// stop at its highest opacity) over the brightest nebula stop.
const hex = (value: string): Rgb => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)) as Rgb;
const over = (top: Rgb, alpha: number, base: Rgb): Rgb => top.map((c, i) => c * alpha + base[i] * (1 - alpha)) as Rgb;
const luminance = (color: Rgb) => {
  const [r, g, b] = color.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Rgb, b: Rgb) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + .05) / (low + .05); };
const nebula = ["#070A16", "#2A2466", "#3A1C4F", "#0F2E46"].map(hex);
const textStyles = { text: "#ECEAF7", label: "#A9AECB", head: "#FFFFFF", money: "#D7EE86", link: "#B4B4F5", error: "#FF8FA3", placeholder: "#A2A8C6" };
const boundaries = { "input border": "#8A91B6", "focus ring": "#F2C35B" };
const mathProblems: string[] = [];
for (const [tab, accent] of Object.entries(accents)) {
  const behind = [hex(accent), hex("#7A5CFF")].flatMap(shape => nebula.map(stop => over(shape, .6, stop)))
    .map(shape => over(hex("#12152C"), .74, shape)).sort((a, b) => luminance(b) - luminance(a))[0];
  for (const [name, color] of Object.entries(textStyles)) if (ratio(hex(color), behind) < 4.5) mathProblems.push(`${tab}: ${name} ${ratio(hex(color), behind).toFixed(2)}`);
  for (const [name, color] of Object.entries({ ...boundaries, "accent focus": accent })) if (ratio(hex(color), behind) < 3) mathProblems.push(`${tab}: ${name} ${ratio(hex(color), behind).toFixed(2)}`);
}
assert.deepEqual(mathProblems, [], "Glass text and boundaries over the brightest shape");
console.log("glass composite contrast passed for 7 tabs, 7 text styles and 3 boundaries");

// --- rendered app ------------------------------------------------------------------------------------
const container = await new PostgreSqlContainer("postgres:16").withDatabase("onedime_glass_test").start();
const prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
const problems: string[] = [];
try {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() }, stdio: "ignore"
  });
  const player = await seedDemo(prisma, day);
  await prisma.player.update({ where: { id: player.id }, data: { welcomeCompletedAt: new Date(`${day}T20:00:00Z`) } });
  const config = loadConfig({ NODE_ENV: "test", PORT: String(port), PUBLIC_BASE_URL: baseUrl,
    SESSION_SECRET: randomBytes(32).toString("hex"), PAYOUTS_ENABLED: "false" });
  const sessions = new SessionStore(prisma, config);
  const app = createApp({ config, prisma, now: () => new Date(`${day}T20:00:00Z`) });
  app.get("/glass-login", async (_req, res) => { await sessions.createSession(player.id, res); res.redirect("/app"); });
  server = await new Promise(done => { const value = app.listen(port, "127.0.0.1", () => done(value)); });
  browser = await chromium.launch();
  if (screenshotDirectory) await mkdir(resolve(screenshotDirectory), { recursive: true });

  const open = async (options: BrowserContextOptions, transparency?: "reduce") => {
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Pacific/Honolulu", ...options });
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    await context.route(/^https?:\/\//, route => new URL(route.request().url()).origin === baseUrl ? route.fallback() : route.abort("blockedbyclient"));
    const page = await context.newPage();
    if (transparency) await (await context.newCDPSession(page)).send("Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-reduced-transparency", value: transparency }] });
    await page.goto(`${baseUrl}/glass-login`);
    await page.waitForFunction(() => document.getElementById("player-name")?.textContent === "Demo player");
    await page.evaluate(() => document.fonts.ready);
    return page;
  };
  const shapeLayer = (page: Page) => page.locator("#glass-shapes").evaluate(node => getComputedStyle(node).display);

  const page = await open({ colorScheme: "light", reducedMotion: "reduce" });
  assert.equal(await page.locator("html").getAttribute("data-skin"), "glass", "Glass is the default skin");
  assert.equal(await page.locator("#theme-toggle").isHidden(), true, "Glass hides the light and dark toggle");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), "dark", "Glass keeps native controls dark under a light OS in system mode");
  for (const [name, key] of tabs) {
    await page.getByRole("tab", { name, exact: true }).click();
    if (key === "stats") await page.waitForFunction(() => document.querySelectorAll("#app-stats svg[role='img']").length === 3);
    assert.equal(await page.locator("html").getAttribute("data-tab"), key, `${name} sets its accent`);
    await page.waitForFunction(() => !document.querySelector("#glass-shapes .in"));
    const opacities = await page.locator("#glass-shapes > svg[viewBox]").evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
    assert.ok(opacities.length >= 2 && opacities.length <= 3, `${name} draws two or three shapes`);
    assert.ok(opacities.every(value => value >= .4 && value <= .6), `${name} shapes stay between .4 and .6 opacity`);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      if (width < 500) assert.equal(await page.evaluate(() => {
        const box = document.querySelector(".controls")!.getBoundingClientRect();
        return !!document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest(".controls");
      }), true, `${name}: the fixed controls stay above the content at ${width}px`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) problems.push(`${name} at ${width}px overflows by ${overflow}px`);
      const results = await measureText(page, { skip: ".sr-only,.skip-link,.glass-shapes,#post-login-boot", hide: "" });
      problems.push(...results.filter(result => result.ratio < result.required)
        .map(result => `${name} at ${width}px: ${result.label} ${result.ratio.toFixed(2)} < ${result.required}`));
      if (screenshotDirectory && width !== 320) await page.screenshot({ path: resolve(screenshotDirectory, `glass-${key}-${width}.png`) });
      console.log(`glass checked: ${name}; width=${width}; text runs=${results.length}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  await page.getByRole("tab", { name: "First Dime", exact: true }).click();
  await page.getByRole("button", { name: "Detach the pad", exact: true }).click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const results = await measureText(page, { skip: ".sr-only,.skip-link,.glass-shapes,#post-login-boot", hide: "" });
    problems.push(...results.filter(result => result.ratio < result.required)
      .map(result => `floating pad at ${width}px: ${result.label} ${result.ratio.toFixed(2)} < ${result.required}`));
    console.log(`glass checked: floating pad; width=${width}; text runs=${results.length}`);
  }
  await page.getByRole("button", { name: "Dock the pad", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.locator("#glass-shapes > svg[viewBox]").first().evaluate(node => getComputedStyle(node).transitionDuration), "0s",
    "reduced motion drops the shape transition");
  await page.evaluate(() => { (window as unknown as { glassMarker: number }).glassMarker = 1; });
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Appearance", exact: true });
  for (const [label, skin] of [["Current", null], ["Paper", "paper"], ["Slate", "slate"], ["Glass", "glass"]] as const) {
    await dialog.getByRole("radio", { name: new RegExp(`^${label}`) }).check();
    assert.equal(await page.locator("html").getAttribute("data-skin"), skin, `${label} applies without a reload`);
    assert.equal(await shapeLayer(page), skin === "glass" ? "block" : "none", `${label} shows shapes only in Glass`);
    const vaultColors = await page.evaluate(() => {
      const color = (selector: string, property: string) => getComputedStyle(document.querySelector(selector)!).getPropertyValue(property);
      return { page: color("body", "background-color"), bot: color(".vault-bot", "background-color"), sil: color(".vault-bot .sil", "fill"),
        panel: color("#app-vault .stats-lcd", "background-color"), meter: color(".vault-rule-bar", "border-top-color") };
    });
    const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const flatten = (layers: string[]) => layers.reduce<Rgb>((below, layer) => {
      const [r, g, b, a = 1] = channels(layer);
      return over([r, g, b], a, below);
    }, channels(vaultColors.page).slice(0, 3) as Rgb);
    const panelBelow = flatten([vaultColors.panel]), botBelow = flatten([vaultColors.panel, vaultColors.bot]);
    assert.ok(ratio(flatten([vaultColors.panel, vaultColors.sil]), botBelow) >= 3, `${label}: sleeping robot silhouettes stand out from their cards`);
    assert.ok(ratio(flatten([vaultColors.panel, vaultColors.meter]), panelBelow) >= 3, `${label}: the Vault meter outline stands out from its panel`);
    assert.equal(await page.locator("#theme-toggle").isHidden(), skin === "glass", `${label} shows the mode toggle outside Glass`);
  }
  assert.equal(await page.evaluate(() => (window as unknown as { glassMarker?: number }).glassMarker), 1, "switching skins never reloads");
  await page.context().close();

  const moving = await open({ colorScheme: "dark", reducedMotion: "no-preference" });
  assert.notEqual(await moving.locator("#glass-shapes > svg[viewBox]").first().evaluate(node => getComputedStyle(node).transitionDuration), "0s",
    "shapes ease in when motion is allowed");
  await moving.context().close();

  const solid = await open({ colorScheme: "dark", reducedMotion: "reduce" }, "reduce");
  assert.equal(await shapeLayer(solid), "none", "reduced transparency hides the shapes");
  for (const selector of [".goal-hero", "nav.apps", ".stats div"]) {
    const style = await solid.locator(selector).first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, filter: getComputedStyle(node).backdropFilter }));
    assert.deepEqual(style, { background: "rgb(18, 21, 44)", filter: "none" }, `reduced transparency makes ${selector} solid`);
  }
  await solid.context().close();
  console.log("glass modes passed: reduced motion, reduced transparency and skin switching without reload");
} finally {
  await browser?.close();
  server?.close();
  await prisma.$disconnect();
  await container.stop();
}
assert.deepEqual(problems, [], "Glass text contrast and overflow");
console.log("glass passed: 7 tabs at 320, 390 and 1440px");
