import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { measureText } from "./pixel-contrast.js";

const types: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png",
  ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json"
};
const root = join(process.cwd(), "public");
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  if (pathname === "/demo-video-mode.js") {
    response.writeHead(200, { "Content-Type": "application/javascript" }).end("window.__ONEDIME_DEMO_VIDEO__=false;");
    return;
  }
  const file = join(root, normalize(pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  readFile(file).then(
    body => response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body),
    () => response.writeHead(404).end()
  );
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// Keys take the console from its home screen to the other two screens that carry text.
const screens = [["home", "s-home", null], ["tour", "s-tour", "ArrowLeft"], ["info", "s-info", "ArrowDown"]] as const;
const problems: string[] = [];
const browser = await chromium.launch();
try {
  for (const skin of ["current", "paper", "slate", "glass"] as const) for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    const page = await context.newPage();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.goto(origin);
      await page.evaluate(skin => { document.documentElement.dataset.skin = skin; }, skin);
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#s-home").waitFor({ state: "visible" });
      for (const [name, id, key] of screens) {
        if (key) await page.keyboard.press(key);
        await page.locator(`#${id}`).waitFor({ state: "visible" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `landing ${name} at ${width}px overflowed by ${overflow}px`);
        // The LCD grid also covers the glyphs, and the stars are decoration, so neither counts as background.
        const results = await measureText(page, { skip: ".sr,.skip", hide: ".lcd::after,.stars,.scan{display:none!important}" });
        assert.ok(results.length > 0, `landing ${name} at ${width}px found no text to measure`);
        const soundButton = results.find(result => result.label.startsWith("button#landing-sound-cycle"));
        assert.ok(soundButton, `landing Sound button at ${width}px was measured`);
        assert.ok(soundButton.ratio >= soundButton.required,
          `landing Sound button contrast failed for skin=${skin}; OS=${scheme}; width=${width}: ${soundButton.ratio.toFixed(2)} < ${soundButton.required}`);
        const failing = results.filter(result => result.ratio < result.required)
          .map(result => `${result.label} ${result.ratio.toFixed(2)} < ${result.required}`);
        problems.push(...failing.map(line => `${name}; skin=${skin}; width=${width}; OS ${scheme}: ${line}`));
        console.log(`landing checked: ${name}; skin=${skin}; OS=${scheme}; width=${width}; text runs=${results.length}; low contrast=${failing.length}`);
        if (key) await page.keyboard.press("Escape");
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
assert.deepEqual(problems, [], "landing text is below its contrast minimum");
