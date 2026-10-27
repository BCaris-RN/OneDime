import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { inspectContrast, type ContrastPair } from "./current-contrast.js";

const checkOnly = process.argv.includes("--check-only");
assert(process.argv.slice(2).every(argument => argument === "--check-only"), "Unknown argument");
const port = Number(process.env.BETA_TEST_PORT ?? 3433);
assert(Number.isInteger(port) && port > 0 && port <= 65535, "Invalid BETA_TEST_PORT");
const baseUrl = `http://127.0.0.1:${port}`;
const config = loadConfig({ NODE_ENV: "test", PORT: String(port), PUBLIC_BASE_URL: baseUrl,
  SESSION_SECRET: "beta-page-local-fixture-at-least-32-characters", PAYOUTS_ENABLED: "false" });
const app = createApp({ config });
const server = app.listen(port, "127.0.0.1");
await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const pairs: ContrastPair[] = [];
const coverage: string[] = [];
const directory = resolve("reviews/beta-allowlist");
try {
  browser = await chromium.launch();
  if (!checkOnly) await mkdir(`${directory}/screenshots`, { recursive: true });
  for (const os of ["light", "dark"] as const) for (const theme of ["system", "light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: os, reducedMotion: "reduce" });
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    if (theme !== "system") await context.addInitScript(theme => {
      document.addEventListener("DOMContentLoaded", () => { document.documentElement.dataset.theme = theme; });
    }, theme);
    const external: string[] = [], errors: string[] = [];
    await context.route(/^https?:\/\//, route => {
      if (new URL(route.request().url()).origin === baseUrl) return route.continue();
      external.push(new URL(route.request().url()).origin);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
      assert.equal((await page.goto(`${baseUrl}/beta.html`))?.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const label = `beta page; mode=${theme}; OS=${os}; width=${width}`;
      coverage.push(label);
      assert.equal(await page.locator("h1").textContent(), "OneDime is in a private beta");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, label);
      pairs.push(...await inspectContrast(page, label));
      await page.evaluate(() => window.getSelection()?.removeAllRanges());
      const links = page.getByRole("link");
      assert.equal(await links.count(), 3);
      await page.keyboard.press("Tab");
      for (let index = 0; index < await links.count(); index++) {
        const link = links.nth(index);
        await page.keyboard.press("Tab");
        await link.focus();
        assert(await link.evaluate(node => node.matches(":focus-visible")), label);
        assert(await link.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
        }), `Keyboard target visible: ${label}`);
        pairs.push(...await inspectContrast(page, `${label}; link ${index}; focus`, false));
        await link.evaluate(node => (node as HTMLElement).blur());
        await link.hover();
        pairs.push(...await inspectContrast(page, `${label}; link ${index}; hover`, false));
        await page.mouse.down();
        try { pairs.push(...await inspectContrast(page, `${label}; link ${index}; active`, false)); }
        finally { await page.mouse.move(1, 1); await page.mouse.up(); }
      }
      if (!checkOnly && theme === "system") {
        await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); scrollTo(0, 0); });
        await page.screenshot({ path: `${directory}/screenshots/beta-${os}-${width}.png`, fullPage: true });
      }
      await page.getByRole("link", { name: "Back to sign in" }).focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`${baseUrl}/`);
      assert(await page.getByRole("link", { name: "Log in with PayPal" }).isVisible());
    }
    assert.deepEqual(external, [], "Beta page must not request third-party resources");
    assert.deepEqual(errors, [], "Beta page must not throw browser errors");
    await context.close();
  }
  const unique = new Map<string, ContrastPair>();
  for (const pair of pairs) unique.set(JSON.stringify([pair.kind, pair.role, pair.foreground, pair.background, pair.minimum, pair.result, pair.reason]), pair);
  const measured = [...unique.values()];
  const failures = measured.filter(pair => pair.result === "fail" || pair.result === "uncovered");
  const counts = Object.fromEntries(["pass", "exempt", "fail", "uncovered"].map(result => [result, measured.filter(pair => pair.result === result).length]));
  if (!checkOnly) {
    const hashes = Object.fromEntries(await Promise.all(["public/beta.html", "public/styles.css", "scripts/check-beta-access.ts", "scripts/current-contrast.ts"].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
    await writeFile(`${directory}/page-evidence.json`, JSON.stringify({ browser: browser.version(), hashes, counts, coverage, pairs: measured }, null, 2) + "\n");
    const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
    const lines = ["# Private beta page contrast", "", "Generated by `scripts/check-beta-access.ts` using the existing Current-theme scanner.", "",
      `Chromium ${browser.version()}; ${coverage.length} mode/OS/width combinations; ${measured.length} unique semantic/color pairs.`,
      `Pass: ${counts.pass}; exemptions: ${counts.exempt}; fail: ${counts.fail}; uncovered: ${counts.uncovered}.`,
      "Comparisons use unrounded ratios. Text requires 4.5:1 (3:1 for large text); required controls/focus require 3:1. Exemptions are not passes.", "",
      "| Result | Role | Foreground | Background | Ratio | Required | Reason |", "| --- | --- | --- | --- | ---: | ---: | --- |"];
    for (const pair of measured) lines.push(`| ${pair.result} | ${escape(pair.role)} | ${pair.foreground} | ${pair.background} | ${pair.ratio?.toFixed(6) ?? "n/a"} | ${pair.minimum || "exempt"} | ${escape(pair.reason)} |`);
    lines.push("", "Coverage: System/Light/Dark, both OS preferences, 320/390/1280px, keyboard-visible return/policy links, hover/active/focus and selection. No native form controls or SVGs exist on this page.",
      "Page screenshots use fictional static copy only. The page is public; access decisions occur in the OAuth callback and centralized session lookup. This browser check calls no provider and uses no database.", "");
    await writeFile(`${directory}/page-contrast.md`, lines.join("\n"));
  }
  assert.deepEqual(failures, [], "Beta page contrast has failing or uncovered pairs");
  console.log(`beta page: ${coverage.length} combinations; ${measured.length} pairs; ${counts.fail} fail; ${counts.uncovered} uncovered; keyboard, navigation and local-only requests pass`);
} finally {
  await browser?.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
