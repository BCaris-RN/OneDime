import type { Page } from "playwright";

type Target = { index: number; label: string; color: string; relaxed: boolean; rects: { x: number; y: number; w: number; h: number }[] };

// For pages painted with gradients, blur or fixed art, which the DOM-based audit can't resolve: hide every
// glyph, screenshot the viewport as it scrolls (fixed layers stay put), then compare each text color with
// the worst pixel under its line boxes. Large text and aria-hidden decorative print only need 3:1. Tilted
// labels are sampled at the center of their box, since the box overlaps whatever sits beside them.
export async function measureText(page: Page, { skip, hide: hideCss, include }: { skip: string; hide: string; include?: string }) {
  const targets = await page.evaluate(({ skip, include }: { skip: string; include?: string }): Target[] => {
    const found: Target[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
      if (node.closest(`[hidden],script,style,svg,${skip}`)) continue;
      if (include && !node.matches(include)) continue;
      const own = [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
      if (!own.length) continue;
      const style = getComputedStyle(node);
      // checkVisibility also rules out closed <details>, whose content keeps boxes but never paints.
      if (!node.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
      if (/rgba\(.*,\s*0\)$/.test(style.color)) continue;
      const tilted = [...(function* () { for (let el: Element | null = node; el; el = el.parentElement) yield el; })()].some(el => getComputedStyle(el).rotate !== "none");
      const range = document.createRange();
      const rects = own.flatMap(text => { range.selectNodeContents(text); return [...range.getClientRects()]; })
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({ x: rect.left + scrollX, y: rect.top + scrollY, w: rect.width, h: rect.height }))
        .map(rect => tilted ? { x: rect.x + rect.w / 3, y: rect.y + rect.h / 3, w: Math.max(1, rect.w / 3), h: Math.max(1, rect.h / 3) } : rect);
      if (!rects.length) continue;
      const size = parseFloat(style.fontSize), bold = Number(style.fontWeight) >= 700;
      const name = node.tagName.toLowerCase() + (node.id ? "#" + node.id : "") + (node.className ? "." + String(node.className).split(" ")[0] : "");
      node.dataset.pixelTarget = String(found.length);
      found.push({ index: found.length, label: `${name} "${own[0].textContent!.trim().slice(0, 24)}"`, color: style.color, relaxed: size >= 24 || (bold && size >= 18.66) || !!node.closest("[aria-hidden=true]"), rects });
    }
    return found;
  }, { skip, include });
  const hide = await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}" + hideCss });
  const { height, total } = await page.evaluate(() => ({ height: innerHeight, total: document.documentElement.scrollHeight }));
  const worst = new Map<string, { ratio: number; required: number }>();
  for (let top = 0; top < total; top += height) {
    const offset = Math.min(top, Math.max(0, total - height));
    await page.evaluate(y => scrollTo(0, y), offset);
    const png = (await page.screenshot()).toString("base64");
    const placed = targets.map(target => ({ ...target, rects: target.rects.filter(rect => rect.y >= offset && rect.y + rect.h <= offset + height)
      .map(rect => ({ ...rect, y: rect.y - offset })) }));
    // Text covered by a fixed bar or menu at this scroll position is hidden, not low-contrast.
    const inView = await page.evaluate(targets => targets.map(target => ({ ...target, rects: target.rects.filter(rect =>
      document.elementFromPoint(rect.x + rect.w / 2, rect.y + rect.h / 2)?.closest(`[data-pixel-target="${target.index}"]`)) }))
      .filter(target => target.rects.length), placed);
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
  await hide.evaluate(node => (node as ChildNode).remove());
  await page.evaluate(() => document.querySelectorAll<HTMLElement>("[data-pixel-target]").forEach(node => delete node.dataset.pixelTarget));
  await page.evaluate(() => scrollTo(0, 0));
  return [...worst].map(([label, value]) => ({ label, ...value }));
}
