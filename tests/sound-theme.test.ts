import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "vitest";

type Score = {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  loopSeconds: number;
  instruments: Record<string, { wave: string }>;
  notes: { i: string; start: number; dur: number }[];
  ui: Record<string, string | { midi: number; dur: number }[]>;
};

const score = JSON.parse(
  await readFile(new URL("../public/audio/theme.json", import.meta.url), "utf8")
) as Score;

describe("the public sound score", () => {
  it("uses known instruments and keeps every note inside its loop", () => {
    const knownInstruments = new Set(["lead", "keys", "bass", "hat", "rim", "kick"]);
    const loopBeats = score.bars * score.beatsPerBar;
    assert.equal(score.bpm, 100);
    assert.equal(score.loopSeconds, 38.4);
    assert.ok(Object.keys(score.instruments).every(name => knownInstruments.has(name)));
    for (const note of score.notes) {
      assert.ok(knownInstruments.has(note.i), `unknown instrument ${note.i}`);
      assert.ok(Number.isFinite(note.start) && note.start >= 0, `invalid start ${note.start}`);
      assert.ok(Number.isFinite(note.dur) && note.dur > 0, `invalid duration ${note.dur}`);
      assert.ok(note.start + note.dur <= loopBeats, `${note.i} note crosses the loop boundary`);
    }
  });

  it("keeps the UI sound notes at positive durations", () => {
    for (const [name, value] of Object.entries(score.ui)) {
      if (typeof value === "string") {
        assert.match(value, /noise burst/i, `${name} should describe its synthesized noise`);
        continue;
      }
      assert.ok(value.length, `${name} has notes`);
      for (const note of value)
        assert.ok(Number.isFinite(note.dur) && note.dur > 0, `${name} note has a positive duration`);
    }
  });
});
