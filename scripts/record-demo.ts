import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import { once } from "node:events";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const baseUrl = "http://127.0.0.1:3403";
const output = "video";
const views = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 }
];
const realPlatformNames = [
  "Prolific", "Rev", "TranscribeMe", "SideShift", "Microworkers", "YouTube", "TikTok", "Instagram", "Facebook",
  "Upwork", "Fiverr", "Freelancer.com", "Toptal", "Behance", "Dribbble", "DoorDash", "Uber", "Uber Eats", "Lyft",
  "Instacart", "Grubhub", "TaskRabbit", "Rover", "Thumbtack", "Amazon", "eBay", "Etsy", "Facebook Marketplace",
  "TikTok Shop", "Shopify", "Printify Shop", "Printify", "Ninja Transfers"
];
const date = new Date().toLocaleDateString("en-US", { timeZone: "Pacific/Honolulu" });
const localDateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date()).map(part => [part.type, part.value]));
const isoDate = `${localDateParts.year}-${localDateParts.month}-${localDateParts.day}`;

let demoServer: ChildProcess | undefined;
let browser: Browser | undefined;

async function startDemo() {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DEMO_VIDEO: "true",
    PORT: "3403",
    PUBLIC_BASE_URL: baseUrl,
    SESSION_SECRET: randomBytes(32).toString("hex"),
    PAYOUTS_ENABLED: "false"
  };
  demoServer = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/demo.ts"], {
    cwd: process.cwd(), env, stdio: "ignore", windowsHide: true
  });
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    if (demoServer.exitCode !== null) throw new Error("The isolated demo server exited before becoming ready.");
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch { /* Wait for Testcontainers, migrations and the local server. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("The isolated demo server did not become ready within two minutes.");
}

async function stopDemo() {
  if (!demoServer || demoServer.exitCode !== null) return;
  const child = demoServer;
  child.kill();
  await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 10_000))]);
  demoServer = undefined;
}

async function record(view: typeof views[number]) {
  await startDemo();
  const started = Date.now();
  const context: BrowserContext = await browser!.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.width < 500 ? 2 : 1,
    reducedMotion: "no-preference",
    recordVideo: { dir: output, size: { width: view.width, height: view.height } }
  });
  const page: Page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/demo-login`, { waitUntil: "domcontentloaded" });
    console.log(`Opened ${page.url()} (${await page.title()}): ${(await page.locator("body").innerText()).slice(0, 180).replace(/\s+/g, " ")}`);
    await page.getByRole("tab", { name: "First Dime" }).waitFor();
    await page.getByText("Local demo · fictional data · no PayPal connection").waitFor();
    await page.waitForTimeout(16_000);
    const skip = page.locator("#welcome-skip");
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.locator("#welcome-dialog").waitFor({ state: "hidden" });
    }

    await page.locator("#platform").fill("SurveyNest");
    await page.locator("#worked-on").fill(isoDate);
    await page.locator("#minutes").fill("42");
    await page.locator("#amount").fill("3.25");
    await page.locator("#note").fill("Fictional studio task");
    await page.getByRole("button", { name: "Log it" }).click();
    await page.waitForFunction(async () => {
      const response = await fetch("/api/entries"), data = await response.json();
      return data.entries?.some((entry: { platform: string; amountCents: number }) => entry.platform === "Prolific" && entry.amountCents === 325);
    });
    await page.waitForTimeout(22_000);
    const created = await page.evaluate(async () => {
      const response = await fetch("/api/entries");
      return response.json() as Promise<{ entries: { id: string; platform: string; amountCents: number }[] }>;
    });
    const starter = created.entries.find(entry => entry.platform === "Prolific" && entry.amountCents === 325);
    assert.ok(starter, `the fictional label must be translated back to the canonical platform value in the API: ${JSON.stringify(created.entries)}`);

    await page.getByRole("tab", { name: "Spotlight" }).click();
    await page.locator("#sAmt").fill("25.00");
    await page.locator("#sDate").fill(isoDate);
    await page.locator("#sMin").fill("45");
    await page.locator("#sNote").fill("Fictional creator clip");
    await page.getByRole("button", { name: "Add income" }).click();
    await page.locator("#sIncBody tr").first().waitFor();
    await page.waitForTimeout(5_000);

    await page.getByRole("tab", { name: "Freelance" }).click();
    await page.locator("#jBody tr").first().waitFor();
    await page.waitForTimeout(4_000);
    await page.getByRole("tab", { name: "Market" }).click();
    await page.locator("#dBody tr").first().waitFor();
    await page.waitForTimeout(4_000);

    const csv = [
      "Date,Name,Gross,Fee,Net,Currency,Transaction ID,Type,Email,IP Address",
      `${date},Prolific,3.25,0.00,3.25,USD,DEMO-STARTER,General Payment,,`,
      `${date},Fictional Studio,25.00,0.00,25.00,USD,DEMO-CREATOR,General Payment,,`,
      `${date},Fictional Studio,100.00,-10.00,90.00,USD,DEMO-FREELANCE,General Payment,,`,
      `${date},Fictional Studio,24.00,0.00,24.00,USD,DEMO-DELIVERY,General Payment,,`,
      `${date},Fictional Studio,19.00,0.00,19.00,USD,DEMO-SALE,General Payment,,`
    ].join("\n");
    await page.getByRole("tab", { name: "PayPal" }).click();
    await page.locator("#paypal-csv").setInputFiles({ name: "fictional-payments.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await page.getByRole("button", { name: "Import activity CSV" }).click();
    await page.waitForTimeout(7_000);
    const routed = await page.evaluate(async (starterId) => {
      const responses = await Promise.all([
        fetch("/api/paypal/transactions"), fetch("/api/entries"), fetch("/api/spotlight/income"),
        fetch("/api/freelance/gigs"), fetch("/api/market/shifts"), fetch("/api/market/sales")
      ]);
      for (const response of responses) if (!response.ok) throw new Error("Could not load fictional demo records.");
      const [payments, entryData, incomeData, gigData, shiftData, saleData] = await Promise.all([
        responses[0].json(), responses[1].json(), responses[2].json(), responses[3].json(), responses[4].json(), responses[5].json()
      ]);
      const income = incomeData.rows as { id: string }[], gigs = gigData.rows as { id: string }[];
      const shifts = shiftData.rows as { id: string }[], sales = saleData.rows as { id: string }[];
      const paymentRows = payments.rows as { id: string; txn_id: string }[];
      const specs = [
        ["DEMO-STARTER", "first", starterId, "Prolific"],
        ["DEMO-CREATOR", "income", income[0]?.id, "YouTube"],
        ["DEMO-FREELANCE", "gigs", gigs[0]?.id, "Upwork"],
        ["DEMO-DELIVERY", "shifts", shifts[0]?.id, "Uber"],
        ["DEMO-SALE", "sales", sales[0]?.id, "Printify Shop"]
      ] as const;
      for (const [txn, recordType, recordId, platform] of specs) {
        let payment: { id: string; txn_id: string } | undefined;
        for (const candidate of paymentRows) if (candidate.txn_id === txn) payment = candidate;
        if (!payment || !recordId) throw new Error(`Missing fictional ${txn} demo row.`);
        const response = await fetch(`/api/paypal/transactions/${payment.id}/route`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record_type: recordType, record_id: recordId, platform })
        });
        if (!response.ok) throw new Error(`Could not link fictional ${txn} payment.`);
      }
      return true;
    }, starter.id);
    assert.equal(routed, true);
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.getByRole("tab", { name: "First Dime" }).click();
    await page.locator("#rank-first").waitFor();
    await page.waitForTimeout(17_000);
    await page.getByRole("tab", { name: "Stats" }).click();
    await page.locator("#stats-month-chart svg").waitFor();
    await page.locator("#stats-kpis").waitFor();
    await page.waitForTimeout(19_000);
    const showTable = page.locator("#app-stats summary", { hasText: "Show as a table" }).first();
    await showTable.click();
    await page.waitForTimeout(5_000);
    await page.locator("#app-stats").screenshot({ path: `${output}/stats-${view.name}.png` });

    await page.getByRole("tab", { name: "PayPal" }).click();
    await page.locator("#paypal-monthly").waitFor();
    await page.waitForTimeout(18_000);
    await page.getByRole("tab", { name: "First Dime" }).click();
    await page.locator("#tab-help").click();
    await page.waitForTimeout(16_000);
    await page.getByRole("tab", { name: "Stats" }).click();
    await page.waitForTimeout(8_000);

    const visibleText = await page.locator("body").innerText();
    for (const name of realPlatformNames) assert.ok(!visibleText.includes(name), `a real platform label appeared in demo UI: ${name}`);
    assert.ok(visibleText.includes("Local demo · fictional data · no PayPal connection"));
    const elapsedMs = Date.now() - started;
    assert.ok(elapsedMs < 160_000, `The ${view.name} walkthrough took ${Math.ceil(elapsedMs / 1000)} seconds, above the 2:40 limit.`);
    console.log(`${view.name} demo recorded in ${Math.ceil(elapsedMs / 1000)}s with fictional visible labels and canonical server data.`);
  } finally {
    const video = page.video();
    await context.close();
    if (video) {
      const videoPath = await video.path();
      await rename(videoPath, `${output}/walkthrough-${view.name}.webm`).catch(() => undefined);
    }
    await stopDemo();
  }
}

await mkdir(output, { recursive: true });
browser = await chromium.launch({ headless: true });
try {
  for (const view of views) await record(view);
} finally {
  await browser.close();
}
