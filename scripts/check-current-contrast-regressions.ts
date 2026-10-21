import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { inspectContrast, inspectNativeGlyphs } from "./current-contrast.js";

const css = await readFile("public/styles.css", "utf8");
const baseline = await readFile("docs/contrast/current-before.css", "utf8");
const browser = await chromium.launch();
let checks = 0;
try {
  for (const os of ["light", "dark"] as const) for (const theme of ["light", "dark"] as const) {
    const page = await browser.newPage({ colorScheme: os });
    page.setDefaultTimeout(5000);
    await page.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
    await page.goto("about:blank");
    await page.setContent(`<html data-theme="${theme}"><style>${css}</style><body><section class="slip"><input type="date" value="2026-10-18"><input type="month" value="2026-10"><select><option>First Dime</option></select><input type="checkbox"></section></body></html>`);
    const pairs = await inspectNativeGlyphs(page, `regression OS=${os}; theme=${theme}`);
    const border = pairs.find(pair => pair.role === "native unchecked checkbox border against outside")!;
    assert(border, JSON.stringify(pairs));
    assert.equal(border.result, "exempt", JSON.stringify(pairs));
    assert.equal(border.foreground, os === "light" ? "rgb(118 118 118)" : "rgb(133 133 133)");
    assert.equal(border.background, theme === "light" ? "rgb(176, 176, 176)" : "rgb(71, 71, 71)");
    assert.equal(pairs.some(pair => pair.result === "fail" || pair.result === "uncovered"), false, JSON.stringify(pairs));
    const select = pairs.find(pair => pair.role === "native select arrow")!;
    assert.equal(select.foreground, "rgb(15 56 15)");
    const calendar = pairs.find(pair => pair.role === "native calendar icon")!;
    assert.equal(calendar.background, os === "light" ? "rgb(139 172 15)" : "rgb(130 160 14)");
    checks++;
    await page.locator("input[type='checkbox']").evaluate(node => { (node as HTMLElement).style.setProperty("appearance", "none"); });
    const altered = await inspectNativeGlyphs(page, "authored checkbox mutation");
    assert.equal(altered.some(pair => pair.role === "native checkbox unchecked" && pair.result === "uncovered"), true);
    checks++;
    await page.setContent(`<html data-theme="dark"><style>${baseline}</style><body><nav class="apps"><button aria-selected="true">First Dime</button></nav></body></html>`);
    const selected = (await inspectContrast(page, "baseline selected tab")).find(pair => pair.role === "selected app tab frame against outside")!;
    assert.equal(selected.result, "fail");
    checks++;
    await page.setContent(`<style>${css}</style><body><p style="background-image:linear-gradient(black,white)">Unsupported background fixture</p></body>`);
    assert.equal((await inspectContrast(page, "gradient mutation")).some(pair => pair.result === "uncovered"), true);
    checks++;
    await page.setContent(`<html data-theme="${theme}"><style>${css}</style><body><p style="color:black;background:black">Inert background failure</p><input type="date" id="background-date"><dialog class="feedback-dialog"><form><label>Feedback<textarea id="feedback-body">Fictional modal fixture</textarea></label><label><input type="checkbox" id="feedback-blocking">Blocked</label></form></dialog></body></html>`);
    await page.locator("dialog").evaluate(node => (node as HTMLDialogElement).showModal());
    const modal = await inspectContrast(page, "modal scope regression");
    const nativeModal = await inspectNativeGlyphs(page, "modal native reference regression");
    assert(modal.some(pair => pair.example === "textarea#feedback-body"));
    assert(!modal.some(pair => pair.example === "input#background-date" || pair.result === "fail" || pair.result === "uncovered"), JSON.stringify(modal));
    assert(nativeModal.length > 0 && nativeModal.every(pair => pair.example === "input#feedback-blocking"));
    assert(nativeModal.some(pair => pair.role === "native checkbox unchecked" && pair.result === "exempt"), JSON.stringify(nativeModal));
    checks++;
    await page.locator("#feedback-blocking").evaluate(node => { (node as HTMLElement).style.setProperty("appearance", "none"); });
    assert((await inspectNativeGlyphs(page, "modal authored checkbox mutation")).some(pair => pair.result === "uncovered"));
    checks++;
    await page.close();
  }
  console.log(`contrast regression checks passed: ${checks}`);
} finally {
  await browser.close();
}
