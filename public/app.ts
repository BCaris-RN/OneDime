import "./paypal.js";
import "./exports.js";
import "./overview.js";
import "./workspaces.js";
import type { GameStats } from "../src/game/rules.js";
import type { QuestDefinition } from "../src/game/catalog.js";
import { dollarsToCents } from "../src/game/money.js";

type Player = { displayName: string | null; timeZone: string | null; leaderboardOptIn: boolean };
type Entry = { id: string; platform: string; workedOn: string; minutes: number; amountCents: number; note: string | null; verified: boolean };
type Clock = { platform: string | null; startedAt: string | null };
type QuestPayload = { quests: QuestDefinition[]; completed: string[]; pilotAvailable: boolean };
type Leader = { displayName: string; verifiedTotalCents: number; xp: number; level: number; sites: { platform: string; verifiedCents: number }[]; rungClaims: { rungCents: number; claimedAt: string }[] };
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const rungCents = [10, 100, 1000, 5000, 10000, 25000, 50000, 100000];
let player: Player | null = null;
let clock: Clock = { platform: null, startedAt: null };
let ready = false;
let busy = false;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function message(text: string, error = false) {
  const target = element("message");
  target.dataset.error = String(error);
  target.setAttribute("role", error ? "alert" : "status");
  target.textContent = text;
}
const errors: Record<string, string> = {
  invalid_input: "Check the fields and try again.", future_date: "Choose today or an earlier date in your time zone.",
  write_rate_limited: "You have made several changes. Please wait a minute and try again.",
  same_origin_required: "Please reload this page and try again.", already_clocked_in: "A clock is already running. Refresh to see it.",
  not_clocked_in: "No clock is running. Refresh to see the latest state.", entry_not_found: "That entry is no longer available. Please refresh.",
  quest_catalog_unavailable: "Quests are not available yet.",
  quest_not_found: "That quest is no longer available. Please refresh."
};
async function api<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : method,
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    throw new Error("Connection lost. Check your connection and try again.");
  }
  if (response.status === 401) { window.location.assign("/"); throw new Error("Your session has ended. Please log in again."); }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(errors[payload.error] ?? "We could not save or load your changes. Please try again.");
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
function availability() {
  document.querySelectorAll<HTMLButtonElement>("#entry-form button, #clock-form button, #time-zone-form button, #leaderboard-toggle, #entries-body button, #quest-list button, #refresh").forEach((button) => { button.disabled = !ready || busy; });
  element<HTMLButtonElement>("clock-in").disabled = !ready || busy || !!clock.startedAt;
  element<HTMLButtonElement>("clock-out").disabled = !ready || busy || !clock.startedAt;
  input("clock-platform").disabled = !!clock.startedAt;
}
async function perform(task: () => Promise<void>) {
  if (busy || !ready) return;
  busy = true;
  availability();
  try { await task(); }
  catch (error) { message(error instanceof Error ? error.message : "Something went wrong. Please try again.", true); }
  finally { busy = false; availability(); }
}

