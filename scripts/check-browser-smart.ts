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
  await prisma.payout.createMany({ data: [
    {playerId:player.id,rungCents:10,amountCents:10,status:"BLOCKED",batchStatus:"SUCCESS"},
    {playerId:player.id,rungCents:100,amountCents:10,status:"HELD",batchStatus:"SUCCESS"}
  ] });
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
  page.on("console", message => { if(message.type()==="error")errors.push(message.text()); });
  await page.goto("http://127.0.0.1:3404/browser-login");
  await page.getByRole("tab", { name: "Spotlight", exact: true }).click();
  await page.waitForFunction(() => (document.getElementById("sasuStats")?.children.length??0)>0);
  const spotMonth=page.getByLabel("Stats month: Spotlight",{exact:true});
  const older=page.waitForResponse(r=>r.url().includes("/spotlight/summary?month=2026-09"));
  await spotMonth.fill("2026-09"); await spotMonth.press("Tab");
  assert.equal((await older).status(),200);
  await page.getByRole("tab", { name: "PayPal", exact: true }).click();
  await page.getByRole("heading",{name:"This month, everywhere",exact:true}).waitFor();
  await page.getByText(/Item: BLOCKED/).waitFor();
  await page.getByText(/Item: HELD/).waitFor();
  const overviewMonth=page.getByLabel("Stats month: PayPal",{exact:true});
  await overviewMonth.fill("2026-09");await overviewMonth.press("Tab");
  await page.getByRole("region",{name:"Everywhere in 2026-09 table",exact:true}).waitFor();
  await overviewMonth.fill("2026-10");await overviewMonth.press("Tab");
  await page.getByRole("region",{name:"Everywhere in 2026-10 table",exact:true}).waitFor();
  await page.locator("summary").filter({hasText:"Export everything"}).click();
  assert.equal(await page.getByRole("tabpanel",{name:"PayPal",exact:true}).getByLabel("From (optional)",{exact:true}).inputValue(),"");
  assert.equal(await page.getByRole("tabpanel",{name:"PayPal",exact:true}).getByLabel("To (optional)",{exact:true}).inputValue(),"");
  await page.locator("summary").filter({hasText:"Export everything"}).click();
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
  await page.getByRole("tab",{name:"Spotlight",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Cancel edit",exact:true}).count(),0);
  await page.getByRole("button",{name:/^Edit /}).first().focus();
  await page.getByRole("button",{name:/^Edit /}).first().press("Enter");
  await page.getByRole("button",{name:"Cancel edit",exact:true}).focus();
  await page.getByRole("button",{name:"Cancel edit",exact:true}).press("Enter");
  assert.equal(await page.getByRole("button",{name:"Cancel edit",exact:true}).count(),0);
  let focusChecks=0;
  const apps=["First Dime","Spotlight","Freelance","Market","PayPal"];
  async function checkPanel(label:string) {
    const issues=await page.evaluate(()=>{
      const issues:string[]=[];
      if(document.documentElement.scrollWidth>innerWidth)issues.push("page overflow");
      for(const table of document.querySelectorAll("table"))if(table.checkVisibility()) {
        if(!table.caption?.textContent?.trim())issues.push("table caption missing");
        if([...table.querySelectorAll("thead th")].some(th=>th.getAttribute("scope")!=="col"||!th.textContent?.trim()))issues.push("column header missing");
      }
      for(const control of document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea"))
        if(control.checkVisibility()&&!control.labels?.length&&!control.getAttribute("aria-label")&&!control.getAttribute("aria-labelledby"))issues.push(`input label missing ${control.id}`);
      return issues;
    });
    assert.deepEqual(issues,[],label);
    const count=await page.locator("input:visible,select:visible,textarea:visible,button:visible,a:visible,[tabindex='0']:visible").count();
    for(let index=0;index<count*2+8;index++) {
      await page.keyboard.press("Tab");
      await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
      const issue=await page.evaluate(()=>{
        const target=document.activeElement as HTMLElement|null,controls=document.querySelector<HTMLElement>(".controls");
        if(!target?.matches("input,select,textarea,button,a,summary,[tabindex='0']")||!controls)return null;
        const style=getComputedStyle(target);
        if(style.outlineStyle==="none"||parseFloat(style.outlineWidth)<1)return `invisible focus: ${target.id||target.tagName}`;
        if(controls.contains(target))return null;
        const rect=target.getBoundingClientRect(),bottom=controls.getBoundingClientRect().top;
        const covered=rect.height>bottom-24
          ?rect.top<0||rect.top>bottom-28:rect.bottom>bottom-4||rect.top<0;
        return covered?`covered focus: ${target.id||target.tagName}`:null;
      });assert.equal(issue,null,label);focusChecks++;
    }
  }
  async function checkTabKeys(id:string,names:string[]) {
    const selected=page.locator(`#${id} [aria-selected="true"]`);await selected.focus();
    for(const [key,name] of [["Home",names[0]],["End",names.at(-1)!],["ArrowLeft",names.at(-2)!],["ArrowRight",names.at(-1)!],["Home",names[0]]]) {
      await page.keyboard.press(key);
      assert.equal(await selected.textContent(),name);
      assert.equal(await selected.evaluate(el=>el===document.activeElement),true);
    }
  }
  for(const name of ["Scroll up","Scroll down","Previous tab","Next tab","B: clock in or out","A: log a session"])
    assert.equal(await page.getByRole("button",{name,exact:true}).count(),1);
  await checkTabKeys("app-nav",apps);
  for(const width of [320,390]) for(const theme of ["light","dark"]) {
    await page.setViewportSize({width,height:844});
    if(await page.locator("html").getAttribute("data-theme")!==theme) {
      const toggleTheme=page.getByRole("button",{name:theme==="dark"?"Switch to dark mode":"Switch to light mode",exact:true});
      await toggleTheme.focus();await toggleTheme.press("Enter");
    }
    for(const appName of apps) {
      const tab=page.getByRole("tab",{name:appName,exact:true});await tab.focus();await tab.press("Enter");
      assert.equal(await tab.getAttribute("aria-selected"),"true");
      if(appName==="First Dime")await checkTabKeys("secNav",["Log","Quests","Leaderboard","Playbook","Help"]);
      if(appName==="Market")await checkTabKeys("balNav",["Delivery and rides","Selling"]);
      await checkPanel(`${appName} ${width} ${theme}`);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`docs/screenshots/p4-${width}-${theme}-${appName.toLowerCase().replaceAll(" ","-")}.png`,fullPage:true});
    }
    await page.getByRole("tab",{name:"First Dime",exact:true}).click();
    for(const name of ["Log","Quests","Leaderboard","Playbook","Help"]) {
      const tab=page.getByRole("tab",{name,exact:true});await tab.focus();await tab.press("Enter");
      assert.equal(await tab.getAttribute("aria-selected"),"true");
      await checkPanel(`${name} ${width} ${theme}`);
    }
    await page.getByRole("tab",{name:"Market",exact:true}).click();
    for(const name of ["Delivery and rides","Selling"]) {
      const tab=page.getByRole("tab",{name,exact:true});await tab.focus();await tab.press("Enter");
      assert.equal(await tab.getAttribute("aria-selected"),"true");
      await checkPanel(`${name} ${width} ${theme}`);
      if(name==="Selling") {
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:`docs/screenshots/p4-${width}-${theme}-selling.png`,fullPage:true});
      }
    }
  }
  await page.getByRole("tab",{name:"PayPal",exact:true}).click();
  console.log(`browser accessibility check passed: ${focusChecks} tab steps, five apps, all sub-tabs, 320/390px, both themes`);
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/p3-phone-overview.png", fullPage: true });
  await page.getByRole("heading",{name:"Settings",exact:true}).locator("..").screenshot({path:"docs/screenshots/p3-phone-settings.png"});
  await page.reload();
  await page.getByRole("tab", { name: "PayPal", exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(b => b.textContent === "Download and suggest" && !b.disabled));
  assert.equal(await toggle.isChecked(), true);
  const secondStart = requests.length;
  await button.focus(); await button.press("Enter");
  await page.getByText(/^Suggestions ready\./).waitFor({ timeout: 125000 });
  assert.equal(requests.slice(secondStart).filter(req => req.url.endsWith("model_quantized.onnx")).length, 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  for (const [policy, url] of [
    ["privacy", "https://sites.google.com/view/onedime-privacy-policy/home"],
    ["terms", "https://sites.google.com/view/onedime-user-agreement/home"],
  ]) {
    const response = await page.request.get(`http://127.0.0.1:3404/${policy}`, { maxRedirects: 0 });
    assert.equal(response.status(), 302);
    assert.equal(response.headers().location, url);
    assert.equal(await page.locator(`footer a[href="${url}"]`).count(), 1);
    assert.equal(await page.locator(`#panel-help a[href="${url}"]`).count(), 1);
  }
  await page.getByRole("textbox",{name:"Deletion confirmation",exact:true}).fill("DELETE MY DATA");
  await page.getByRole("button",{name:"Delete my data",exact:true}).focus();
  await page.getByRole("button",{name:"Delete my data",exact:true}).press("Enter");
  await page.waitForURL("http://127.0.0.1:3404/");
  assert.equal(await prisma.player.findUnique({where:{id:player.id}}),null);
  console.log("browser smart check passed: opt-in, inference, private requests, cached reload");
} finally {
  await browser?.close();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
  await prisma.$disconnect();
  await container.stop();
}
