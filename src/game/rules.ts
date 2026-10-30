import { TITLES } from "./catalog.js";

export const RUNGS = [10, 100, 1000, 5000, 10000, 25000, 50000, 100000] as const;
const DAY_MS = 86_400_000;

export type HistoryEntry = {
  workedOn: Date | string;
  amountCents: number;
  minutes: number;
  platform: string;
  verified: boolean;
};

// DATE columns are already player-local calendar dates, not instants to re-zone.
export function entryDay(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function localDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDay(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(before: string, after: string): number {
  return Math.round((Date.parse(after) - Date.parse(before)) / DAY_MS);
}

// Replay dated entries only. No stored pool, wall-clock mutation, or order dependency.
// Approved rule: accrual begins after the first logged day, starting at zero.
export function restedXp(history: readonly HistoryEntry[], today: string) {
  const minutesByDay = new Map<string, number>();
  for (const entry of history) {
    const day = entryDay(entry.workedOn);
    if (day <= today) minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + entry.minutes);
  }
  let pool = 0;
  let bonus = 0;
  let previous: string | undefined;
  for (const [day, minutes] of [...minutesByDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (previous) pool = Math.min(100, pool + Math.max(0, daysBetween(previous, day) - 1) * 25);
    const spent = Math.min(minutes, pool);
    pool -= spent;
    bonus += spent;
    previous = day;
  }
  if (previous) pool = Math.min(100, pool + Math.max(0, daysBetween(previous, today) - 1) * 25);
  return { pool, bonus };
}

export function streak(history: readonly HistoryEntry[], today: string): number {
  const days = new Set(history.map((entry) => entryDay(entry.workedOn)).filter((day) => day <= today));
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 25)) + 1;
}

export function gameStats(
  history: readonly HistoryEntry[],
  options: {
    now: Date;
    timeZone: string;
    questXp?: number;
    claimedRungs?: number;
    verifiedOtherCents?: number;
    claimedProfessionRanks?: number;
  }
) {
  const today = localDay(options.now, options.timeZone);
  const entries = history.filter((entry) => entryDay(entry.workedOn) <= today);
  const weekStartsOn = shiftDay(today, -6);
  const totals = (rows: readonly HistoryEntry[]) => rows.reduce((sum, entry) => ({
    amountCents: sum.amountCents + entry.amountCents,
    minutes: sum.minutes + entry.minutes,
    verifiedCents: sum.verifiedCents + (entry.verified ? entry.amountCents : 0)
  }), { amountCents: 0, minutes: 0, verifiedCents: 0 });
  const all = totals(entries);
  const rested = restedXp(entries, today);
  const dollarXp = Math.floor(all.amountCents / 10);
  const xp = all.minutes + dollarXp + Math.floor((options.verifiedOtherCents ?? 0) / 10) +
    (options.questXp ?? 0) + (options.claimedRungs ?? 0) * 100 + rested.bonus +
    (options.claimedProfessionRanks ?? 0) * 100;
  const level = levelForXp(xp);
  const sites = [...new Set(entries.map((entry) => entry.platform))].sort().map((platform) => {
    const site = totals(entries.filter((entry) => entry.platform === platform));
    const timedCents = entries.filter((entry) => entry.platform === platform && entry.minutes > 0)
      .reduce((sum, entry) => sum + entry.amountCents, 0);
    return { platform, ...site, centsPerHour: site.minutes ? Math.round(timedCents * 60 / site.minutes) : null };
  }).sort((a, b) => (b.centsPerHour ?? -1) - (a.centsPerHour ?? -1));
  const goalCents = RUNGS.find((rung) => rung > all.amountCents) ?? RUNGS[RUNGS.length - 1];
  return {
    today, timeZone: options.timeZone, weekStartsOn,
    totals: all, week: totals(entries.filter((entry) => entryDay(entry.workedOn) >= weekStartsOn)),
    streak: streak(entries, today), xp, level,
    title: TITLES[Math.min(level - 1, TITLES.length - 1)],
    nextLevelXp: 25 * level ** 2,
    levelProgress: Math.round((xp - 25 * (level - 1) ** 2) / (25 * level ** 2 - 25 * (level - 1) ** 2) * 100),
    goalCents, goalPercent: Math.min(100, Math.floor(all.amountCents / goalCents * 100)),
    goalComplete: all.amountCents >= RUNGS[RUNGS.length - 1],
    restedPool: rested.pool, restedBonus: rested.bonus, sites,
    nextRungCents: RUNGS.find((rung) => rung > all.verifiedCents) ?? null
  };
}

export type GameStats = ReturnType<typeof gameStats>;
