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
const port = Number(process.env.BROWSER_TEST_PORT ?? 3404);
assert(Number.isInteger(port) && port > 0 && port <= 65535, "Invalid BROWSER_TEST_PORT");
const baseUrl = `http://127.0.0.1:${port}`;
const container = await new PostgreSqlContainer("postgres:16").withDatabase(process.env.TEST_DATABASE_NAME ?? "onedime_browser_test").start();
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
  const config = loadConfig({ NODE_ENV: "test", PORT: String(port), PUBLIC_BASE_URL: baseUrl,
    PAYPAL_CLIENT_ID: "browser-fixture-id", PAYPAL_CLIENT_SECRET: "browser-fixture-secret",
    SESSION_SECRET: randomBytes(32).toString("hex"), PAYOUTS_ENABLED: "false" });
  const sessions = new SessionStore(prisma, config);
  const app = createApp({ config, prisma, paypalClient: {
    exchangeCodeForToken: async () => ({ access_token: "browser-fixture-token" }),
    fetchUserInfo: async () => ({ user_id: "BROWSER-OAUTH-FIXTURE", name: "Login fixture" })
  } });
  app.get("/browser-login", async (_req, res) => { await sessions.createSession(player.id, res); res.redirect("/app"); });
  server = await new Promise(resolve => { const value = app.listen(port, "127.0.0.1", () => resolve(value)); });
  browser = await chromium.launch();
  const loginContext = await browser.newContext();
  try {
    await loginContext.route("https://www.sandbox.paypal.com/**", async route => {
      const authorization = new URL(route.request().url());
      const callback = new URL(authorization.searchParams.get("redirect_uri")!);
      callback.searchParams.set("state", authorization.searchParams.get("state")!);
      callback.searchParams.set("code", "browser-fixture-code");
      await route.fulfill({ status: 200, contentType: "text/html",
        body: `<a href="${callback.toString().replaceAll("&", "&amp;")}">Return to OneDime</a>` });
    });
    const loginPage = await loginContext.newPage();
    // Routing intercepts the first URL in a redirect chain, so begin the mocked
    // provider navigation explicitly while retaining the context's cookie jar.
    const start = await loginContext.request.get(`${baseUrl}/auth/paypal`, { maxRedirects: 0 });
    assert.equal(start.status(), 302);
    await loginPage.goto(start.headers().location);
    await loginPage.getByRole("link", { name: "Return to OneDime" }).click();
    await loginPage.waitForURL(`${baseUrl}/app`);
    const cookies = await loginContext.cookies(baseUrl);
    assert(cookies.some(cookie => cookie.name === "onedime_session" && cookie.httpOnly && cookie.sameSite === "Lax"));
    assert(!cookies.some(cookie => cookie.name === "onedime_oauth_state"));
    assert.equal((await loginContext.request.get(`${baseUrl}/api/me`)).status(), 200);
    console.log("OAuth cross-site return and session cookie passed (mocked provider)");
  } finally { await loginContext.close(); }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [], requests: { url: string; body: string }[] = [];
  let expectedFeedback429 = false;
  let expectedOfflineDisconnect = false;
  let feedback429ConsoleErrors = 0;
  context.on("request", req => requests.push({ url: req.url(), body: req.postData() ?? "" }));
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() !== "error") return;
    if (expectedOfflineDisconnect && message.text().includes("net::ERR_INTERNET_DISCONNECTED")) return;
    if (expectedFeedback429 && message.location().url === `${baseUrl}/api/feedback`
      && /^Failed to load resource:.*\b429\b/.test(message.text()) && feedback429ConsoleErrors++ === 0) return;
    errors.push(message.text());
  });
  await page.goto(`${baseUrl}/browser-login`);
  const welcome=page.getByRole("dialog",{name:"What kind of work do you do?",exact:true});
  await welcome.waitFor();
  assert.equal(await welcome.getByRole("checkbox").count(),4);
  await welcome.getByRole("checkbox",{name:"Freelance",exact:true}).check();
  await welcome.getByRole("checkbox",{name:"Market",exact:true}).check();
  await welcome.getByRole("button",{name:"Continue",exact:true}).click();
  await welcome.waitFor({ state: "hidden" });
  await page.getByRole("tab",{name:"Freelance",exact:true}).waitFor();
  await page.waitForFunction(()=>document.getElementById("app-tab-freelance")?.getAttribute("aria-selected")==="true");
  assert.equal(await page.getByRole("tab",{name:"Freelance",exact:true}).getAttribute("aria-selected"),"true");
  const welcomeGuide=page.getByRole("status",{name:"Start your record",exact:true});
  await welcomeGuide.getByRole("button",{name:"Open PayPal import",exact:true}).click();
  assert.equal(await page.getByRole("tab",{name:"PayPal",exact:true}).getAttribute("aria-selected"),"true");
  assert.equal(await page.locator("#paypal-csv").evaluate(node=>document.activeElement===node),true);
  const welcomeData=await (await page.request.get(`${baseUrl}/api/onboarding`)).json();
  assert.deepEqual(welcomeData,{complete:true});
  await page.getByRole("button",{name:"Appearance",exact:true}).click();
  const appearance=page.getByRole("dialog",{name:"Appearance",exact:true});
  await appearance.getByRole("radio",{name:/Paper/}).check();
  await appearance.getByRole("radio",{name:"Dark",exact:true}).check();
  assert.equal(await page.locator("html").getAttribute("data-skin"),"paper");
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),["onedime-appearance"]);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("onedime-appearance")!)),{skin:"paper",mode:"dark"});
  await appearance.getByRole("button",{name:"Close",exact:true}).click();
  await page.reload();
  await page.getByRole("tab",{name:"Freelance",exact:true}).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-skin"),"paper");
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem("onedime-theme","dark");});
  await page.reload();
  await page.getByRole("tab",{name:"Freelance",exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),["onedime-appearance"]);
  await page.reload();
  await page.getByRole("tab",{name:"Freelance",exact:true}).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme"),"dark","a migrated theme survives a second load");
  await page.getByRole("button",{name:"Appearance",exact:true}).click();
  await page.getByRole("dialog",{name:"Appearance",exact:true}).getByRole("radio",{name:/Slate/}).check();
  await page.getByRole("dialog",{name:"Appearance",exact:true}).getByRole("radio",{name:/System/}).check();
  assert.equal(await page.locator("html").getAttribute("data-skin"),"slate");
  assert.equal(await page.locator("html").getAttribute("data-theme"),null);
  await page.getByRole("dialog",{name:"Appearance",exact:true}).getByRole("radio",{name:/Current/}).check();
  assert.equal(await page.locator("html").getAttribute("data-skin"),null);
  await page.getByRole("dialog",{name:"Appearance",exact:true}).getByRole("radio",{name:"Light",exact:true}).check();
  await page.getByRole("dialog",{name:"Appearance",exact:true}).getByRole("button",{name:"Close",exact:true}).click();
  await page.getByRole("tab", { name: "Market", exact: true }).click();
  const menu = page.locator("#header-menu summary");
  await menu.focus();
  await menu.press("Enter");
  await page.locator("#header-menu").getByRole("button", { name: "Send feedback", exact: true }).press("Enter");
  const feedback = page.getByRole("dialog", { name: "Send feedback", exact: true });
  const feedbackBody = feedback.getByRole("textbox", { name: "What happened", exact: true });
  assert.equal(await feedback.getByRole("combobox", { name: "Which app", exact: true }).inputValue(), "market");
  assert.equal(await feedbackBody.evaluate(node => document.activeElement === node), true);
  await feedbackBody.fill("   ");
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).click();
  assert.equal(await feedbackBody.getAttribute("aria-invalid"), "true");
  assert.equal(await prisma.feedback.count({ where: { playerId: player.id } }), 0);
  await feedbackBody.fill("  Fictional beta test: the Market form needs clearer labels.  ");
  await feedback.getByRole("checkbox", { name: "This blocked me", exact: true }).check();
  await page.route("**/api/feedback", route => route.fulfill({
    status: 429, contentType: "application/json", body: JSON.stringify({ error: "feedback_rate_limited" })
  }));
  expectedFeedback429 = true;
  const limitedFeedback = page.waitForResponse(response => response.url() === `${baseUrl}/api/feedback` && response.status() === 429);
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).click();
  await limitedFeedback;
  await feedback.getByRole("alert").getByText("You have sent five notes in the past hour. Please wait before sending another.", { exact: true }).waitFor();
  assert.equal(await feedbackBody.evaluate(node => document.activeElement === node), true);
  assert.equal(await feedback.locator("form").isVisible(), true);
  assert.equal(await prisma.feedback.count({ where: { playerId: player.id } }), 0);
  await page.unroute("**/api/feedback");
  expectedFeedback429 = false;
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).focus();
  await feedback.getByRole("button", { name: "Send feedback", exact: true }).press("Enter");
  await feedback.getByText("Thanks for your feedback. Your note has been sent.", { exact: true }).waitFor();
  const savedFeedback = await prisma.feedback.findMany({ where: { playerId: player.id } });
  assert.equal(savedFeedback.length, 1);
  assert.equal(savedFeedback[0].app, "market");
  assert.equal(savedFeedback[0].body, "Fictional beta test: the Market form needs clearer labels.");
  assert.equal(savedFeedback[0].blocking, true);
  assert.equal(await feedback.locator("form").isVisible(), false);
  await feedback.getByRole("button", { name: "Close feedback", exact: true }).click();
  await page.waitForFunction(() => document.activeElement === document.querySelector("#header-menu summary"));
  await page.getByRole("tab", { name: "First Dime", exact: true }).click();
  await page.getByRole("tab", { name: "Help", exact: true }).click();
  const helpFeedback = page.locator("#panel-help").getByRole("button", { name: "Send feedback", exact: true });
  await helpFeedback.click();
  assert.equal(await feedback.getByRole("combobox", { name: "Which app", exact: true }).inputValue(), "first");
  assert.equal(await feedbackBody.inputValue(), "");
  await feedbackBody.press("Escape");
  await page.waitForFunction(() => document.activeElement === document.querySelector("#panel-help [data-feedback-open]"));
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
  await page.waitForFunction(() => !(document.querySelector('#paypal-ai input[type="checkbox"]') as HTMLInputElement)?.disabled);
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
  assert(firstRequests.every(req => new URL(req.url).origin === baseUrl));
  assert.equal(errors.length, 0, errors.join("\n"));
  await page.getByRole("tab",{name:"Spotlight",exact:true}).click();
  assert.equal(await page.getByRole("button",{name:"Cancel edit",exact:true}).count(),0);
  await page.getByRole("button",{name:/^Edit /}).first().focus();
  await page.getByRole("button",{name:/^Edit /}).first().press("Enter");
  await page.getByRole("button",{name:"Cancel edit",exact:true}).focus();
  await page.getByRole("button",{name:"Cancel edit",exact:true}).press("Enter");
  assert.equal(await page.getByRole("button",{name:"Cancel edit",exact:true}).count(),0);
  let focusChecks=0;
  const apps=["First Dime","Spotlight","Freelance","Market","Stats","Vault","PayPal"];
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
        if(getComputedStyle(controls).position!=="fixed")return null;
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
  for(const width of [320,390,520,640,768,1024,1280]) {
    await page.setViewportSize({width,height:844});
    const nav=await page.locator("#app-nav").evaluate(el=>({scroll:el.scrollWidth-el.clientWidth,rows:new Set([...el.children].map(tab=>Math.round(tab.getBoundingClientRect().top))).size}));
    assert.ok(nav.scroll<=1,`app tabs scroll sideways at ${width}px`);
    if(width<=520)assert.equal(nav.rows,2,`app tabs sit in rows of four at ${width}px`);
  }
  for(const width of [320,390,1280]) for(const theme of ["light","dark"]) {
    await page.setViewportSize({width,height:844});
    if(await page.locator("html").getAttribute("data-theme")!==theme) {
      const toggleTheme=page.getByRole("button",{name:theme==="dark"?"Switch to dark mode":"Switch to light mode",exact:true});
      await toggleTheme.focus();await toggleTheme.press("Enter");
    }
    for(const appName of apps) {
      if(width===1280&&appName!=="Stats")continue;
      const tab=page.getByRole("tab",{name:appName,exact:true});await tab.focus();await tab.press("Enter");
      assert.equal(await tab.getAttribute("aria-selected"),"true");
      if(appName==="First Dime")await checkTabKeys("secNav",["Log","Quests","Leaderboard","Playbook","Help"]);
      if(appName==="Market")await checkTabKeys("balNav",["Delivery and rides","Selling"]);
      if(appName==="Stats") {
        await page.locator("#app-stats svg[role=img]").first().waitFor();
        assert.equal(await page.locator("#app-stats svg[role=img]").count(),3);
        assert.equal(await page.locator("#app-stats details summary",{hasText:"Show as a table"}).count(),3);
      }
      if(appName==="Vault") {
        const vault=page.getByRole("tabpanel",{name:"Vault",exact:true});
        assert.equal(await vault.getByRole("img").count(),1,"only the Vault picture is an image");
        assert.match(await vault.locator(".vault-frame").getAttribute("aria-label")??"",/^The Vault/);
        assert.match(await vault.getByRole("status").textContent()??"",/\d+ \/ 100 tiles broken|Penny is awake/);
        await vault.getByText("What breaks tiles",{exact:true}).waitFor();
        assert.deepEqual(await vault.locator(".vault-bot svg").evaluateAll(svgs=>svgs.map(svg=>svg.getAttribute("viewBox")+" "+(svg.querySelectorAll("rect").length>40))),
          Array(5).fill("0 0 16 16 true"),"each robot is a 16x16 pixel sprite");
        await page.emulateMedia({reducedMotion:"reduce"});
        assert.equal(await vault.locator(".vault-tile:not(.gone)").first().evaluate(tile=>{tile.classList.add("crumble");return getComputedStyle(tile).visibility;}),"hidden",
          "a newly broken tile is hidden even when its animation is off");
        await page.emulateMedia({reducedMotion:null});
      }
      await checkPanel(`${appName} ${width} ${theme}`);
      await page.evaluate(()=>window.scrollTo(0,0));
      if(appName==="Stats")await page.screenshot({path:`docs/screenshots/p5-stats-${width}-${theme}.png`,fullPage:true});
    }
    if(width!==1280)await page.getByRole("tab",{name:"First Dime",exact:true}).click();
    for(const name of width===1280?[]:["Log","Quests","Leaderboard","Playbook","Help"]) {
      const tab=page.getByRole("tab",{name,exact:true});await tab.focus();await tab.press("Enter");
      assert.equal(await tab.getAttribute("aria-selected"),"true");
      await checkPanel(`${name} ${width} ${theme}`);
    }
    if(width!==1280)await page.getByRole("tab",{name:"Market",exact:true}).click();
    for(const name of width===1280?[]:["Delivery and rides","Selling"]) {
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
  console.log(`browser accessibility check passed: ${focusChecks} tab steps, five workspaces plus Stats and PayPal, all sub-tabs, 320/390/1280px, both themes`);
  await mkdir("docs/screenshots", { recursive: true });
  await page.reload();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cachedPaths=await page.evaluate(async()=>{
    const names=await caches.keys();
    const requests=(await Promise.all(names.map(async name=>(await caches.open(name)).keys()))).flat();
    return requests.map(request=>new URL(request.url).pathname);
  });
  assert.equal(cachedPaths.some(path=>path==="/api"||path.startsWith("/api/")),false,"no API data may be cached");
  assert(cachedPaths.includes("/styles.css"));
  expectedOfflineDisconnect = true;
  await context.setOffline(true);
  await page.goto(`${baseUrl}/app`);
  await page.getByText("You're offline. Reconnect to load or save your work.",{exact:true}).waitFor();
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab",{name:"PayPal",exact:true}).waitFor();
  expectedOfflineDisconnect = false;
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
    const response = await page.request.get(`${baseUrl}/${policy}`, { maxRedirects: 0 });
    assert.equal(response.status(), 302);
    assert.equal(response.headers().location, url);
    assert.equal(await page.locator(`footer a[href="${url}"]`).count(), 1);
    assert.equal(await page.locator(`#panel-help a[href="${url}"]`).count(), 1);
  }
  await page.getByRole("textbox",{name:"Deletion confirmation",exact:true}).fill("DELETE MY DATA");
  await page.getByRole("button",{name:"Delete my data",exact:true}).focus();
  await page.getByRole("button",{name:"Delete my data",exact:true}).press("Enter");
  await page.waitForURL(`${baseUrl}/`);
  assert.equal(await prisma.player.findUnique({where:{id:player.id}}),null);
  assert.equal(await prisma.feedback.count({where:{playerId:player.id}}),0);
  await page.getByRole("link", { name: "Log in with PayPal", exact: true }).waitFor();
  console.log("browser smart check passed: opt-in, inference, private requests, cached reload");
} finally {
  await browser?.close();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
  await prisma.$disconnect();
  await container.stop();
}
