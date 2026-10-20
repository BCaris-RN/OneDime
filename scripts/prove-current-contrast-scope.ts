import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const before = await readFile("docs/contrast/current-before.css", "utf8");
const after = await readFile("public/styles.css", "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addInitScript({ content: "globalThis.__name = function (target) { return target; };" });
  await page.goto("about:blank");
  const changed = await page.evaluate(({ before, after }) => {
    const declarations = (source: string) => {
      const sheet = new CSSStyleSheet(); sheet.replaceSync(source);
      const result = new Map<string, { selector: string; property: string; value: string }>();
      const visit = (rules: CSSRuleList, conditions: string[]) => {
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            for (const declaration of rule.style.cssText.split(";").map(value => value.trim()).filter(Boolean)) {
              const separator = declaration.indexOf(":");
              const property = declaration.slice(0, separator).trim();
              const value = declaration.slice(separator + 1).trim();
              result.set([...conditions, rule.selectorText, property].join(" / "), {
                selector: [...conditions, rule.selectorText].join(" / "),
                property, value
              });
            }
          } else if (rule instanceof CSSMediaRule) visit(rule.cssRules, [...conditions, rule.conditionText]);
          else throw new Error(`Unsupported CSS rule in scope proof: ${rule.cssText}`);
        }
      };
      visit(sheet.cssRules, []);
      return result;
    };
    const left = declarations(before), right = declarations(after);
    return [...new Set([...left.keys(), ...right.keys()])].filter(key => left.get(key)?.value !== right.get(key)?.value)
      .map(key => ({ selector: (right.get(key) ?? left.get(key))!.selector,
        property: (right.get(key) ?? left.get(key))!.property,
        before: left.get(key)?.value ?? null, after: right.get(key)?.value ?? null }));
  }, { before, after });
  const permitted = new Set(["color", "background", "background-color", "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]);
  const colorTokens = new Set(["--error", "--selected-border", "--link", "--ghost-active", "--native-icon-surface"]);
  assert(changed.length > 0);
  for (const row of changed) assert(permitted.has(row.property) || colorTokens.has(row.property), `Non-color declaration changed: ${JSON.stringify(row)}`);
  const proof = { baselineCommit: "ab7bc89bf12134b8c0d5015c64298ac44021ac49", beforeSha256: createHash("sha256").update(before).digest("hex"),
    afterSha256: createHash("sha256").update(after).digest("hex"), changed };
  await writeFile("docs/contrast/color-only-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(`color-only scope proof passed: ${changed.length} declaration differences`);
} finally {
  await browser.close();
}
