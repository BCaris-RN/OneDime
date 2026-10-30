export type MonthlyMetrics = {
  month: string;
  verifiedEarners: number;
  verifiedCents: number;
  loggedCents: number;
  imports: number;
};

export type AggregateMetrics = {
  players: number;
  accountsWithRecords: number;
  firstEntryPlayers: number;
  verifiedFirstDimePlayers: number;
  medianHoursToFirstVerifiedDime: number | null;
  averageActiveDaysPerPlayerWeek: number | null;
  averageAppsPerPlayer: number | null;
  week1RetentionPercent: number | null;
  week4RetentionPercent: number | null;
  returnAfterSevenDayGapPercent: number | null;
  verifiedSharePercent: number | null;
  suggestionAcceptancePercent: number | null;
  mismatchPercent: number | null;
  verifiedCents: number;
  medianVerifiedHourlyCents: number | null;
  feedbackCount: number;
};

const count = (value: number) => String(Math.max(0, Math.trunc(value)));
const cents = (value: number) => `$${(Math.trunc(value) / 100).toFixed(2)}`;
const percent = (value: number | null) => value === null ? "Not measurable" : `${value.toFixed(1)}%`;
const duration = (value: number | null) => value === null ? "Not measurable" : `${value.toFixed(1)} hours`;
const hourly = (value: number | null) => value === null ? "Not measurable" : `${cents(value)}/hour`;

/** Deliberately accepts aggregate values only; identity and free-text fields cannot enter the report. */
export function formatMetricsReport(
  generatedAt: Date,
  monthly: readonly MonthlyMetrics[],
  metrics: AggregateMetrics,
) {
  const rows = [...monthly].sort((a, b) => a.month.localeCompare(b.month));
  const lines = [
    `# Anonymous OneDime metrics — ${generatedAt.toISOString().slice(0, 10)}`,
    "",
    "Aggregate counts only. No names, emails, notes, transaction identifiers, or per-player rows are included.",
    "Currency uses integer cents internally and is formatted here for readability.",
    "",
    "## Monthly activity",
    "",
    "| Month | Verified earners | Verified earnings | Logged earnings | Imported PayPal transactions |",
    "| --- | ---: | ---: | ---: | ---: |",
  ];
  if (!rows.length) lines.push("| No data | 0 | $0.00 | $0.00 | 0 |", "");
  for (const row of rows)
    lines.push(`| ${row.month} | ${count(row.verifiedEarners)} | ${cents(row.verifiedCents)} | ${cents(row.loggedCents)} | ${count(row.imports)} |`);
  lines.push(
    "",
    "## Aggregate KPIs",
    "",
    "| KPI | Result | Definition / limitation |",
    "| --- | ---: | --- |",
    `| First-entry rate | ${percent(metrics.players ? metrics.firstEntryPlayers * 100 / metrics.players : 0)} | Accounts with at least one First Dime entry / all accounts |`,
    `| First-dime rate | ${percent(metrics.players ? metrics.verifiedFirstDimePlayers * 100 / metrics.players : 0)} | Accounts with at least one verified First Dime entry / all accounts |`,
    `| Time to first verified dime | ${duration(metrics.medianHoursToFirstVerifiedDime)} | Median account creation to verified entry creation |`,
    `| Active days per player-week | ${metrics.averageActiveDaysPerPlayerWeek === null ? "Not measurable" : metrics.averageActiveDaysPerPlayerWeek.toFixed(2)} | Average distinct logged work dates for each player-week |`,
    `| Apps per account | ${metrics.averageAppsPerPlayer === null ? "Not measurable" : metrics.averageAppsPerPlayer.toFixed(2)} | Distinct apps with records summed across all accounts / all accounts, including accounts with no records |`,
    `| Accounts with at least one record | ${count(metrics.accountsWithRecords)} | Accounts with a work record in any app |`,
    `| Week-1 retention | ${percent(metrics.week1RetentionPercent)} | Mature accounts last seen on/after day 7 / accounts at least 7 days old |`,
    `| Week-4 retention | ${percent(metrics.week4RetentionPercent)} | Mature accounts last seen on/after day 28 / accounts at least 28 days old |`,
    `| Return after a 7-day gap | ${percent(metrics.returnAfterSevenDayGapPercent)} | Requires sign-in event history; current schema stores only last-seen time |`,
    `| Verified share | ${percent(metrics.verifiedSharePercent)} | Verified logged cents / all logged cents |`,
    `| Suggestion acceptance | ${percent(metrics.suggestionAcceptancePercent)} | Requires suggestion-view/acceptance events, which are not recorded |`,
    `| Mismatch rate | ${percent(metrics.mismatchPercent)} | Current routed records whose amount does not match linked PayPal gross or net |`,
    `| Total verified earnings | ${cents(metrics.verifiedCents)} | Current verified records, evaluated under F1 verification rules |`,
    `| Median verified hourly rate | ${hourly(metrics.medianVerifiedHourlyCents)} | Median hourly rate among verified records with time logged |`,
    `| Feedback items | ${count(metrics.feedbackCount)} | All currently retained feedback items |`,
    "",
    "## Data coverage",
    "",
    `- Accounts counted: ${count(metrics.players)}. First-entry accounts counted: ${count(metrics.firstEntryPlayers)}. Verified First Dime accounts counted: ${count(metrics.verifiedFirstDimePlayers)}.`,
    "- Seven-day return after a gap and suggestion acceptance are not measurable because event history is not retained.",
    "- Retention is an account-age proxy based on the current last-seen timestamp; it is not a full cohort event-history measure.",
    "- This report contains no account-level or free-text data.",
    "",
  );
  return lines.join("\n");
}