function renderStats(stats: GameStats) {
  element("total-amount").textContent = money(stats.totals.amountCents);
  element("verified-amount").textContent = money(stats.totals.verifiedCents);
  element("week-amount").textContent = money(stats.week.amountCents);
  element("total-minutes").textContent = number(stats.totals.minutes);
  element("streak").textContent = number(stats.streak);
  element("rested-pool").textContent = `${stats.restedPool} XP`;
  element("level-summary").textContent = `Level ${stats.level} · ${stats.title} · ${number(stats.xp)} XP`;
  element("quest-level").textContent = `Level ${stats.level} · ${stats.title}`;
  element("quest-xp").textContent = `${stats.xp} XP · next level at ${stats.nextLevelXp}`;
  element("xp-progress").setAttribute("aria-valuenow", String(stats.levelProgress));
  element("xp-fill").style.width = `${stats.levelProgress}%`;
  element("goal-title").textContent = stats.goalComplete ? "Every rung cleared" : stats.goalCents === 10 ? "Earn your first dime" : `Next stop: ${money(stats.goalCents)}`;
  element("goal-sub").textContent = `${money(stats.totals.amountCents)} of ${money(stats.goalCents)}`;
  element("goal-percent").textContent = `${stats.goalPercent}%`;
  element("goal-ring").setAttribute("stroke-dashoffset", (326.7 * (1 - Math.min(1, stats.totals.amountCents / stats.goalCents))).toFixed(1));
  input("worked-on").max = stats.today;
  if (!input("worked-on").value) input("worked-on").value = stats.today;
  element("next-rung").textContent = stats.nextRungCents === null ? "Your verified total has reached the top rung." : `Your next target: ${money(stats.nextRungCents)} verified.`;
  element("rung-list").replaceChildren(...rungCents.map((cents) => {
    const reached = stats.totals.verifiedCents >= cents;
    return node("li", `${money(cents)}${reached ? " · reached" : ""}`, reached ? "reached" : "");
  }));
  element("site-rates").replaceChildren(...(stats.sites.length ? stats.sites.map((site) => {
    const row = node("li");
    row.append(node("span", site.platform), node("span", site.centsPerHour === null ? "No minutes logged" : `${money(site.centsPerHour)}/hr`));
    return row;
  }) : [node("li", "Site rates appear after you log work.", "muted")]));
}
function renderEntries(entries: Entry[]) {
  element("entries-empty").hidden = entries.length > 0;
  element("entries-table").hidden = !entries.length;
  element("entries-body").replaceChildren(...entries.slice(0, 60).map((entry) => {
    const row = node("tr"); row.dataset.recordId=entry.id; row.dataset.recordType="first";
    const detail = node("td", entry.workedOn.slice(0, 10));
    detail.append(node("small", entry.platform));
    if (entry.note) detail.append(node("small", entry.note));
    const action = node("td");
    const remove = node("button", "Delete", "text-button danger-button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Delete ${entry.workedOn.slice(0, 10)} entry at ${entry.platform}`);
    remove.addEventListener("click", () => {
      if (!window.confirm("Delete this entry?")) return;
      void perform(async () => {
      await api("/api/entries", { id: entry.id }, "DELETE");
      await refreshAfterChange("Entry deleted.");
      element("refresh").focus();
      });
    });
    action.append(remove);
    row.append(detail, node("td", `${entry.minutes} min`), node("td", money(entry.amountCents)), node("td", entry.verified ? "Verified" : "Awaiting verification"), action);
    return row;
  }));
  document.dispatchEvent(new Event("onedime:rendered"));
}
function renderClock(value: Clock) {
  clock = value;
  const status = value.startedAt ? `Clocked in at ${new Date(value.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: player?.timeZone ?? "UTC" })} · ${value.platform}` : "No clock running.";
  element("clock-status").textContent = status;
  if (value.platform) input("clock-platform").value = value.platform;
  renderElapsed();
}
function renderElapsed() {
  const seconds = clock.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(clock.startedAt).getTime()) / 1000)) : 0;
  element("clock-elapsed").textContent = `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function renderQuests(payload: QuestPayload) {
  element("quests-status").textContent = payload.quests.length ? "Complete a quest to add its listed XP. Select it again to undo." : "Quests are not available yet. Your logged work still earns XP.";
  element("quest-list").replaceChildren(...payload.quests.map((quest) => {
    const row = node("li");
    const copy = node("div");
    copy.append(node("h3", quest.title), node("p", quest.description ?? "", "muted"), node("span", `+${quest.xp} XP`, "quest-reward"));
    if (payload.completed.includes(quest.id)) row.classList.add("quest-done");
    const toggle = node("button", payload.completed.includes(quest.id) ? "Completed" : "Complete", "ghost-button");
    toggle.type = "button";
    toggle.dataset.questId = quest.id;
    toggle.setAttribute("aria-pressed", String(payload.completed.includes(quest.id)));
    toggle.setAttribute("aria-label", `Toggle quest: ${quest.title}`);
    toggle.addEventListener("click", () => void perform(async () => {
      const result = await api<{ completed: boolean }>(`/api/quests/${encodeURIComponent(quest.id)}`, {});
      await refreshAfterChange(result.completed ? "Quest completed." : "Quest marked incomplete.");
      [...document.querySelectorAll<HTMLButtonElement>("#quest-list button")].find((button) => button.dataset.questId === quest.id)?.focus();
    }));
    row.append(copy, toggle);
    return row;
  }));
}
function renderLeaders(leaders: Leader[]) {
  const button = element<HTMLButtonElement>("leaderboard-toggle");
  button.textContent = player?.leaderboardOptIn ? "Leave leaderboard" : "Join leaderboard";
  element("leaderboard-empty").textContent = leaders.length ? "" : "No players have joined yet.";
  element("race-body").replaceChildren(...rungCents.map((rung) => {
    const winner = leaders.find((leader) => leader.rungClaims.some((claim) => claim.rungCents === rung));
    const claim = winner?.rungClaims.find((item) => item.rungCents === rung);
    const row = node("tr");
    row.append(node("td", `First to ${money(rung)} · +100 XP`), node("td", winner?.displayName ?? "No public claim"), node("td", claim ? new Date(claim.claimedAt).toLocaleString([], { timeZone: player?.timeZone ?? "UTC" }) : "—"));
    return row;
  }));
  const siteLeaders = new Map<string, { name: string; cents: number }>();
  for (const leader of leaders) for (const site of leader.sites) {
    if (site.verifiedCents > (siteLeaders.get(site.platform)?.cents ?? 0)) siteLeaders.set(site.platform, { name: leader.displayName, cents: site.verifiedCents });
  }
  element("site-leaders").replaceChildren(...(siteLeaders.size ? [...siteLeaders].map(([platform, leader]) => {
    const row = node("li"); row.append(node("span", platform), node("span", `${leader.name} · ${money(leader.cents)}`)); return row;
  }) : [node("li", "No verified site leaders yet.", "muted")]));
  element("leaderboard-list").replaceChildren(...leaders.map((leader, index) => {
    const row = node("li");
    row.append(node("h3", `${index + 1}. ${leader.displayName}`), node("p", `${money(leader.verifiedTotalCents)} verified · ${number(leader.xp)} XP · Level ${leader.level}`));
    if (leader.sites.length) row.append(node("p", leader.sites.map((site) => `${site.platform}: ${money(site.verifiedCents)}`).join(" · ")));
    for (const claim of leader.rungClaims) row.append(node("p", `Claimed ${money(claim.rungCents)} · ${new Date(claim.claimedAt).toLocaleString([], { timeZone: player?.timeZone ?? "UTC" })}`));
    if (!leader.rungClaims.length) row.append(node("small", "No rung claims yet."));
    return row;
  }));
}
async function refresh() {
  const [me, stats, entries, value, quests, leaders] = await Promise.all([
    api<{ player: Player }>("/api/me"), api<GameStats>("/api/me/stats"), api<{ entries: Entry[] }>("/api/entries"),
    api<Clock>("/api/clock"), api<QuestPayload>("/api/quests"), api<{ players: Leader[] }>("/api/leaderboard")
  ]);
  player = me.player;
  element("player-name").textContent = player.displayName ?? "Player";
  input("time-zone").value = player.timeZone ?? "UTC";
  renderStats(stats); renderEntries(entries.entries); renderClock(value); renderQuests(quests); renderLeaders(leaders.players);
}
async function refreshAfterChange(success: string) {
  try { await refresh(); message(success); }
  catch { message(`${success} Could not reload your progress. Please refresh before making another change.`, true); }
}
async function initialize() {
  try {
    const me = await api<{ player: Player }>("/api/me");
    if (!me.player.timeZone) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      await api("/api/me/time-zone", { timeZone });
    }
    await refresh();
    ready = true;
    message("");
  } catch (error) {
    message(error instanceof Error ? error.message : "Could not load your progress. Please refresh.", true);
  } finally {
    availability();
    // Keep retry reachable if the initial requests failed.
    element<HTMLButtonElement>("refresh").disabled = false;
  }
}

const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-tab]")];
function setTab(id: string, focus = false) {
  const target = tabs.find((tab) => tab.dataset.tab === id) ?? tabs[0];
  for (const tab of tabs) {
    const selected = tab === target;
    tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    element(tab.getAttribute("aria-controls")!).hidden = !selected;
  }
  if (focus) { target.focus(); target.scrollIntoView({ block: "nearest", inline: "nearest" }); }
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => { setTab(tab.dataset.tab!); history.replaceState(null, "", `#${tab.dataset.tab}`); });
  tab.addEventListener("keydown", (event) => {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setTab(tabs[next].dataset.tab!, true);
    history.replaceState(null, "", `#${tabs[next].dataset.tab}`);
  });
});
setTab(location.hash.slice(1) || "log");
window.addEventListener("hashchange", () => setTab(location.hash.slice(1)));

