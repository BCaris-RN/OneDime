import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { chromium, type Page } from "playwright";

type Target = { label: string; color: string; relaxed: boolean; rects: { x: number; y: number; w: number; h: number }[] };

const types: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png",
  ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json"
};
const root = join(process.cwd(), "public");
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = join(root, normalize(pathname === "/" ? "/index.html" : pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
  readFile(file).then(
    body => response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body),
    () => response.writeHead(404).end()
  );
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// The console shell is painted with gradients, which the DOM-based audit can't resolve. Hide every glyph,
// screenshot the viewport as it scrolls (the starfield is fixed), then compare each text color with the
// worst pixel under its line boxes. The LCD grid and starfield are dropped: the grid also covers the glyphs,\n// and stars are decoration. Large text and aria-hidden hardware print only need 3:1.\n// Tilted labels are sampled at the center of their box, since the box overlaps the neighboring buttons.
async function measure(page: Page) {
  const targets = await page.evaluate((): Target[] => {
    const found: Target[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
      if (node.closest("[hidden],.sr,.skip,script,style,svg")) continue;
      const own = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
      if (!own.length) continue;
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      const tilted = [...(function* () { for (let el: Element | null = node; el; el = el.parentElement) yield el; })()].some(el => getComputedStyle(el).rotate !== "none");
      const range = document.createRange();
      const rects = own.flatMap(text => { range.selectNodeContents(text); return [...range.getClientRects()]; })
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({ x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height }))
        .map(rect => tilted ? { x: rect.x + rect.w / 3, y: rect.y + rect.h / 3, w: Math.max(1, rect.w / 3), h: Math.max(1, rect.h / 3) } : rect);
      if (!rects.length) continue;
      const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
      const name = node.tagName.toLowerCase() + (node.id ? "#" + node.id : "") + (node.className ? "." + String(node.className).split(" ")[0] : "");
      found.push({ label: `${name} "${own[0].textContent!.trim().slice(0, 24)}"`, color: style.color, relaxed: size >= 24 || (bold && size >= 18.66) || !!node.closest("[aria-hidden=true]"), rects });
    }
    return found;
  });
  const hide = await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}.lcd::after,.stars,.scan{display:none!important}" });
  const { height, total } = await page.evaluate(() => ({ height: innerHeight, total: document.documentElement.scrollHeight }));
  const worst = new Map<string, { ratio: number; required: number }>();
  for (let top = 0; top < total; top += height) {
    const offset = Math.min(top, Math.max(0, total - height));
    await page.evaluate(y => scrollTo(0, y), offset);
    const png = (await page.screenshot()).toString("base64");
    const inView = targets.map(target => ({ ...target, rects: target.rects.filter(rect => rect.y >= offset && rect.y + rect.h <= offset + height)
      .map(rect => ({ ...rect, y: rect.y - offset })) })).filter(target => target.rects.length);
    const results = await page.evaluate(async ({ png, targets }) => {
      const image = new Image();
      image.src = "data:image/png;base64," + png;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      return targets.map(target => {
        const [r, g, b, a = "1"] = target.color.match(/[\d.]+/g)!;
        const alpha = Number(a);
        let low = Infinity;
        for (const rect of target.rects) {
          const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y));
          const w = Math.min(canvas.width - x, Math.ceil(rect.w)), h = Math.min(canvas.height - y, Math.ceil(rect.h));
          if (w <= 0 || h <= 0) continue;
          const data = context.getImageData(x, y, w, h).data;
          for (let i = 0; i < data.length; i += 4) {
            const mix = (fg: string, bg: number) => Number(fg) * alpha + bg * (1 - alpha);
            const text = luminance(mix(r, data[i]), mix(g, data[i + 1]), mix(b, data[i + 2]));
            const back = luminance(data[i], data[i + 1], data[i + 2]);
            low = Math.min(low, (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05));
          }
        }
        return { label: target.label, ratio: low, required: target.relaxed ? 3 : 4.5 };
      });
    }, { png, targets: inView });
    for (const result of results) {
      const seen = worst.get(result.label);
      if (!seen || result.ratio < seen.ratio) worst.set(result.label, result);
    }
  }
  await hide.evaluate(node => node.remove());
  await page.evaluate(() => scrollTo(0, 0));
  return [...worst].map(([label, value]) => ({ label, ...value }));
}
// Keys take the console from its home screen to the other two screens that carry text.
const screens = [["home", "s-home", null], ["tour", "s-tour", "ArrowLeft"], ["info", "s-info", "ArrowDown"]] as const;
const problems: string[] = [];
const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: scheme, reducedMotion: "reduce" });
    await context.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    const page = await context.newPage();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.goto(origin);
      await page.evaluate(() => document.fonts.ready);
      await page.locator("#s-home").waitFor({ state: "visible" });
      for (const [name, id, key] of screens) {
        if (key) await page.keyboard.press(key);
        await page.locator(`#${id}`).waitFor({ state: "visible" });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `landing ${name} at ${width}px overflowed by ${overflow}px`);
        const results = await measure(page);
        assert.ok(results.length > 0, `landing ${name} at ${width}px found no text to measure`);
        const failing = results.filter(result => result.ratio < result.required)
          .map(result => `${result.label} ${result.ratio.toFixed(2)} < ${result.required}`);
        problems.push(...failing.map(line => `${name} at ${width}px, OS ${scheme}: ${line}`));
        console.log(`landing checked: ${name}; OS=${scheme}; width=${width}; text runs=${results.length}; low contrast=${failing.length}`);
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
