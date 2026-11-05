import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { chromium, type Page } from "playwright";
import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { SessionStore } from "../src/auth/session.js";
import { seedDemo } from "../src/demo/seed.js";
import { inspectContrast, inspectNativeGlyphs, type ContrastPair } from "./current-contrast.js";

const port = Number(process.env.CONTRAST_TEST_PORT ?? 3406);
assert(Number.isInteger(port) && port > 0 && port <= 65535, "Invalid CONTRAST_TEST_PORT");
const baseUrl = `http://127.0.0.1:${port}`;
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
for (let index = 0; index < args.length; index++) {
  if (["--before", "--check-only", "--skin-matrix"].includes(args[index])) continue;
  if (["--report", "--screenshots"].includes(args[index]) && args[index + 1] && !args[index + 1].startsWith("--")) { index++; continue; }
  throw new Error(`Unknown or incomplete argument: ${args[index]}`);
}
const before = args.includes("--before");
const checkOnly = args.includes("--check-only");
const skinMatrix = args.includes("--skin-matrix");
const skinReportPath = resolve(option("--report") ?? "docs/skins-contrast.md");
const reportPath = resolve(option("--report") ?? `docs/contrast/current-${before ? "before" : "after"}.md`);
const screenshotDirectory = option("--screenshots");
const reportDestination = skinMatrix ? skinReportPath : reportPath;
const cssPath = resolve(before ? "docs/contrast/current-before.css" : "public/styles.css");
const stylesheet = await readFile(cssPath, "utf8");
const stylesheetHash = createHash("sha256").update(stylesheet).digest("hex");
const runnerHash = createHash("sha256").update(await readFile("scripts/check-current-contrast.ts")).digest("hex");
const scannerHash = createHash("sha256").update(await readFile("scripts/current-contrast.ts")).digest("hex");
const pairs: ContrastPair[] = [];
const coverage: string[] = [];
const day = "2026-10-18";
const container = await new PostgreSqlContainer("postgres:16").withDatabase(process.env.TEST_DATABASE_NAME ?? "onedime_contrast_test").start();
const prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let server: ReturnType<ReturnType<typeof createApp>["listen"]> | undefined;
try {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() }, stdio: "ignore"
  });
  const player = await seedDemo(prisma, day);
  const empty = await prisma.player.create({ data: { paypalUserId: "contrast-empty-fictional", displayName: "Empty demo player", timeZone: "Pacific/Honolulu", welcomeCompletedAt: new Date(`${day}T20:00:00Z`) } });
  const config = loadConfig({ NODE_ENV: "test", PORT: String(port), PUBLIC_BASE_URL: baseUrl,
    SESSION_SECRET: randomBytes(32).toString("hex"), PAYOUTS_ENABLED: "false" });
  const sessions = new SessionStore(prisma, config);
  const app = createApp({ config, prisma, now: () => new Date(`${day}T20:00:00Z`) });
  app.get("/contrast-login", async (req, res) => { await sessions.createSession(req.query.empty === "1" ? empty.id : player.id, res); res.redirect("/app"); });
  server = await new Promise(resolve => { const value = app.listen(port, "127.0.0.1", () => resolve(value)); });
  browser = await chromium.launch();
  console.log("contrast local fixture initialized");
  if (screenshotDirectory) await mkdir(resolve(screenshotDirectory), { recursive: true });

  let currentSkin = "current";
  const inspect = async (page: Page, label: string, selection = true) => {
    const state = skinMatrix ? "skin=" + currentSkin + "; " + label : label;
    pairs.push(...await inspectContrast(page, state, selection));
    coverage.push(state);
  };
  const states = async (page: Page, label: string) => {
    const selectors = [".primary-button", ".ghost-button", ".text-button", "button.act:not(.ghost)", "button.act.ghost", ".facebtns button:first-child", ".facebtns button:last-child", ".dpad button", "nav.apps button[aria-selected='true']", "nav.apps button[aria-selected='false']", "nav.tabs button[aria-selected='true']", "#balNav button[aria-selected='true']", "input:not([type='checkbox'])", "input#clock-platform", ".slip input:not([type='checkbox'])", "input[type='checkbox']", "select", "textarea", "summary", "a:not(.brand):not(.paypal-button):not(.skip-link)", ".skip-link", ".paypal-button", ".brand"];
    for (const selector of selectors) {
      const modal = page.locator("dialog:modal");
      const target = (await modal.count() ? modal : page).locator(selector).filter({ visible: true }).first();
      if (!await target.count() || await target.isDisabled()) continue;
      const signature = await target.evaluate((node, selector) => {
        const css = getComputedStyle(node);
        const ancestors: string[] = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) ancestors.push(getComputedStyle(parent).backgroundColor);
        return [selector, css.color, css.backgroundColor, css.borderColor, css.outlineColor, ancestors.join(",")].join(";");
      }, selector);
      const key = `${label.match(/theme=\w+; OS=\w+/)?.[0]};${signature}`;
      if (seenStates.has(key)) continue;
      seenStates.add(key);
      await page.mouse.move(1, 1);
      await page.keyboard.press("Tab");
      await target.focus();
      assert.equal(await target.evaluate(node => node.matches(":focus-visible")), true, `Keyboard focus fixture: ${selector}`);
      await inspect(page, `${label}; focus ${selector}`, false);
      if (selector.startsWith("input") || selector === "textarea" || selector === "select" || selector === ".skip-link") continue;
      await target.evaluate(node => (node as HTMLElement).blur());
      await target.hover();
      await inspect(page, `${label}; hover ${selector}`, false);
      await page.mouse.down();
      try { await inspect(page, `${label}; active ${selector}`, false); }
      finally { await page.mouse.move(1, 1); await page.mouse.up(); }
    }
  };
  const seenStates = new Set<string>();
  const screenshot = async (page: Page, filename: string) => {
    if (!screenshotDirectory) return;
    await page.evaluate(() => { window.getSelection()?.removeAllRanges(); (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
    await page.mouse.move(1, 1);
    await page.screenshot({ path: resolve(screenshotDirectory, filename), fullPage: true, animations: "disabled" });
  };

  const skins = skinMatrix ? ["paper", "slate"] as const : ["current"] as const;
  for (const skin of skins) for (const os of ["light", "dark"] as const) for (const theme of ["light", "dark"] as const) {
    currentSkin = skin;
    // Each color-scheme combination gets a fresh first-run state for the welcome dialog.
    await prisma.player.update({ where: { id: player.id }, data: { welcomeCompletedAt: null } });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: os, reducedMotion: "reduce", timezoneId: "Pacific/Honolulu" });
    // tsx preserves names inside callbacks serialized into the isolated test browser.
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    await context.route("**/styles.css", route => route.fulfill({ contentType: "text/css", body: stylesheet }));
    if (skinMatrix) await context.addInitScript(({ skin, theme }) => localStorage.setItem("onedime-appearance", JSON.stringify({ skin, mode: theme })), { skin, theme });
    else await context.addInitScript(({ theme }) => localStorage.setItem("onedime-theme", theme), { theme });
    const page = await context.newPage();
    const errors: string[] = [];
    const external: string[] = [];
    await context.route(/^https?:\/\//, route => {
      if (new URL(route.request().url()).origin === baseUrl) return route.fallback();
      external.push(new URL(route.request().url()).origin);
      return route.abort("blockedbyclient");
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${baseUrl}/contrast-login`);
    const welcome = page.getByRole("dialog", { name: "What kind of work do you do?", exact: true });
    await welcome.waitFor();
    const welcomeLabel = `First-run welcome; theme=${theme}; OS=${os}`;
    await inspect(page, welcomeLabel);
    await states(page, welcomeLabel);
    if (screenshotDirectory && os === theme) await screenshot(page, `welcome-${theme}-1280.png`);
    await welcome.getByRole("button", { name: "Skip for now", exact: true }).click();
    await welcome.waitFor({ state: "hidden" });
    await page.waitForFunction(() => (document.getElementById("sasuStats")?.children.length ?? 0) > 0);
    await page.waitForFunction(() => document.getElementById("player-name")?.textContent === "Demo player");
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    assert.equal(await page.locator("html").getAttribute("data-skin"), skin === "current" ? null : skin);
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    const appearanceDialog = page.getByRole("dialog", { name: "Appearance", exact: true });
    const appearanceLabel = "Appearance settings; theme=" + theme + "; OS=" + os;
    await inspect(page, appearanceLabel);
    await states(page, appearanceLabel);
    await appearanceDialog.getByRole("button", { name: "Close", exact: true }).click();
    for (const appName of ["First Dime", "Spotlight", "Freelance", "Market", "Stats", "PayPal"]) {
      await page.getByRole("tab", { name: appName, exact: true }).click();
      if (appName === "Stats") await page.waitForFunction(() => document.querySelectorAll("#app-stats svg[role='img']").length === 3);
      const label = `${appName}; populated; theme=${theme}; OS=${os}`;
      await inspect(page, label);
      pairs.push(...await inspectNativeGlyphs(page, label));
      await states(page, label);
      const subTabs = appName === "First Dime" ? ["Log", "Quests", "Leaderboard", "Playbook", "Help"] : appName === "Market" ? ["Delivery and rides", "Selling"] : [];
      for (const sub of subTabs) {
        await page.getByRole("tab", { name: sub, exact: true }).click();
        await inspect(page, `${label}; ${sub}`);
        await states(page, `${label}; ${sub}`);
      }
      if (subTabs.length) await page.getByRole("tab", { name: subTabs[0], exact: true }).click();
      if (os === theme) for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: width === 375 ? 844 : 900 });
        await inspect(page, `${label}; width=${width}`);
        if (appName === "PayPal" && width < 500) {
          await page.waitForFunction(() => !!document.querySelector("#app-paypal .tablewrap[data-scrollable='true']"));
          const cue = page.locator("#app-paypal .table-scroll-cue:visible").first();
          await cue.waitFor();
          assert.match(await cue.textContent() ?? "", /Swipe horizontally/);
          await page.locator("#header-menu summary").click();
          await inspect(page, `${label}; phone menu open; width=${width}`);
          await states(page, `${label}; phone menu open; width=${width}`);
          await page.locator("#header-menu summary").click();
        }
        await screenshot(page, `${appName.toLowerCase().replaceAll(" ", "-")}-${theme}-${width}.png`);
      }
      if (skinMatrix) for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), skin + " " + theme + " must not overflow at " + width + "px");
        await inspect(page, label + "; width=" + width);
        if (appName === "PayPal") {
          await page.waitForFunction(() => !!document.querySelector("#app-paypal .tablewrap[data-scrollable='true']"));
          const cue = page.locator("#app-paypal .table-scroll-cue:visible").first();
          await cue.waitFor();
          assert.match(await cue.textContent() ?? "", /Swipe horizontally/);
          await page.locator("#header-menu summary").click();
          await inspect(page, `${label}; phone menu open; width=${width}`);
          await page.locator("#header-menu summary").click();
        }
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      console.log(`contrast workspace collected: ${label}`);
    }
    await page.getByRole("button", { name: "Detach the pad", exact: true }).click();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await inspect(page, `Floating pad; theme=${theme}; OS=${os}; width=${width}`);
    }
    await page.getByRole("button", { name: "Dock the pad", exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("tab", { name: "First Dime", exact: true }).click();
    await page.getByRole("tab", { name: "Log", exact: true }).click();
    await page.evaluate(() => {
      const message = document.getElementById("message")!;
      message.textContent = "Fictional contrast fixture: could not save this entry.";
      message.dataset.error = "true";
      const toast = document.getElementById("toast")!;
      toast.textContent = "Fictional contrast fixture saved.";
      toast.classList.add("on");
      const input = document.getElementById("platform")!;
      input.setAttribute("aria-invalid", "true");
    });
    await inspect(page, `First Dime; DOM-only error/invalid/toast fixtures; theme=${theme}; OS=${os}`);
    await page.keyboard.press("Tab");
    await page.locator("#platform").focus();
    await inspect(page, `First Dime; DOM-only invalid focus fixture; theme=${theme}; OS=${os}`, false);
    if (os === theme) await screenshot(page, `error-toast-${theme}-1280.png`);

    const feedbackLabel = `Feedback; theme=${theme}; OS=${os}`;
    await page.locator("#header-menu summary").click();
    await inspect(page, `${feedbackLabel}; menu open`);
    await states(page, `${feedbackLabel}; menu open`);
    await page.locator("#header-menu [data-feedback-open]").click();
    const dialog = page.locator("#feedback-dialog");
    const body = dialog.locator("#feedback-body");
    const feedbackInspect = async (state: string, formVisible: boolean) => {
      const label = `${feedbackLabel}; ${state}`;
      console.log(`contrast feedback starting: ${label}`);
      const measured = await inspectContrast(page, label);
      const native = await inspectNativeGlyphs(page, label);
      pairs.push(...measured, ...native);
      coverage.push(label);
      // These assertions prevent a false pass from auditing inert background controls.
      assert(measured.some(pair => pair.example === (formVisible ? "textarea#feedback-body" : "p#feedback-thanks")), `${label}: modal text sampled`);
      assert(!measured.some(pair => /input#(platform|clock-platform)|button\.act/.test(pair.example)), `${label}: background excluded`);
      assert(native.every(pair => ["input#feedback-blocking", "select#feedback-app"].includes(pair.example)), `${label}: only modal native controls`);
      if (formVisible) assert(native.some(pair => pair.example === "input#feedback-blocking" && pair.role === "native checkbox unchecked" && pair.result === "exempt"), `${label}: neutral native reference painted in modal`);
      await states(page, label);
      if (os === theme) await screenshot(page, `feedback-${state}-${theme}-1280.png`);
      console.log(`contrast feedback collected: ${label}`);
    };
    await feedbackInspect("empty", true);
    await body.fill("   ");
    await dialog.locator("#feedback-submit").click();
    assert.equal(await body.getAttribute("aria-invalid"), "true");
    await feedbackInspect("invalid", true);
    await body.fill("Fictional feedback contrast fixture: unable to save a note.");
    await dialog.locator("#feedback-blocking").check();
    await page.route("**/api/feedback", route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fictional_feedback_failure" }) }));
    await dialog.locator("#feedback-submit").click();
    await page.waitForFunction(() => !!document.getElementById("feedback-error")?.textContent);
    await feedbackInspect("error", true);
    await page.unroute("**/api/feedback");
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let requests = 0;
    await page.route("**/api/feedback", async route => {
      requests++;
      await pending;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await dialog.locator("#feedback-submit").click();
    try {
      await page.waitForFunction(() => (document.getElementById("feedback-submit") as HTMLButtonElement).disabled);
      await feedbackInspect("sending", true);
    } finally { release(); }
    await dialog.locator("#feedback-thanks").waitFor();
    assert.equal(requests, 1);
    await feedbackInspect("sent", false);
    await page.unroute("**/api/feedback");
    await dialog.locator("#feedback-close").click();
    await page.waitForFunction(() => document.activeElement === document.querySelector("#header-menu summary"));

    await page.goto(`${baseUrl}/contrast-login?empty=1`);
    await page.waitForFunction(() => document.getElementById("player-name")?.textContent === "Empty demo player");
    await page.waitForFunction(() => (document.getElementById("sasuStats")?.children.length ?? 0) > 0);
    for (const appName of ["First Dime", "Spotlight", "Freelance", "Market", "Stats", "PayPal"]) {
      await page.getByRole("tab", { name: appName, exact: true }).click();
      if (appName === "Stats") await page.waitForFunction(() => document.querySelectorAll("#app-stats svg[role='img']").length === 3);
      await inspect(page, `${appName}; empty; theme=${theme}; OS=${os}`);
      if (appName === "Market") {
        await page.getByRole("tab", { name: "Selling", exact: true }).click();
        await inspect(page, `${appName}; empty selling; theme=${theme}; OS=${os}`);
      }
    }
    for (const path of ["/"]) {
      const response = await page.goto(`${baseUrl}${path}`);
      assert.equal(response?.status(), 200);
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await inspect(page, `${path}; theme=${theme}; OS=${os}`);
      await states(page, `${path}; theme=${theme}; OS=${os}`);
    }
    for (const [path, location] of [["/privacy", "https://sites.google.com/view/onedime-privacy-policy/home"], ["/terms", "https://sites.google.com/view/onedime-user-agreement/home"]]) {
      const response = await page.request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
      assert.equal(response.status(), 302);
      assert.equal(response.headers().location, location);
      coverage.push(`${path}; local redirect verified without fetching third-party policy`);
    }
    assert.deepEqual(external, [], "Audit must remain on the owned local UI");
    assert.deepEqual(errors, [], "Browser application exceptions");
    await context.close();
    console.log(`contrast coverage collected: theme=${theme}, OS=${os}`);
  }

  const groups = new Map<string, { pair: ContrastPair; states: Set<string>; examples: Set<string> }>();
  for (const pair of pairs) {
    const key = JSON.stringify([pair.kind, pair.role, pair.foreground, pair.background, pair.minimum, pair.result, pair.reason]);
    const group = groups.get(key) ?? { pair, states: new Set<string>(), examples: new Set<string>() };
    group.states.add(pair.state); group.examples.add(pair.example); groups.set(key, group);
  }
  const ordered = [...groups.values()].sort((a, b) => ["fail", "uncovered", "pass", "exempt"].indexOf(a.pair.result) - ["fail", "uncovered", "pass", "exempt"].indexOf(b.pair.result) || a.pair.role.localeCompare(b.pair.role));
  const failures = ordered.filter(group => group.pair.result === "fail");
  const uncovered = ordered.filter(group => group.pair.result === "uncovered");
  const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
  const lines = [`# Current theme contrast: ${before ? "before" : "after"}`, "", "Generated by `scripts/check-current-contrast.ts` from an isolated fictional PostgreSQL fixture and Chromium rendering.", "",
    `- Stylesheet: \`${before ? "docs/contrast/current-before.css" : "public/styles.css"}\``, `- Stylesheet SHA-256: \`${stylesheetHash}\``,
    `- Audit runner SHA-256: \`${runnerHash}\``, `- Browser scanner SHA-256: \`${scannerHash}\``,
    `- Browser: Chromium ${browser.version()}`, `- Unique semantic/color pairs: ${ordered.length}; failing: ${failures.length}; uncovered: ${uncovered.length}.`,
    "- Comparison uses the unrounded ratio. Displayed ratios are rounded to six decimal places.", "- Normal text: 4.5:1; large text and essential icons, identifying control borders, focus indicators: 3:1.",
    "- Alpha colors are composited in sRGB over the actual painted background before relative luminance. Disabled controls and decorative separators are reported as exemptions, never passes.",
    "- Explicit light/dark modes are each checked against both OS schemes. Native browser controls retain platform rendering; their authored text, fill, border and accent are included, with internal glyph coverage documented below.", "",
    "## Contrast table", "", "| Result | Pair/state role | Foreground | Background | Ratio | Required | Example |", "| --- | --- | --- | --- | ---: | ---: | --- |"];
  for (const { pair, examples } of ordered) lines.push(`| ${pair.result.toUpperCase()} | ${escape(pair.role)} | ${pair.foreground} | ${pair.background} | ${pair.ratio === null ? "n/a" : pair.ratio.toFixed(6)} | ${pair.minimum || "n/a"} | ${escape([...examples].slice(0, 3).join(", "))} |`);
  lines.push("", "## Pair coverage and exemptions", "");
  for (const { pair, states, examples } of ordered) lines.push(`- **${escape(pair.role)}**, ${pair.foreground} / ${pair.background}: ${pair.reason || "Authored identifying control color."} Seen in ${states.size} state(s): ${escape([...states].slice(0, 4).join("; "))}${states.size > 4 ? "; additional equivalent states deduplicated" : ""}. Elements: ${escape([...examples].join(", "))}.`);
  lines.push("", "## Route and state coverage", "", ...[...new Set(coverage)].map(value => `- ${value}`), "",
    "## Scope", "", "The audit covers actual DOM text and placeholders, selected text, authored control boundaries, D-pad icons, disclosure markers, keyboard focus, selected tabs, progress fills, hover and pressed button combinations. Error, invalid and toast cases use clearly marked test-only DOM fixtures. Feedback uses the real local UI with intercepted fictional error and delayed-success responses, including empty, invalid, error, sending and sent states. Open modal scans exclude inert background controls; neutral native checkbox references are inserted inside the modal top layer. Empty and populated views use separate fictional players. Policy redirects are checked without fetching third-party destinations. No production API credentials, data or financial/game/auth calculations are changed.", "",
    "Dormant legacy `.goal`, `.coin`, `.ladder`, `.quest` and `.money` selectors are not represented as rendered UI. Decorative container/table separators and aria-hidden goal/controller ornaments are measured and listed as exemptions. Native calendar/month/select/checkbox glyph colors are sampled from actual Chromium element screenshots. Chromium's visited-color privacy protection is handled by requiring unconditional authored link colors and rejecting visited-specific overrides; otherwise coverage is explicitly uncovered. No unsupported authored background is silently accepted.", "");
  if (skinMatrix) lines[0] = "# Paper and Slate skin contrast";
  if (!checkOnly) {
    await mkdir(dirname(reportDestination), { recursive: true });
    await writeFile(reportDestination, lines.join("\n"), "utf8");
  }
  console.log(`contrast ${checkOnly ? "check" : `report: ${reportPath}`}; ${failures.length} failing pairs; ${uncovered.length} uncovered`);
  for (const { pair } of [...failures, ...uncovered]) console.log(`${pair.result}: ${pair.role}; ${pair.foreground} / ${pair.background}; ${pair.ratio?.toFixed(6) ?? "n/a"}; ${pair.example}; ${pair.reason}`);
  if (failures.length || uncovered.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
  await prisma.$disconnect();
  await container.stop();
}
