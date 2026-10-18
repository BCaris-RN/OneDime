import { describe, expect, it } from "vitest";
import { gameStats, levelForXp, localDay, restedXp, streak, type HistoryEntry } from "../src/game/rules.js";
import { dollarsToCents } from "../src/game/money.js";
import { QUESTS, TITLES } from "../src/game/catalog.js";
import { readFileSync } from "node:fs";

function entry(day: string, minutes = 10, amountCents = 0): HistoryEntry {
  return { workedOn: day, minutes, amountCents, platform: "Test site", verified: false };
}

describe("game rules", () => {
  it.each([[199], [99, 100]])("floors dollar XP after summing logged cents: %j", (...amounts) => {
    const stats = gameStats(amounts.map((amount) => entry("2026-10-14", 0, amount)), {
      now: new Date("2026-10-14T20:00:00Z"), timeZone: "UTC"
    });
    expect(stats.xp).toBe(19);
  });
  it.each([["0", 0], ["0.01", 1], ["0.10", 10], ["1.2", 120], ["9.99", 999], ["10000.00", 1_000_000]])("converts dollar input %s to integer cents", (input, cents) => {
    expect(dollarsToCents(input as string)).toBe(cents);
  });
  it.each(["", "-1", "1.001", "1e2", "Infinity", "10000.01", "99999999999999999999999999", ".5"])("rejects invalid dollar input %s", (input) => {
    expect(() => dollarsToCents(input)).toThrow();
  });
  it("computes XP exactly from minutes, cents, quests, and claimed rungs", () => {
    const stats = gameStats([entry("2026-10-14", 60, 1234)], {
      now: new Date("2026-10-14T20:00:00Z"), timeZone: "Pacific/Honolulu", questXp: 75, claimedRungs: 2
    });
    expect(stats.xp).toBe(458);
    expect(stats.level).toBe(5);
    expect(stats.totals).toEqual({ amountCents: 1234, minutes: 60, verifiedCents: 0 });
    expect(stats.sites[0].centsPerHour).toBe(1234);
    expect(stats.nextRungCents).toBe(10);
  });
  it.each([[0, 1], [24.9, 1], [25, 2], [99.9, 2], [100, 3], [900, 7]])("level at %s XP is %s", (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });
  it("starts with no bonus or rested pool when history is empty", () => {
    expect(restedXp([], "2026-10-14")).toEqual({ pool: 0, bonus: 0 });
  });
  it("awards 25 per completed idle calendar day and caps at 100", () => {
    expect(restedXp([entry("2026-10-01")], "2026-10-03")).toEqual({ pool: 25, bonus: 0 });
    expect(restedXp([entry("2026-10-01")], "2026-10-14")).toEqual({ pool: 100, bonus: 0 });
  });
  it("drains only the available pool when minutes earn double", () => {
    const history = [entry("2026-10-01"), entry("2026-10-04", 40)];
    expect(restedXp(history, "2026-10-04")).toEqual({ pool: 10, bonus: 40 });
    expect(restedXp([...history, entry("2026-10-04", 30)], "2026-10-04")).toEqual({ pool: 0, bonus: 50 });
  });
  it("handles multiple gaps, same-day entries, shuffled history, and deleted entries", () => {
    const history = [entry("2026-10-01"), entry("2026-10-04", 80), entry("2026-10-07", 10)];
    expect(restedXp(history.reverse(), "2026-10-07")).toEqual({ pool: 40, bonus: 60 });
    expect(restedXp(history.filter((row) => row.workedOn !== "2026-10-04"), "2026-10-07")).toEqual({ pool: 90, bonus: 10 });
  });
  it("gives no idle-day award for today or the day immediately after work", () => {
    expect(restedXp([entry("2026-10-13")], "2026-10-14").pool).toBe(0);
    expect(restedXp([entry("2026-10-13"), entry("2026-10-14")], "2026-10-14").bonus).toBe(0);
  });
  it("counts streak from today or yesterday, once per day", () => {
    const history = [entry("2026-10-12"), entry("2026-10-13"), entry("2026-10-13")];
    expect(streak(history, "2026-10-14")).toBe(2);
    expect(streak(history, "2026-10-15")).toBe(0);
    expect(streak([...history, entry("2026-10-14")], "2026-10-14")).toBe(3);
  });
  it("uses the player's date around midnight, date line, and DST transitions", () => {
    const now = new Date("2026-10-14T02:00:00Z");
    expect(localDay(now, "Pacific/Honolulu")).toBe("2026-10-13");
    expect(localDay(now, "Pacific/Kiritimati")).toBe("2026-10-14");
    const history = [entry("2026-10-11")];
    expect(gameStats(history, { now, timeZone: "Pacific/Honolulu" }).restedPool).toBe(25);
    expect(gameStats(history, { now, timeZone: "Pacific/Kiritimati" }).restedPool).toBe(50);
    expect(restedXp([entry("2026-03-07"), entry("2026-03-09", 20)], "2026-03-09")).toEqual({ pool: 5, bonus: 20 });
    expect(localDay(new Date("2026-03-08T07:01:00Z"), "America/New_York")).toBe("2026-03-08");
  });
  it("uses the pilot's rolling seven-day week, including zero-minute site rates", () => {
    const stats = gameStats([entry("2026-10-11", 0, 100), entry("2026-10-12", 0, 200)], {
      now: new Date("2026-10-14T20:00:00Z"), timeZone: "UTC"
    });
    expect(stats.weekStartsOn).toBe("2026-10-08");
    expect(stats.week.amountCents).toBe(300);
    expect(stats.sites[0].centsPerHour).toBeNull();
  });
  it("ports all 19 quest IDs, titles, descriptions, and XP exactly from the pilot", () => {
    // Only the public quest catalog is retained; the private HTML stays local.
    const expected = JSON.parse(readFileSync("tests/fixtures/quests.json", "utf8"));
    expect(expected).toHaveLength(19);
    expect(QUESTS).toEqual(expected);
  });
  it("uses the pilot's level titles, floored XP, and only timed earnings in rates", () => {
    const stats = gameStats([entry("2026-10-14", 60, 101), entry("2026-10-14", 0, 900)], {
      now: new Date("2026-10-14T20:00:00Z"), timeZone: "UTC"
    });
    expect(stats.xp).toBe(160);
    expect(stats.title).toBe(TITLES[2]);
    expect(stats.sites[0].centsPerHour).toBe(101);
    expect(stats.sites[0].amountCents).toBe(1001);
    expect(gameStats([entry("2026-10-14", 10000)], { now: new Date("2026-10-14T20:00:00Z"), timeZone: "UTC" }).title).toBe("Legend");
  });
  it("preserves stored DATE values without converting them to a different local date", () => {
    const stats = gameStats([{ ...entry("2026-10-14"), workedOn: new Date("2026-10-14T00:00:00Z") }], {
      now: new Date("2026-10-14T20:00:00Z"), timeZone: "Pacific/Honolulu"
    });
    expect(stats.streak).toBe(1);
    expect(stats.totals.minutes).toBe(10);
  });
});
