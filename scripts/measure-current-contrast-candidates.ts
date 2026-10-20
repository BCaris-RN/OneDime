import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

type Rgb = [number, number, number];
const rgb = (hex: string) => hex.match(/../g)!.map(value => parseInt(value, 16)) as Rgb;
const hex = (color: Rgb) => color.map(value => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase();
const luminance = (color: Rgb) => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a: Rgb, b: Rgb) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const blend = (foreground: Rgb, background: Rgb, alpha: number) => foreground.map((value, index) => value * alpha + background[index] * (1 - alpha)) as Rgb;
const hsl = (color: Rgb): [number, number, number] => {
  const [r, g, b] = color.map(value => value / 255);
  const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b), delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (!delta) return [0, 0, lightness];
  const hue = maximum === r ? ((g - b) / delta + (g < b ? 6 : 0)) / 6 : maximum === g ? ((b - r) / delta + 2) / 6 : ((r - g) / delta + 4) / 6;
  return [hue, delta / (1 - Math.abs(2 * lightness - 1)), lightness];
};
const fromHsl = ([hue, saturation, lightness]: [number, number, number]): Rgb => {
  const channel = (offset: number) => {
    const position = (offset + hue * 12) % 12;
    return Math.round((lightness - saturation * Math.min(lightness, 1 - lightness) * Math.max(-1, Math.min(position - 3, 9 - position, 1))) * 255);
  };
  return [channel(0), channel(8), channel(4)];
};
const css = await readFile("public/styles.css", "utf8");
const cases = [
  { name: "dark error", old: "8B0000", expected: "FF7A7A", direction: 1, minimum: 4.5, previous: "FF7979", measure: (color: Rgb) => contrast(color, rgb("3A3A3A")) },
  { name: "light link", old: "0000EE", expected: "0000E6", direction: -1, minimum: 4.5, previous: "0000E7", measure: (color: Rgb) => contrast(color, rgb("B0B0B0")) },
  { name: "dark link", old: "9E9EFF", expected: "ADADFF", direction: 1, minimum: 4.5, previous: "ACACFF", measure: (color: Rgb) => contrast(color, rgb("474747")) },
  { name: "dark selected tab", old: "8B1D45", expected: "DB5283", direction: 1, minimum: 3, previous: "DB5183", measure: (color: Rgb) => contrast(color, rgb("3A3A3A")) },
  { name: "light ghost active", old: "5E1230", expected: "D6296D", direction: 1, minimum: 4.5, previous: "D5296D", measure: (color: Rgb) => contrast(rgb("1F1F1F"), blend(rgb("FFFFFF"), color, 0.2)) },
  { name: "OS-dark calendar backdrop", old: "8BAC0F", expected: "82A00E", direction: -1, minimum: 3, previous: "82A10E", measure: (color: Rgb) => contrast(rgb("FFFFFF"), color) }
];
const rows = cases.map(item => {
  const [hue, saturation, start] = hsl(rgb(item.old));
  let found: Rgb | undefined;
  for (let step = 0; step <= 100000; step++) {
    const lightness = start + item.direction * step / 100000;
    if (lightness < 0 || lightness > 1) break;
    const candidate = fromHsl([hue, saturation, lightness]);
    if (item.measure(candidate) >= item.minimum) { found = candidate; break; }
  }
  assert(found, item.name);
  assert.equal(hex(found), item.expected, `${item.name}: first quantized fixed-hue/saturation candidate`);
  assert(css.toUpperCase().includes(`#${item.expected}`), `${item.name}: CSS does not contain the measured candidate`);
  assert(item.measure(rgb(item.previous)) < item.minimum);
  return { name: item.name, before: `#${item.old}`, after: `#${item.expected}`, minimum: item.minimum, ratio: item.measure(found),
    adjacentFailingCandidate: `#${item.previous}`, adjacentFailingRatio: item.measure(rgb(item.previous)) };
});
const selection = (alpha: number) => contrast(rgb("0F380F"), blend(rgb("8BAC0F"), rgb("0F380F"), alpha));
assert(selection(0.92) < 4.5 && selection(0.93) >= 4.5);
assert(css.includes("rgba(139,172,15,.93)"));
const proof = { method: "Hold HSL hue and saturation fixed, change lightness monotonically in 0.00001 increments, round to 8-bit RGB, and choose the first unrounded passing ratio. This is minimum on this defined hue-preserving path, not a claim of a globally smallest perceptual color distance. Selection uses the existing 0.01 alpha grid; the darkest selectable surface is the toast.",
  cases: rows, selection: { beforeAlpha: 0.47, afterAlpha: 0.93, ratio: selection(0.93), adjacentFailingAlpha: 0.92, adjacentFailingRatio: selection(0.92) } };
await writeFile("docs/contrast/minimal-candidates.json", JSON.stringify(proof, null, 2) + "\n");
console.log(`minimal candidate measurements passed: ${rows.length} color paths and selection alpha`);