function theme(value: "light" | "dark") {
  document.documentElement.dataset.theme = value;
  element("theme-toggle").textContent = value === "dark" ? "Light mode" : "Dark mode";
  element("theme-toggle").setAttribute("aria-label", `Switch to ${value === "dark" ? "light" : "dark"} mode`);
}
let savedTheme: string | null = null;
try { savedTheme = localStorage.getItem("onedime-theme"); } catch { /* Storage may be disabled. */ }
theme(savedTheme === "dark" || (savedTheme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
element("theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  theme(next);
  try { localStorage.setItem("onedime-theme", next); } catch { /* Theme still works without persistence. */ }
});

element<HTMLFormElement>("entry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void perform(async () => {
    const amountCents = dollarsToCents(input("amount").value.trim());
    await api("/api/entries", { platform: input("platform").value, minutes: Number(input("minutes").value), amountCents, workedOn: input("worked-on").value, note: element<HTMLTextAreaElement>("note").value });
    input("minutes").value = "0"; input("amount").value = "0.00"; element<HTMLTextAreaElement>("note").value = "";
    await refreshAfterChange("Entry saved.");
  });
});
element("log-time-only").addEventListener("click", () => {
  if (Number(input("minutes").value) <= 0) { message("Add the minutes you worked first.", true); input("minutes").focus(); return; }
  input("amount").value = "0.00";
  element<HTMLFormElement>("entry-form").requestSubmit();
});
element<HTMLFormElement>("clock-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void perform(async () => { await api("/api/clock/in", { platform: input("clock-platform").value }); await refreshAfterChange("Clock started."); });
});
element("clock-out").addEventListener("click", () => void perform(async () => {
  const result = await api<{ platform: string; minutes: number; workedOn: string }>("/api/clock/out", {});
  input("platform").value = result.platform; input("minutes").value = String(result.minutes); input("worked-on").value = result.workedOn;
  await refreshAfterChange(`${result.minutes} minutes added to the form. Review and save your entry.`); setTab("log"); input("amount").focus();
}));
element("leaderboard-toggle").addEventListener("click", () => void perform(async () => {
  const join = !player?.leaderboardOptIn;
  await api(`/api/leaderboard/${join ? "join" : "leave"}`, {});
  await refreshAfterChange(join ? "You joined the leaderboard." : "You left the leaderboard.");
}));
element<HTMLFormElement>("time-zone-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void perform(async () => { await api("/api/me/time-zone", { timeZone: input("time-zone").value.trim() }); input("worked-on").value = ""; await refreshAfterChange("Time zone saved."); });
});
element("refresh").addEventListener("click", () => { if (!ready) void initialize(); else void perform(async () => { await refresh(); message("Your progress is up to date."); }); });
element("logout").addEventListener("click", async () => {
  try { await api("/api/logout", {}); window.location.assign("/"); }
  catch (error) { message(error instanceof Error ? error.message : "Could not log out. Please try again.", true); }
});
availability();
setInterval(renderElapsed, 1000);
void initialize();

document.addEventListener("onedime:payment-routed",()=>void refresh());
