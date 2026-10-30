export type MonthlyChartValues = { first: number; spotlight: number; freelance: number; market: number };
export type MonthlySegment = { app: number; value: number; y: number; height: number };

export function monthlyStackSegments(monthly: readonly MonthlyChartValues[], plotTop: number, plotBottom: number) {
  const values = (month: MonthlyChartValues) => [month.first, month.spotlight, month.freelance, month.market];
  const maxPositive = Math.max(0, ...monthly.map(month => values(month).reduce((sum, cents) => sum + Math.max(0, cents), 0)));
  const maxNegative = Math.max(0, ...monthly.map(month => values(month).reduce((sum, cents) => sum + Math.max(0, -cents), 0)));
  const extent = Math.max(100, maxPositive + maxNegative);
  const scale = (plotBottom - plotTop) / extent;
  const baseline = plotTop + maxPositive * scale;
  const segments = monthly.map(month => {
    let positiveY = baseline, negativeY = baseline;
    return values(month).flatMap((value, app): MonthlySegment[] => {
      if (!value) return [];
      const height = Math.abs(value) * scale;
      if (value > 0) { positiveY -= height; return [{ app, value, y: positiveY, height }]; }
      const y = negativeY;
      negativeY += height;
      return [{ app, value, y, height }];
    });
  });
  return { baseline, scale, maxPositive, maxNegative, segments };
}
