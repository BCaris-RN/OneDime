import { describe, expect, it } from "vitest";
import { monthlyStackSegments } from "../public/stats-chart.js";

describe("monthly Stats chart geometry", () => {
  it("keeps negative app totals below zero and scales positive and negative stacks independently", () => {
    const chart = monthlyStackSegments([
      { first: 500, spotlight: 300, freelance: 0, market: 0 },
      { first: 0, spotlight: -250, freelance: -150, market: 0 }
    ], 10, 110);
    expect(chart.baseline).toBeCloseTo(76.6666666667);
    expect(chart.maxPositive).toBe(800);
    expect(chart.maxNegative).toBe(400);
    expect(chart.segments[0]?.[0]?.y + chart.segments[0]?.[0]?.height).toBeCloseTo(chart.baseline);
    expect(chart.segments[0]?.[1]?.y + chart.segments[0]?.[1]?.height).toBeCloseTo(35);
    expect(chart.segments[1]?.[0]?.y).toBeCloseTo(chart.baseline);
    expect(chart.segments[1]?.[1]?.y).toBeCloseTo(97.5);
    expect(chart.segments[1]?.every(segment => segment.value < 0 && segment.y >= chart.baseline)).toBe(true);
  });

  it("leaves zero-only months without fabricated positive-height bars", () => {
    const chart = monthlyStackSegments([{ first: 0, spotlight: 0, freelance: 0, market: 0 }], 10, 110);
    expect(chart.segments).toEqual([[]]);
    expect(chart.maxPositive).toBe(0);
    expect(chart.maxNegative).toBe(0);
  });
});
