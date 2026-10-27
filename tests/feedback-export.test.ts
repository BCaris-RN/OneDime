import { describe, expect, it } from "vitest";
import { formatFeedbackReport, type FeedbackExportRow } from "../src/feedback/export.js";

const exportedAt = new Date("2026-11-01T12:00:00Z");

function feedback(overrides: Partial<FeedbackExportRow> = {}): FeedbackExportRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    playerId: "10000000-0000-4000-8000-000000000001",
    app: "first",
    body: "The button did not respond",
    blocking: false,
    status: "new",
    createdAt: new Date("2026-10-31T01:00:00Z"),
    ...overrides,
  };
}

describe("operator feedback export", () => {
  it("groups apps in tab order and puts blockers before date-ordered feedback", () => {
    const report = formatFeedbackReport([
      feedback({ id: "market", app: "market" }),
      feedback({ id: "later", createdAt: new Date("2026-10-31T02:00:00Z") }),
      feedback({ id: "early" }),
      feedback({ id: "blocker", blocking: true, createdAt: new Date("2026-10-31T03:00:00Z") }),
      feedback({ id: "spotlight", app: "spotlight" }),
      feedback({ id: "paypal", app: "paypal" }),
      feedback({ id: "stats", app: "stats" }),
      feedback({ id: "freelance", app: "freelance" }),
    ], exportedAt);
    const positions = ["## First Dime", "### blocker", "### early", "### later", "## Spotlight",
      "## Freelance", "## Market", "## PayPal", "## Stats"].map((text) => report.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(report).toContain("8 feedback items. Times are UTC.");
  });

  it("uses row IDs to keep equal-date exports deterministic without mutating the input", () => {
    const rows = [feedback({ id: "b" }), feedback({ id: "a" })];
    const report = formatFeedbackReport(rows, exportedAt);
    expect(report.indexOf("### a")).toBeLessThan(report.indexOf("### b"));
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
    expect(report).toBe(formatFeedbackReport([...rows].reverse(), exportedAt));
  });

  it("replaces player IDs with stable short tags and does not expose account metadata", () => {
    const one = feedback();
    const another = feedback({ id: "another", playerId: "20000000-0000-4000-8000-000000000002" });
    const report = formatFeedbackReport([one, feedback({ id: "same-player" }), another], exportedAt);
    const tags = [...report.matchAll(/- Player: (player-[a-f0-9]{12})/g)].map((match) => match[1]);
    expect(tags).toHaveLength(3);
    expect(tags[0]).toBe(tags[2]);
    expect(tags[0]).not.toBe(tags[1]);
    expect(report).not.toContain(one.playerId);
    expect(report).not.toContain(another.playerId);
  });

  it("redacts email-shaped text and renders submitted markup as literal quoted text", () => {
    const report = formatFeedbackReport([feedback({
      body: "Write to fictional.tester+beta@example.test\r\n</blockquote><script>alert(1)</script>\n# forged title\n[open](https://example.test)",
    })], exportedAt);
    expect(report).not.toContain("fictional.tester");
    expect(report).toContain("> Write to \\[email removed\\]");
    expect(report).not.toContain("<script>");
    expect(report).toContain("&lt;script&gt;");
    expect(report).toContain("> \\# forged title");
    expect(report).toContain("> \\[open\\]\\(https://example\\.test\\)");
  });

  it("keeps statuses, UTC timestamps, and blocker flags in the report", () => {
    const report = formatFeedbackReport([feedback({ status: "wontfix", blocking: true })], exportedAt);
    expect(report).toContain("- Created: 2026-10-31T01:00:00.000Z");
    expect(report).toContain("- Status: wontfix");
    expect(report).toContain("- Blocking: yes");
  });

  it("keeps unexpected app values out of headings without losing their feedback", () => {
    const report = formatFeedbackReport([feedback({ app: "<script>bad</script>" })], exportedAt);
    expect(report).toContain("## Other");
    expect(report).not.toContain("<script>");
    expect(report).toContain("The button did not respond");
  });

  it("writes a useful empty report", () => {
    const report = formatFeedbackReport([], exportedAt);
    expect(report).toContain("# OneDime feedback - 2026-11-01");
    expect(report).toContain("0 feedback items.");
    expect(report).toContain("No feedback yet.");
    expect(report).toContain("Review bodies before sharing this report.");
  });
});
