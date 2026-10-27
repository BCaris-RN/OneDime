import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { inspectContrast } from "./current-contrast.js";

const css = await readFile("public/styles.css", "utf8");
const browser = await chromium.launch();
const skins = ["paper", "slate"] as const;
const modes = ["system", "light", "dark"] as const;
const schemes = ["light", "dark"] as const;
const widths = [320, 390, 1280] as const;
const fixture = [
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">',
  "<style>" + css + "</style></head><body>",
  '<header class="topbar"><a class="brand">OneDime</a><div class="player-strip"><button id="appearance-open" class="ghost-button">Appearance</button><button class="text-button">Log out</button></div></header>',
  '<nav class="apps" id="app-nav" aria-label="Apps"><button aria-selected="true">First Dime</button><button>Spotlight</button><button>Freelance</button><button>Market</button><button>Stats</button><button>PayPal</button></nav>',
  '<main class="shell"><section class="slip"><h1>Fictional work record</h1><p class="muted">Theme check text on a panel.</p><a href="#">Privacy</a>',
  '<label>Platform<input value="Prolific" placeholder="Choose a platform"></label><label>Month<select><option>October</option></select></label>',
  '<div class="btns"><button class="primary-button">Save entry</button><button class="ghost-button">Cancel</button><button class="act ghost small">Secondary action</button></div>',
  '<div class="bar"><i style="width:60%"></i></div></section><section class="goal-hero"><h2>Progress</h2><p>Fictional goal total</p></section>',
  '<dl class="stats"><div><dt>Earned this month</dt><dd class="money">$12.34</dd></div><div><dt>Verified share</dt><dd>75%</dd></div></dl>',
  '<section class="stats-screen"><section class="stats-lcd"><h2>Your stats</h2><p>Fictional work across every app.</p><svg role="img" aria-label="Six months of fictional earnings"><rect class="stats-bar" width="40" height="22"/><text>October</text></svg><details><summary>Show as a table</summary><table><caption>Fictional totals</caption><tr><th>Month</th><th>Earned</th></tr><tr><td>October</td><td>$12.34</td></tr></table></details></section></section>',
  '<dialog id="appearance-dialog" class="feedback-dialog appearance-dialog" aria-label="Appearance"><h2>Appearance</h2><fieldset><legend>Skin</legend><label><input type="radio" checked> Paper <span>warm with a blue accent</span></label><label><input type="radio"> Slate</label></fieldset><fieldset><legend>Mode</legend><label><input type="radio" checked> System</label><label><input type="radio"> Light</label><label><input type="radio"> Dark</label></fieldset></dialog>',
  "</main></body></html>"
].join("");

try {
  for (const skin of skins) for (const mode of modes) for (const scheme of schemes) {
    const context = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    const page = await context.newPage();
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.setContent(fixture);
      await page.evaluate(({ skin, mode }) => {
        const root = document.documentElement;
        root.dataset.skin = skin;
        if (mode === "system") delete root.dataset.theme;
        else root.dataset.theme = mode;
      }, { skin, mode });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 1, skin + "/" + mode + "/OS-" + scheme + " at " + width + "px overflowed by " + overflow + "px");
      const pairs = await inspectContrast(page, skin + "; mode=" + mode + "; OS=" + scheme + "; width=" + width);
      const failures = pairs.filter(pair => pair.result === "fail" || pair.result === "uncovered");
      assert.deepEqual(failures.map(pair => ({ result: pair.result, role: pair.role, fg: pair.foreground, bg: pair.background, example: pair.example })), [],
        skin + "/" + mode + "/OS-" + scheme + " at " + width + "px must have no failing or uncovered color pairs");
      const chartInk = await page.locator(".stats-bar").evaluate(node => getComputedStyle(node).fill);
      const dark = mode === "dark" || (mode === "system" && scheme === "dark");
      const expectedInk = skin === "paper" ? (dark ? "rgb(169, 200, 242)" : "rgb(30, 77, 140)")
        : (dark ? "rgb(242, 179, 61)" : "rgb(138, 90, 0)");
      assert.equal(chartInk, expectedInk, skin + "/" + mode + "/OS-" + scheme + " uses the pilot chart ink");
      await page.locator("#appearance-dialog").evaluate(node => (node as HTMLDialogElement).showModal());
      const modalPairs = await inspectContrast(page, skin + "; appearance modal; mode=" + mode + "; OS=" + scheme + "; width=" + width);
      const modalFailures = modalPairs.filter(pair => pair.result === "fail" || pair.result === "uncovered");
      assert.deepEqual(modalFailures.map(pair => ({ result: pair.result, role: pair.role, fg: pair.foreground, bg: pair.background, example: pair.example })), [],
        skin + "/" + mode + "/OS-" + scheme + " Appearance modal must have no failing or uncovered color pairs");
      console.log("skin passed: " + skin + "; mode=" + mode + "; OS=" + scheme + "; width=" + width + "; pairs=" + (pairs.length + modalPairs.length));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
