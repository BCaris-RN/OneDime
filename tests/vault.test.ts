import { describe, expect, it } from "vitest";
import { TILE_ORDER, vaultSeenCount, vaultTileCount } from "../src/game/vault.js";

describe("vault math", () => {
  it("counts matched pay, days and quests and caps at 100", () => {
    expect(vaultTileCount({ matchedCents: 250, distinctWorkDays: 2, completedQuests: 1 })).toBe(9);
    expect(vaultTileCount({ matchedCents: 1_000_000, distinctWorkDays: 100, completedQuests: 100 })).toBe(100);
    expect(vaultTileCount({ matchedCents: 99, distinctWorkDays: 0, completedQuests: 0 })).toBe(0);
  });
  it("keeps a deterministic seeded order and monotonic seen state", () => {
    expect(TILE_ORDER).toHaveLength(100);
    expect(new Set(TILE_ORDER).size).toBe(100);
    expect(vaultSeenCount(4, 2)).toBe(4);
    expect(vaultSeenCount(4, 8)).toBe(8);
  });
});
