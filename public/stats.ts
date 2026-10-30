/*  (o) OneDime | public/stats.ts
 *  ----------------------------------------------------------
 *  Accessible pixel charts backed by the player's read-only Stats endpoint.
 */
import { request } from "./workspaces.js";
import { monthlyStackSegments } from "./stats-chart.js";
type Month = { month: string; first: number; spotlight: number; freelance: number; market: number };
type Rate = { platform: string; centsPerHour: number };
type Stats = { month: string; earnedCents: number; verifiedCents: number; activeDays: number; streak: number; hourly: Rate[]; monthly: Month[] };
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const money = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
const names = [["First Dime", "solid"], ["Spotlight", "checker"], ["Freelance", "stripes"], ["Market", "dots"]] as const;
const monthValues = (m: Month) => [m.first, m.spotlight, m.freelance, m.market];
let sequence = 0;
let last: Stats | null = null;
const esc = (v: string) => { const d = document.createElement("span"); d.textContent = v; return d.innerHTML; };
function table(headers: string[], rows: string[][]) {
  const t = document.createElement("table"), caption = t.createCaption(), head = t.createTHead().insertRow();
  caption.className = "sr-only";
  caption.textContent = headers[0] === "Month" ? "Earned by month and app" : headers[0] === "Platform" ? "Real hourly rate by platform" : "Matched and pending amounts this month";
  headers.forEach(label => { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); });
  const body = t.createTBody(); rows.forEach(values => { const row = body.insertRow(); values.forEach(value => { const td = row.insertCell(); td.textContent = value; }); });
  return t;
}
function render(data: Stats, animate: boolean) {
  const pct = data.earnedCents ? Math.min(100, Math.round(data.verifiedCents * 100 / data.earnedCents)) : 0;
  const best = data.hourly[0];
  const tiles: [string, string, number?][] = [["Earned this month, before fees", money(data.earnedCents), data.earnedCents], ["Matched share", data.earnedCents ? `${pct}%` : "—"], ["Best real hourly rate", best ? money(best.centsPerHour) : "—", best?.centsPerHour], ["Active days, last 7", `${data.activeDays} of 7`], ["Streak across any app", `${data.streak} ${data.streak === 1 ? "day" : "days"}`]];
  const dl = el("stats-kpis"); dl.replaceChildren();
  tiles.forEach(([label, value, count]) => { const box = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.className = "num"; dd.textContent = value; if (count !== undefined) dd.dataset.count = String(count); box.append(dt, dd); dl.append(box); });
  el("stats-note").textContent = best ? `Best paying per hour: ${best.platform}.` : "Log time with your work to see real hourly rates.";

  const W = 320, H = 150, plotTop = 12, plotBottom = 128;
  const chart = monthlyStackSegments(data.monthly, plotTop, plotBottom), { baseline: base, scale, maxPositive, maxNegative } = chart;
  const extent = Math.max(100, maxPositive + maxNegative), left = 42, bw = 28, gap = (W - left - 6 * bw) / 6;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked monthly earnings by app for the last six months; losses appear below the zero line" shape-rendering="crispEdges"><defs><pattern id="stats-checker" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="var(--chart-ink)"/><rect x="1" y="1" width="1" height="1" fill="var(--chart-ink)"/></pattern><pattern id="stats-stripes" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="var(--chart-ink)"/></pattern><pattern id="stats-dots" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="var(--chart-ink)"/></pattern></defs><desc>${data.monthly.map(m => `${m.month}: ${names.map((name, app) => `${name[0]} ${money(monthValues(m)[app]!)}`).join(", ")}; positive amounts rise from zero and losses fall below zero`).join(". ")}</desc>`;
  for (let g = 1; g <= 2; g++) for (const sign of [1, -1]) { const bound = sign > 0 ? maxPositive : maxNegative; if (!bound) continue; const cents = Math.round(sign * bound * g / 2), y = base - cents * scale; svg += `<line class="stats-gridline" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="${left - 4}" y="${y + 3}" text-anchor="end">${cents < 0 ? "−" : ""}$${Math.abs(cents / 100)}</text>`; }
  data.monthly.forEach((m, i) => { const x = left + gap / 2 + i * (bw + gap); chart.segments[i]?.forEach(({ app, value, y, height }) => { svg += `<rect class="stats-bar ${animate ? value < 0 ? "stats-grow-negative" : "stats-grow" : ""} pattern-${names[app]![1]}" style="--step:${i}" x="${x}" y="${y}" width="${bw}" height="${height}" stroke="var(--chart-ink)"/>`; }); svg += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${new Date(`${m.month}-01T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" })}</text>`; });
  svg += `<line x1="${left}" x2="${W}" y1="${base}" y2="${base}" stroke="var(--chart-ink)" stroke-width="2"/></svg>`;
  el("stats-month-chart").innerHTML = svg;
  el("stats-legend").replaceChildren(); names.forEach(([label, pattern]) => { const li = document.createElement("li"); li.innerHTML = `<span class="stats-swatch pattern-${pattern}" aria-hidden="true"></span>${label}`; el("stats-legend").append(li); });
  const months = data.monthly.map(m => [m.month, money(m.first), money(m.spotlight), money(m.freelance), money(m.market), money(m.first + m.spotlight + m.freelance + m.market)]);
  el("stats-month-table").replaceChildren(table(["Month", ...names.map(n => n[0]), "Total"], months));
  if (!data.hourly.length) { el("stats-rate-chart").innerHTML = `<p class="stats-note">No timed work yet. Add time to your work entries to see a real hourly rate.</p><svg viewBox="0 0 320 28" role="img" aria-label="No real hourly rates yet" shape-rendering="crispEdges"><desc>No work with time logged yet.</desc><text x="4" y="18">No timed work yet</text></svg>`; el("stats-rate-table").replaceChildren(); }
  else { const rh = 22, lab = 104, maxRate = Math.max(...data.hourly.map(x => x.centsPerHour), 1); let bars = `<svg viewBox="0 0 320 ${data.hourly.length * rh + 8}" role="img" aria-label="Real hourly rate by platform, top eight" shape-rendering="crispEdges"><desc>${data.hourly.map(r => `${r.platform}, ${money(r.centsPerHour)} per hour`).join(", ")}</desc>`; data.hourly.forEach((r, i) => { const y = i * rh + 4, w = Math.max(2, Math.round(r.centsPerHour / maxRate * 160)); bars += `<text x="${lab - 6}" y="${y + 11}" text-anchor="end">${esc(r.platform).slice(0, 14)}</text><rect class="stats-rate ${animate ? "stats-grow-x" : ""}" style="--step:${i}" x="${lab}" y="${y + 2}" width="${w}" height="12"/><text x="${lab + w + 5}" y="${y + 11}">${money(r.centsPerHour)}</text>`; }); el("stats-rate-chart").innerHTML = bars + "</svg>"; el("stats-rate-table").replaceChildren(table(["Platform", "Per hour"], data.hourly.map(r => [r.platform, money(r.centsPerHour)]))); }
  let meter = `<svg viewBox="0 0 320 34" role="img" aria-label="Matched and pending shares this month: ${pct}% matched" shape-rendering="crispEdges"><desc>Matched ${money(data.verifiedCents)}, pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))} this month.</desc>`;
  for (let i = 0; i < 20; i++) { const x = 6 + i * 15.4, kind = i < Math.round(pct / 5) ? "verified" : i < Math.round(pct / 5) + Math.round((100 - pct) / 5) ? "pending" : "empty"; meter += `<rect class="meter-block ${kind} ${animate && kind !== "empty" ? "stats-pop" : ""}" style="--step:${i}" x="${x}" y="7" width="12" height="20"/>`; }
  el("stats-meter").innerHTML = meter + `</svg><p class="stats-note">Matched ${money(data.verifiedCents)} · Pending ${money(Math.max(0, data.earnedCents - data.verifiedCents))}</p>`;
  el("stats-meter-table").replaceChildren(table(["Status", "Amount"], [["Matched", money(data.verifiedCents)], ["Pending", money(Math.max(0, data.earnedCents - data.verifiedCents))]]));
  el("stats-meter-note").textContent = data.earnedCents ? "This month, across all apps." : "Nothing logged this month yet. Your first entry fills the meter.";
  if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const targets = [...dl.querySelectorAll<HTMLElement>("[data-count]")]; targets.forEach(dd => { const end = Number(dd.dataset.count); let n = 0; dd.textContent = money(0); const tick = () => { n++; dd.textContent = money(Math.round(end * n / 6)); if (n < 6) setTimeout(tick, 70); }; setTimeout(tick, 350); }); }
}
async function load(animate = false) { const id = ++sequence; try { const data = await request<Stats>("/stats"); if (id !== sequence) return; last = data; render(data, animate); } catch { if (id === sequence) el("stats-note").textContent = "Could not load stats. Try again after reconnecting."; } }
document.addEventListener("onedime:app", event => { if ((event as CustomEvent<string>).detail === "stats") { el("app-stats").classList.remove("stats-play"); void el("app-stats").offsetWidth; el("app-stats").classList.add("stats-play"); void load(true); } });
document.addEventListener("onedime:rendered", () => { if (last) void load(false); });
document.addEventListener("onedime:payment-routed", () => { if (!el("app-stats").hidden) void load(false); });
