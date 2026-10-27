import { describe, expect, it } from "vitest";
import { formatMetricsReport, type AggregateMetrics, type MonthlyMetrics } from "../src/metrics/report.js";

const monthly: MonthlyMetrics[] = [{ month: "2026-10", verifiedEarners: 2, verifiedCents: 12345, loggedCents: 24690, imports: 4 }];
const metrics: AggregateMetrics = {
  players: 4, firstEntryPlayers: 3, verifiedFirstDimePlayers: 2,
  medianHoursToFirstVerifiedDime: 12.5, averageActiveDaysPerPlayerWeek: 2.25,
  averageAppsPerPlayer: 1.5, week1RetentionPercent: 50, week4RetentionPercent: null,
  returnAfterSevenDayGapPercent: null, verifiedSharePercent: 50,
  suggestionAcceptancePercent: null, mismatchPercent: 2.5, verifiedCents: 12345,
  medianVerifiedHourlyCents: 2450, feedbackCount: 3,
};

describe("anonymous metrics report", () => {
  it("formats aggregate-only KPIs with explicit gaps for unrecorded events", () => {
    const report = formatMetricsReport(new Date("2026-10-26T12:00:00Z"), monthly, metrics);
    expect(report).toContain("| 2026-10 | 2 | $123.45 | $246.90 | 4 |");
    expect(report).toContain("| Return after a 7-day gap | Not measurable |");
    expect(report).toContain("| Suggestion acceptance | Not measurable |");
    expect(report).toContain("| Week-4 retention | Not measurable |");
    expect(report).toContain("No names, emails, notes, transaction identifiers, or per-player rows");
    expect(report).not.toContain("player_id");
  });

  it("emits a useful zero-data report without inventing records", () => {
    const zero: AggregateMetrics = {
      ...metrics, players: 0, firstEntryPlayers: 0, verifiedFirstDimePlayers: 0,
      medianHoursToFirstVerifiedDime: null, averageActiveDaysPerPlayerWeek: null,
      averageAppsPerPlayer: null, week1RetentionPercent: null, week4RetentionPercent: null,
      verifiedSharePercent: null, mismatchPercent: null, verifiedCents: 0,
      medianVerifiedHourlyCents: null, feedbackCount: 0,
    };
    const report = formatMetricsReport(new Date("2026-10-26T12:00:00Z"), [], zero);
    expect(report).toContain("| No data | 0 | $0.00 | $0.00 | 0 |");
    expect(report).toContain("Accounts counted: 0.");
  });
});
