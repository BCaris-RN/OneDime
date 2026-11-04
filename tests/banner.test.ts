import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ONEDIME_BANNER } from "../src/banner.js";

describe("onedime banner", () => {
  const lines = ONEDIME_BANNER.split("\n");

  it("is 13 lines tall", () => {
    expect(lines).toHaveLength(13);
  });

  it("fits in 100 columns", () => {
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(100);
  });

  it("uses printable ASCII only", () => {
    expect(ONEDIME_BANNER).toMatch(/^[\x20-\x7e\n]+$/);
  });

  it("matches the banner at the top of the README", () => {
    const readme = readFileSync("README.md", "utf8").replace(/\r\n/g, "\n");
    expect(readme.startsWith("```text\n" + ONEDIME_BANNER + "\n```\n")).toBe(true);
  });
});
