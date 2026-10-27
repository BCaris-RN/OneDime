import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const browser = await chromium.launch();
try {
  await mkdir("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
      <rect width="256" height="256" rx="40" fill="#C0C0C0"/>
      <circle cx="128" cy="128" r="91" fill="#A85B2A" stroke="#303030" stroke-width="12"/>
      <circle cx="128" cy="128" r="72" fill="#E3B46B" stroke="#6B3D24" stroke-width="6"/>
      <text x="126" y="157" text-anchor="middle" font-family="monospace" font-size="78" font-weight="800" fill="#303030">1¢</text>
      <path d="M110 71h36v7h-36zM110 178h36v7h-36z" fill="#F4D59A"/>
    </svg>`);
    await page.locator("svg").screenshot({ path: `public/icons/coin-${size}.png`, animations: "disabled" });
    await page.close();
  }
} finally {
  await browser.close();
}
