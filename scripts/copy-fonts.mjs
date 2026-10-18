import { mkdir, copyFile, writeFile } from "node:fs/promises";
const fonts = [
  ["jetbrains-mono", [600, 800]],
  ["atkinson-hyperlegible", [400, 700]],
  ["source-code-pro", [800]]
];
await mkdir("public/fonts", { recursive: true });
let css = "";
for (const [name, weights] of fonts) {
  for (const weight of weights) {
    const file = `${name}-latin-${weight}-normal.woff2`;
    await copyFile(`node_modules/@fontsource/${name}/files/${file}`, `public/fonts/${file}`);
    css += `@font-face{font-family:'${name.replaceAll("-", " ")}';font-style:normal;font-weight:${weight};font-display:swap;src:url('/fonts/${file}') format('woff2')}\n`;
  }
  await copyFile(`node_modules/@fontsource/${name}/LICENSE`, `public/fonts/${name}-LICENSE.txt`);
}
await writeFile("public/fonts.css", css);
