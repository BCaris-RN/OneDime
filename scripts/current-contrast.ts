import type { Page } from "playwright";

export type ContrastPair = {
  kind: string;
  role: string;
  foreground: string;
  background: string;
  ratio: number | null;
  minimum: number;
  result: "pass" | "fail" | "exempt" | "uncovered";
  reason: string;
  example: string;
  state: string;
};

export async function inspectContrast(page: Page, state: string, selection = true) {
  return page.evaluate(({ state, selection }) => {
    type Color = [number, number, number, number];
    type Pair = ContrastPair;
    const pairs: Pair[] = [];
    const parse = (value: string): Color => {
      const match = value.match(/^rgba?\(([^)]+)\)$/);
      if (!match) throw new Error(`unsupported color ${value}`);
      const parts = match[1].replaceAll(",", " ").replace("/", " ").split(/\s+/).filter(Boolean);
      if (parts.some(part => part.endsWith("%"))) throw new Error(`unsupported color ${value}`);
      return [Number(parts[0]), Number(parts[1]), Number(parts[2]), Number(parts[3] ?? 1)];
    };
    const over = (top: Color, base: Color): Color => {
      const alpha = top[3] + base[3] * (1 - top[3]);
      return [0, 1, 2].map(index => alpha ? (top[index] * top[3] + base[index] * base[3] * (1 - top[3])) / alpha : 0)
        .concat(alpha) as Color;
    };
    const format = (color: Color) => `rgb(${color.slice(0, 3).map(value => Number(value.toFixed(5))).join(" ")}${color[3] < 1 ? ` / ${color[3]}` : ""})`;
    const luminance = (color: Color) => color.slice(0, 3).map(value => value / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (a: Color, b: Color) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
    if (Math.abs(ratio([0, 0, 0, 1], [255, 255, 255, 1]) - 21) > 1e-12 ||
      Math.abs(ratio([119, 119, 119, 1], [255, 255, 255, 1]) - 4.478089453577214) > 1e-12 ||
      over([255, 255, 255, 0.5], [0, 0, 0, 1])[0] !== 127.5) throw new Error("WCAG reference vectors failed");
    const name = (el: Element) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${[...el.classList].map(value => `.${value}`).join("")}`;
    const visible = (el: Element) => !el.matches(".skip-link:not(:focus)") && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
    const disabled = (el: Element) => !!el.closest(":disabled,[aria-disabled='true']");
    const background = (el: Element | null): Color => {
      const ancestors: Element[] = [];
      for (let node = el; node; node = node.parentElement) ancestors.unshift(node);
      let color: Color = [255, 255, 255, 1];
      for (const node of ancestors) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none" || style.mixBlendMode !== "normal" || style.filter !== "none" || style.backdropFilter !== "none") {
          throw new Error(`unsupported painted background on ${name(node)}`);
        }
        if (Number(style.opacity) !== 1 && !disabled(node)) throw new Error(`unsupported group opacity ${style.opacity} on ${name(node)}`);
        color = over(parse(style.backgroundColor), color);
        if (node.matches("button.act,.facebtns button")) {
          const after = getComputedStyle(node, "::after");
          const stacking = style.isolation === "isolate" || style.transform !== "none" || style.zIndex !== "auto";
          if (after.content !== "none" && Number(after.opacity) > 0 && stacking) {
            const overlay = parse(after.backgroundColor);
            overlay[3] *= Number(after.opacity);
            color = over(overlay, color);
          }
        }
      }
      return color;
    };
    const add = (el: Element, kind: string, role: string, fg: Color, bg: Color, minimum: number, reason = "", exemption = "") => {
      const resolved = over(fg, bg);
      const value = ratio(resolved, bg);
      pairs.push({ kind, role, foreground: format(resolved), background: format(bg), ratio: value, minimum,
        result: exemption ? "exempt" : value >= minimum ? "pass" : "fail", reason: exemption || reason, example: name(el), state });
    };
    const uncovered = (el: Element, role: string, error: unknown) => pairs.push({ kind: "coverage", role, foreground: "unknown", background: "unknown", ratio: null, minimum: 0,
      result: "uncovered", reason: error instanceof Error ? error.message : String(error), example: name(el), state });
    const safe = (el: Element, role: string, fn: () => void) => { try { fn(); } catch (error) { uncovered(el, role, error); } };
    const foregroundRole = (el: Element) => el.closest(".stats,.goal-hero,.clock-elapsed,.rung-list") ? "lcd text"
      : el.closest(".toast") ? "toast text" : el.closest(".message[data-error='true']") ? "error text"
        : el.closest("button,a,summary") ? `control text ${name(el.closest("button,a,summary")!)}`
          : el.closest(".muted,.field-help,.eyebrow,.status,.empty") ? "secondary text"
            : el.closest("h1,h2,h3,th,caption,.paypal-badge,.edit-banner") ? "heading text" : "body text";
    const text = (el: Element, placeholder = false) => safe(el, placeholder ? "placeholder" : "text", () => {
      if (disabled(el)) {
        pairs.push({ kind: "text", role: foregroundRole(el), foreground: "inactive", background: "inactive", ratio: null, minimum: 4.5,
          result: "exempt", reason: "Inactive user-interface component (WCAG 1.4.3/1.4.11 exception).", example: name(el), state });
        return;
      }
      const style = getComputedStyle(el, placeholder ? "::placeholder" : undefined);
      const fg = parse(style.color);
      fg[3] *= Number(style.opacity);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6666667 && Number(style.fontWeight) >= 700);
      const bg = background(el);
      add(el, "text", placeholder ? "placeholder" : foregroundRole(el), fg, bg, large ? 3 : 4.5,
        large ? "Large text: at least 24 CSS px, or bold at least 18.667 CSS px." : "Normal text.");
      if (selection && !placeholder && !el.closest("button,input,select,textarea,svg") && style.userSelect !== "none") {
        const selected = getComputedStyle(el, "::selection");
        const selectedBg = over(parse(selected.backgroundColor), bg);
        add(el, "selection", "selected text", parse(selected.color), selectedBg, large ? 3 : 4.5,
          "Selection background composited over the actual element background before luminance.");
      }
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent?.trim() || !el || el.closest("script,style,option,svg,[hidden],.sr-only") || !visible(el)) continue;
      text(el);
    }
    for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")) {
      if (!visible(el) || el.matches("input[type='checkbox'],input[type='radio']")) continue;
      text(el);
      if ("placeholder" in el && el.placeholder && !el.value) text(el, true);
    }
    for (const el of document.querySelectorAll("button,input,select,textarea,a,summary")) {
      if (!visible(el)) continue;
      safe(el, "control boundary", () => {
        if (disabled(el)) return;
        const style = getComputedStyle(el);
        const outside = background(el.parentElement);
        const fill = background(el);
        const isBorderlessText = el.matches("a:not(.paypal-button):not(.brand),.brand,nav.tabs button,#balNav button,.export-options summary");
        const borderWidth = Math.max(...[style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(parseFloat));
        if (borderWidth > 0 && style.borderTopStyle !== "none" && !isBorderlessText) {
          const border = parse(style.borderTopColor);
          if (border[3] > 0) {
            const alternate = ratio(fill, outside) >= 3;
            const visibleLabel = el.matches("button,a.paypal-button,summary") && !!el.textContent?.trim();
            add(el, "border", "control border against outside", border, outside, 3, "",
              visibleLabel ? "Visible text and context identify this labeled button; its boundary is optional under WCAG 1.4.11. Text contrast is enforced separately, and selected-tab state frames are checked independently."
                : alternate ? "The control fill already identifies the component against its outside surface at 3:1 or better; this extra frame is decorative." : "");
            if (alternate && !visibleLabel) add(el, "boundary", "identifying control fill against outside", fill, outside, 3);
            add(el, "border diagnostic", "control border against inside fill", border, fill, 3, "",
              "Interior border/fill adjacency is diagnostic; component identification is assessed against the outside surface.");
          }
        }
        if (el.matches("nav button[aria-selected='true']") && !el.matches("nav.apps button")) {
          add(el, "state", "selected tab underline", parse(style.borderBottomColor), outside, 3);
        }
        if (el.matches("nav.apps button[aria-selected='true']")) add(el, "state", "selected app tab frame against outside", parse(style.borderTopColor), outside, 3);
        if (el.matches("[aria-invalid='true']")) add(el, "state", "invalid field border against fill", parse(style.borderTopColor), fill, 3);
        if (el.matches(".dpad button")) {
          add(el, "icon", "D-pad direction icon", parse(style.color), fill, 3);
        }
        if (el.matches("summary")) add(el, "icon", "disclosure marker", parse(getComputedStyle(el, "::marker").color), fill, 3);
        if (el.matches("input[type='file']")) {
          const fileButton = getComputedStyle(el, "::file-selector-button");
          add(el, "text", "native file-picker button text", parse(fileButton.color), over(parse(fileButton.backgroundColor), fill), 4.5);
        }
        if (el === document.activeElement && el.matches(":focus-visible")) {
          if (style.outlineStyle === "none" || parseFloat(style.outlineWidth) < 1) throw new Error("No visible authored focus outline.");
          add(el, "focus", "focus outline against adjacent outside surface", parse(style.outlineColor), outside, 3);
        }
      });
    }
    for (const el of document.querySelectorAll(".xp-progress,.bar")) if (visible(el)) safe(el, "XP progress", () => {
      const fill = el.querySelector("i");
      if (fill && parseFloat(getComputedStyle(fill).width) > 0) add(fill, "graphic", "XP fill against track", parse(getComputedStyle(fill).backgroundColor), background(el), 3);
    });
    const colorRules: { selector: string; color: string }[] = [];
    const visitRules = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue;
        if (rule instanceof CSSSupportsRule && !CSS.supports(rule.conditionText)) continue;
        if (rule instanceof CSSStyleRule && rule.style.color) colorRules.push({ selector: rule.selectorText, color: rule.style.color });
        if ("cssRules" in rule) visitRules((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) visitRules(sheet.cssRules);
    for (const el of document.querySelectorAll("a[href]")) if (visible(el)) safe(el, "visited links", () => {
      const authored = colorRules.some(rule => rule.selector.split(",").some(selector =>
        !/:(visited|link|any-link|hover|active|focus)/.test(selector) && el.matches(selector)));
      const visitedOverride = colorRules.some(rule => /:visited/.test(rule.selector));
      if (!authored || visitedOverride) {
        uncovered(el, "visited link color", "Chromium hides visited colors from getComputedStyle; no unconditional authored link color, or a visited-specific override exists. A passing ratio cannot be inferred.");
      } else add(el, "text", "visited link text (same unconditional authored color)", parse(getComputedStyle(el).color), background(el), 4.5,
        "An unconditional authored color overrides UA link and visited colors, and the stylesheet inventory rejects visited-specific overrides.");
    });
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      safe(el, "decorative border", () => {
        const style = getComputedStyle(el);
        if (!el.matches("button,input,select,textarea,a,summary")) {
          for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
            const width = parseFloat(style[`border${side}Width`]);
            const border = parse(style[`border${side}Color`]);
            if (width > 0 && style[`border${side}Style`] !== "none" && border[3] > 0) {
              const reason = "Container/table/badge separator does not identify an interactive control or information unavailable in adjacent text.";
              add(el, "decoration", "decorative border against outside", border, background(el.parentElement), 3, "", reason);
              add(el, "decoration", "decorative border against inside", border, background(el), 3, "", reason);
            }
          }
        }
        if (el.matches(".goal-coin circle")) add(el, "decoration", "goal ring stroke", parse(style.stroke), background(el), 3, "",
          "aria-hidden ring duplicates the visible percentage and goal text.");
        if (el.matches(".dpad .center")) add(el, "decoration", "D-pad center ornament", parse(style.backgroundColor), background(el.parentElement), 3, "",
          "Noninteractive aria-hidden controller ornament.");
      });
    }
    return pairs;
  }, { state, selection });
}

export async function inspectNativeGlyphs(page: Page, state: string) {
  const result: ContrastPair[] = [];
  for (const [selector, role] of [["input[type='date']", "native calendar icon"], ["input[type='month']", "native month-picker icon"], ["select", "native select arrow"], ["input[type='checkbox']", "native checkbox"]]) {
    const element = page.locator(selector).filter({ visible: true }).first();
    if (!await element.count() || await element.isDisabled()) continue;
    for (const checked of role === "native checkbox" ? [false, true] : [false]) {
      const original = role === "native checkbox" ? await element.isChecked() : false;
      if (role === "native checkbox") await element.evaluate((node, value) => { (node as HTMLInputElement).checked = value; }, checked);
      try {
        const info = await element.evaluate(node => {
          let parent = node.parentElement;
          while (parent && getComputedStyle(parent).backgroundColor === "rgba(0, 0, 0, 0)") parent = parent.parentElement;
          return { example: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}`, outside: parent ? getComputedStyle(parent).backgroundColor : "unknown" };
        });
        const png = (await element.screenshot({ animations: "disabled" })).toString("base64");
        let nativeReferenceMatches = false;
        let nativeReferenceDetail = "";
        if (role === "native checkbox" && !checked) {
          const originalElement = await element.elementHandle();
          if (!originalElement) throw new Error("Native checkbox detached during reference capture");
          const previousVisibility = await originalElement.evaluate(node => {
            const box = node.getBoundingClientRect();
            const reference = node.cloneNode(false) as HTMLInputElement;
            reference.removeAttribute("id"); reference.checked = false;
            reference.dataset.currentContrastNativeReference = "true";
            reference.style.setProperty("all", "revert", "important");
            for (const [property, value] of Object.entries({ position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, margin: "0", display: "block", "z-index": "2147483647" })) reference.style.setProperty(property, value, "important");
            document.body.append(reference);
            const previous = [node.style.getPropertyValue("visibility"), node.style.getPropertyPriority("visibility")];
            node.style.setProperty("visibility", "hidden", "important");
            return previous;
          });
          try {
            const reference = (await page.locator("[data-current-contrast-native-reference]").screenshot({ animations: "disabled" })).toString("base64");
            const comparison = await page.evaluate(async ({ png, reference }) => {
              const images = await Promise.all([png, reference].map(async encoded => { const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode(); return image; }));
              if (images[0].width !== images[1].width || images[0].height !== images[1].height) return { matches: false, detail: `dimensions ${images[0].width}x${images[0].height} versus ${images[1].width}x${images[1].height}` };
              const pixels = images.map(image => { const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height; const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height).data; });
              let differences = 0;
              for (let index = 0; index < pixels[0].length; index++) {
                if (pixels[0][index] === pixels[1][index]) continue;
                const x = Math.floor(index / 4) % images[0].width;
                const y = Math.floor(index / 4 / images[0].width);
                const roundedCorner = (x < 3 || x >= images[0].width - 3) && (y < 3 || y >= images[0].height - 3);
                if (!roundedCorner || Math.abs(pixels[0][index] - pixels[1][index]) > 1) differences++;
              }
              return { matches: differences === 0, detail: `${differences} differences outside one-channel rounded-corner raster tolerance` };
            }, { png, reference });
            nativeReferenceMatches = comparison.matches;
            nativeReferenceDetail = comparison.detail;
          } finally {
            await page.locator("[data-current-contrast-native-reference]").evaluate(node => node.remove());
            await originalElement.evaluate((node, [value, priority]) => { if (value) node.style.setProperty("visibility", value, priority); else node.style.removeProperty("visibility"); }, previousVisibility);
            await originalElement.dispose();
          }
        }
        const measured = await page.evaluate(async ({ png, role, checked }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, image.width, image.height).data;
          const counts = new Map<string, number>();
          const pixels: { x: number; y: number; color: string }[] = [];
          const box = role === "native checkbox"
            ? { left: checked ? 6 : 0, right: image.width - (checked ? 6 : 0), top: checked ? 6 : 0, bottom: image.height - (checked ? 6 : 0) }
            : { left: image.width - (role === "native select arrow" ? 19 : 29), right: image.width - 6, top: Math.floor(image.height / 2) - 8, bottom: Math.floor(image.height / 2) + 8 };
          for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) {
            const offset = (y * image.width + x) * 4;
            const color = `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
            counts.set(color, (counts.get(color) ?? 0) + 1);
            pixels.push({ x, y, color });
          }
          const sorted = [...counts].sort((a, b) => b[1] - a[1]);
          const luminance = (value: string) => value.split(",").map(Number).map(channel => channel / 255)
            .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
            .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
          const candidates = sorted.slice(1).filter(([, count]) => count >= 2);
          candidates.sort(([a], [b]) => Math.abs(luminance(b) - luminance(sorted[0][0])) - Math.abs(luminance(a) - luminance(sorted[0][0])));
          const core = candidates[0]?.[0];
          const corePixels = pixels.filter(pixel => pixel.color === core);
          const corners = new Map<string, number>();
          if (corePixels.length && !(role === "native checkbox" && !checked)) {
            const left = Math.max(0, Math.min(...corePixels.map(pixel => pixel.x)) - 1);
            const right = Math.min(image.width - 1, Math.max(...corePixels.map(pixel => pixel.x)) + 1);
            const top = Math.max(0, Math.min(...corePixels.map(pixel => pixel.y)) - 1);
            const bottom = Math.min(image.height - 1, Math.max(...corePixels.map(pixel => pixel.y)) + 1);
            for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom]]) {
              const offset = (y * image.width + x) * 4;
              const color = `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
              corners.set(color, (corners.get(color) ?? 0) + 1);
            }
          }
          const adjacent = [...corners].sort((a, b) => b[1] - a[1])[0];
          const pixelAt = (x: number, y: number) => { const offset = (y * image.width + x) * 4; return `${data[offset]},${data[offset + 1]},${data[offset + 2]}`; };
          const middleX = Math.floor(image.width / 2), middleY = Math.floor(image.height / 2);
          const edges = new Map<string, number>();
          for (const color of [pixelAt(0, middleY), pixelAt(image.width - 1, middleY), pixelAt(middleX, 0), pixelAt(middleX, image.height - 1)]) edges.set(color, (edges.get(color) ?? 0) + 1);
          const nativeBorder = [...edges].sort((a, b) => b[1] - a[1])[0][0];
          return { colors: sorted, width: image.width, height: image.height, adjacent, nativeBorder, nativeFill: pixelAt(middleX, middleY) };
        }, { png, role, checked });
        const rgb = (value: string) => value.split(",").map(Number);
        const luminance = (value: string) => rgb(value).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const base = { kind: "native icon", role: `${role}${role === "native checkbox" ? checked ? " checked" : " unchecked" : ""}`, example: info.example, state, minimum: 3 };
        if (role === "native checkbox" && !checked && !nativeReferenceMatches) {
          result.push({ ...base, foreground: "unknown", background: "unknown", ratio: null, result: "uncovered",
            reason: `Unchecked checkbox rendering differs from a same-position all:revert native reference (${nativeReferenceDetail}). The UA appearance exception cannot be applied; add an explicit authored-control audit.` });
          continue;
        }
        if (measured.colors.length < 2 || measured.colors[1][1] < 2) {
          result.push({ ...base, foreground: "unknown", background: "unknown", ratio: null, result: "uncovered", reason: `No distinct principal icon pixels in the interior screenshot probe (${measured.width}x${measured.height}).` });
        } else {
          const dominant = measured.colors[0][0];
          const candidates = measured.colors.slice(1).filter(([, count]) => count >= 2);
          candidates.sort(([a], [b]) => Math.abs(luminance(b) - luminance(dominant)) - Math.abs(luminance(a) - luminance(dominant)));
          const nativeUnchecked = role === "native checkbox" && !checked;
          const fg = nativeUnchecked ? measured.nativeBorder : candidates[0][0];
          if (!nativeUnchecked && (!measured.adjacent || measured.adjacent[1] < 2)) {
            result.push({ ...base, foreground: `rgb(${fg.replaceAll(",", " ")})`, background: "unknown", ratio: null, result: "uncovered",
              reason: "Native glyph corner samples do not establish a uniform adjacent backdrop; cannot infer contrast from the whole-control dominant color." });
            continue;
          }
          const bg = nativeUnchecked ? measured.nativeFill : measured.adjacent[0];
          const value = (Math.max(luminance(fg), luminance(bg)) + 0.05) / (Math.min(luminance(fg), luminance(bg)) + 0.05);
          const reason = nativeUnchecked
            ? "Unchecked border/fill pixels match a same-position all:revert native reference (WCAG 1.4.11 UA exception); only one-channel raster differences in rounded corners are tolerated. Border is sampled at flat edge midpoints and fill at the center. The authored checked accent is audited separately."
            : "Solid glyph core sampled from the Chromium element screenshot against its actual adjacent backdrop (at least two agreeing corner samples around the core), not the input's dominant fill. Antialiased edge colors are not used.";
          result.push({ ...base, foreground: `rgb(${fg.replaceAll(",", " ")})`, background: `rgb(${bg.replaceAll(",", " ")})`, ratio: value,
            result: nativeUnchecked ? "exempt" : value >= 3 ? "pass" : "fail", reason });
          if (nativeUnchecked) {
            const outside = info.outside.match(/^rgb\((\d+), (\d+), (\d+)\)$/)?.slice(1).join(",");
            if (!outside) result.push({ ...base, role: "native unchecked checkbox border against outside", foreground: `rgb(${fg.replaceAll(",", " ")})`, background: info.outside,
              ratio: null, result: "uncovered", reason: "Unsupported resolved outside background for native checkbox border." });
            else {
              const boundaryRatio = (Math.max(luminance(fg), luminance(outside)) + 0.05) / (Math.min(luminance(fg), luminance(outside)) + 0.05);
              result.push({ ...base, role: "native unchecked checkbox border against outside", foreground: `rgb(${fg.replaceAll(",", " ")})`, background: info.outside,
                ratio: boundaryRatio, result: "exempt", reason });
            }
          }
        }
      } finally {
        if (role === "native checkbox") await element.evaluate((node, value) => { (node as HTMLInputElement).checked = value; }, original);
      }
    }
  }
  return result;
}
