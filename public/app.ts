import "./glass.js";
import "./header.js";
import "./demo-video-labels.js";
import "./paypal.js";
import "./exports.js";
import "./overview.js";
import "./stats.js";
import "./accessibility.js";
import { showApp } from "./workspaces.js";
import { initializeFeedback } from "./feedback.js";
import type { GameStats } from "../src/game/rules.js";
import type { QuestDefinition } from "../src/game/catalog.js";
import { dollarsToCents } from "../src/game/money.js";
import { TILE_ORDER } from "../src/game/vault.js";
import { initializeSound, playReward, playTileBreak } from "./sound.js";

type Player = { displayName: string | null; timeZone: string | null; leaderboardOptIn: boolean; welcomeCompletedAt: string | null };
type Entry = { id: string; platform: string; workedOn: string; minutes: number; amountCents: number; note: string | null; verified: boolean };
type Clock = { platform: string | null; startedAt: string | null };
type QuestPayload = { quests: QuestDefinition[]; completed: string[]; pilotAvailable: boolean };
type ProfessionRank = { profession: "creator" | "freelancer" | "driver" | "seller" | "starter"; rank: number; verifiedCents: number; nextRankCents: number | null };
type GameStatsWithProfessions = GameStats & { professions: ProfessionRank[]; professionClass: ProfessionRank | null; verifiedOtherCents: number; ladder: { nextRungCents: number | null; matchedCents: number; pendingCents: number; reachedRungs: number[] } };
type Leader = { displayName: string; verifiedTotalCents: number; highestRungCents: number | null; xp: number; level: number; sites: { platform: string; verifiedCents: number }[]; professionClass: ProfessionRank | null; professions: ProfessionRank[] };
type Vault = { tiles: number; seen: number; matchedCents: number; distinctWorkDays: number; completedQuests: number };
type ProgressSnapshot = { rungs: Set<number>; ranks: Map<string, number>; quests: Set<string> };
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => element<HTMLInputElement>(id);
let previousProgress: ProgressSnapshot | null = null;
let previousVaultTiles: number | null = null;
initializeSound();
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
  feedback_rate_limited: "You have sent five notes in the past hour. Please wait before sending another.",
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

function rankText(rank: ProfessionRank) {
  const title = rank.profession[0].toUpperCase() + rank.profession.slice(1);
  const progress = rank.nextRankCents === null ? "Top rank reached" : `${money(rank.nextRankCents - rank.verifiedCents)} to rank ${rank.rank + 1}`;
  return `${title} · ${rank.rank ? `rank ${rank.rank}` : "working toward rank 1"} · ${money(rank.verifiedCents)} matched · ${progress}`;
}
function renderStats(stats: GameStatsWithProfessions) {
  element("total-amount").textContent = money(stats.totals.amountCents);
  element("verified-amount").textContent = money(stats.totals.verifiedCents);
  element("week-amount").textContent = money(stats.week.amountCents);
  element("total-minutes").textContent = number(stats.totals.minutes);
  element("streak").textContent = number(stats.streak);
  element("rested-pool").textContent = `${stats.restedPool} XP`;
  element("level-summary").textContent = `Level ${stats.level} · ${stats.title}${stats.professionClass ? ` · ${stats.professionClass.profession[0].toUpperCase() + stats.professionClass.profession.slice(1)} class` : ""} · ${number(stats.xp)} XP`;
  element("xp-chip").textContent = `XP ${number(stats.xp)} ›`;
  for (const [id, profession] of [["rank-first", "starter"], ["rank-spotlight", "creator"], ["rank-freelance", "freelancer"]] as const) {
    const rank = stats.professions.find(item => item.profession === profession)!;
    element(id).textContent = rankText(rank);
  }
  element("rank-market").textContent = ["driver", "seller"].map(profession => rankText(stats.professions.find(item => item.profession === profession)!)).join(" · ");
  element("quest-level").textContent = `Level ${stats.level} · ${stats.title}`;
  element("quest-xp").textContent = `${stats.xp} XP · next level at ${stats.nextLevelXp}`;
  element("xp-progress").setAttribute("aria-valuenow", String(stats.levelProgress));
  element("xp-fill").style.width = `${stats.levelProgress}%`;
  const nextRung = stats.ladder.nextRungCents;
  const ladderPercent = nextRung === null ? 100 : Math.min(100, Math.floor(stats.ladder.matchedCents / nextRung * 100));
  element("goal-title").textContent = nextRung === null ? "Every rung reached" : `Next rung: ${money(nextRung)}`;
  element("goal-sub").textContent = nextRung === null ? "Your matched pay has reached the top rung." : `${money(stats.ladder.matchedCents)} matched toward ${money(nextRung)}`;
  element("goal-percent").textContent = `${ladderPercent}%`;
  element("goal-ring").setAttribute("stroke-dashoffset", (326.7 * (1 - ladderPercent / 100)).toFixed(1));
  element("ladder-matched").textContent = `${money(stats.ladder.matchedCents)} matched · counts`;
  element("ladder-pending").textContent = `${money(stats.ladder.pendingCents)} logged but unmatched · pending`;
  input("worked-on").max = stats.today;
  if (!input("worked-on").value) input("worked-on").value = stats.today;
  element("next-rung").textContent = nextRung === null ? "Your matched total has reached the top rung." : `Your next target: ${money(nextRung)} matched.`;
  element("rung-list").replaceChildren(...rungCents.map((cents) => {
    const reached = stats.ladder.reachedRungs.includes(cents);
    return node("li", `${reached ? "✓ " : ""}${money(cents)}${reached ? " · reached" : ""}`, reached ? "reached" : "");
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
    row.append(detail, node("td", `${entry.minutes} min`), node("td", money(entry.amountCents)), node("td", entry.verified ? "Matched" : "Awaiting matching"), action);
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
    if (quest.id === "start-record") {
      toggle.disabled = true;
      toggle.textContent = payload.completed.includes(quest.id) ? "Done" : "Log or import one thing";
      toggle.setAttribute("aria-label", payload.completed.includes(quest.id) ? "Start your record quest is done" : "Start your record quest completes automatically when you log or import work");
    } else toggle.addEventListener("click", () => void perform(async () => {
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
  element("highest-rung-list").replaceChildren(...(leaders.length ? leaders.map((leader) => {
    const row = node("li");
    row.append(node("span", leader.displayName), node("span", leader.highestRungCents === null ? "No rung reached" : `Highest rung: ${money(leader.highestRungCents)}`));
    return row;
  }) : [node("li", "No public ladder progress yet.", "muted")]));
  const siteLeaders = new Map<string, { name: string; cents: number }>();
  for (const leader of leaders) for (const site of leader.sites) {
    if (site.verifiedCents > (siteLeaders.get(site.platform)?.cents ?? 0)) siteLeaders.set(site.platform, { name: leader.displayName, cents: site.verifiedCents });
  }
  element("site-leaders").replaceChildren(...(siteLeaders.size ? [...siteLeaders].map(([platform, leader]) => {
    const row = node("li"); row.append(node("span", platform), node("span", `${leader.name} · ${money(leader.cents)}`)); return row;
  }) : [node("li", "No matched site leaders yet.", "muted")]));
  element("leaderboard-list").replaceChildren(...leaders.map((leader, index) => {
    const row = node("li");
    row.append(node("h3", `${index + 1}. ${leader.displayName}`), node("p", `${money(leader.verifiedTotalCents)} matched · ${number(leader.xp)} XP · Level ${leader.level}${leader.professionClass ? ` · ${leader.professionClass.profession[0].toUpperCase() + leader.professionClass.profession.slice(1)} class` : ""}`));
    if (leader.professions.length) row.append(node("p", leader.professions.map(rank => `${rank.profession[0].toUpperCase() + rank.profession.slice(1)} rank ${rank.rank}`).join(" · ")));
    if (leader.sites.length) row.append(node("p", leader.sites.map((site) => `${site.platform}: ${money(site.verifiedCents)}`).join(" · ")));
    row.append(node("p", leader.highestRungCents === null ? "No rung reached yet." : `Highest rung: ${money(leader.highestRungCents)}`));
    return row;
  }));
}
// --- vault: the pilot's 16x16 robots --------------------------------------------------------------
const PENNY = ["......kk........", ".......k........", ".....kkkkkk.....", "....kmmmmmmk....", "....kmlkklmk....", "....kmmmmmmk....",
  "....kmmkkmmk....", ".....kkkkkk.....", "..kkkkkkkkkkkk..", ".kmmmmmmmmmmmmk.", ".kmmmkkkkkkmmmk.", ".kmmkllllllkmmk.",
  ".kmmkllkkllkmmk.", ".kmmmkkkkkkmmmk.", "..kkkkkkkkkkkk..", "...kk......kk..."];
const BOTS = [
  { name: "Penny", wakesWith: "First Dime", head: PENNY.slice(0, 8), feet: PENNY[15] },
  { name: "Lumen", wakesWith: "Spotlight", head: ["...k.......k....", "....k.....k.....", ".....kkkkkk.....", "....kmmmmmmk....", "....kmlkklmk....", "....kmmmmmmk....", "....kmmmmmmk....", ".....kkkkkk....."], feet: PENNY[15] },
  { name: "Quill", wakesWith: "Freelance", head: ["................", "...........kk...", "....kkkkkk.k....", "....kmmmmmmk....", "....kmlkklmk....", "....kmmmmmmk....", "....kmmkkmmk....", ".....kkkkkk....."], feet: PENNY[15] },
  { name: "Axle", wakesWith: "Delivery", head: ["................", "................", "....kkkkkkkk....", "...kmmmmmmmmk...", "...kmlkmmklmk...", "...kmmmmmmmmk...", "....kkkkkkkk....", "................"], feet: "..kkk......kkk.." },
  { name: "Barter", wakesWith: "Selling", head: ["................", "..kkkkkkkkkkkk..", "..kmkmkmkmkmkm..", "....kkkkkkkk....", "....kmlkklmk....", "....kmmmmmmk....", "....kmmkkmmk....", ".....kkkkkk....."], feet: PENNY[15] }
];
const SVG = "http://www.w3.org/2000/svg";
function sprite(rows: string[], fill?: string) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("aria-hidden", "true");
  rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === ".") return;
    const rect = document.createElementNS(SVG, "rect");
    for (const [name, value] of [["x", x], ["y", y], ["width", 1], ["height", 1]] as const) rect.setAttribute(name, String(value));
    rect.setAttribute("class", fill ?? pixel);
    svg.append(rect);
  }));
  return svg;
}
function vaultRule(label: string, tilesEach: number, percent: number) {
  const row = node("div", undefined, "vault-rule");
  const bar = node("i", undefined, "vault-rule-bar"); const fill = node("b");
  fill.style.width = `${Math.min(100, percent)}%`; bar.append(fill);
  row.append(node("span", label), bar, node("span", String(tilesEach)));
  return row;
}
function renderVault(vault: Vault) {
  const visible = Math.max(vault.tiles, vault.seen), awake = visible >= 100;
  const frame = node("div", undefined, "vault-frame");
  // Only the picture is an image; the side panel and the count stay readable text.
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", awake ? "The Vault is open. Penny is awake." : `The Vault. ${visible} of 100 tiles broken.`);
  const tiles = node("div", undefined, "vault-tiles"); tiles.setAttribute("aria-hidden", "true");
  const broken = new Set(TILE_ORDER.slice(0, visible)), fresh = new Set(TILE_ORDER.slice(Math.min(vault.seen, visible), visible));
  let delay = 0;
  for (let index = 0; index < 100; index++) {
    const tile = node("i", undefined, `vault-tile${broken.has(index) ? fresh.has(index) ? " crumble" : " gone" : ""}`);
    if (fresh.has(index)) tile.style.setProperty("--d", String(delay++));
    tiles.append(tile);
  }
  frame.append(sprite(PENNY), tiles);
  const side = node("div", undefined, "vault-side");
  if (awake) {
    const door = node("div", undefined, "vault-door");
    door.append(node("strong", "THE MINT DOOR"), node("span", "Your Lot opens soon."));
    side.append(node("h3", "PENNY IS AWAKE", "vault-awake-title"), door);
  } else {
    side.append(node("p", "What breaks tiles", "vault-side-title"),
      vaultRule("Paid $1", 2, Math.floor(vault.matchedCents / 100) * 2),
      vaultRule("Work day", 1, vault.distinctWorkDays),
      vaultRule("Quest", 3, vault.completedQuests * 3),
      node("p", `So far: ${money(vault.matchedCents)} paid, ${vault.distinctWorkDays} work day${vault.distinctWorkDays === 1 ? "" : "s"}, ${vault.completedQuests} quest${vault.completedQuests === 1 ? "" : "s"}. Only pay matched to your PayPal activity counts.`, "vault-so-far"),
      node("p", `${100 - visible} tiles to go. No shortcuts, no purchases, no luck.`, "vault-so-far"));
  }
  const board = node("div", undefined, "vault-board");
  board.append(frame, element("vault-count"));
  element("vault-grid").querySelector(".vault-layout")!.replaceChildren(board, side);
  element("vault-count").textContent = awake ? "100 / 100 tiles. Penny is awake." : `${visible} / 100 tiles broken`;
  element("vault-roster").replaceChildren(...BOTS.map((bot, index) => {
    const open = index === 0 && awake;
    const art = sprite([...bot.head, ...PENNY.slice(8, 15), bot.feet], open ? undefined : "sil");
    if (index > 0) {
      const mark = document.createElementNS(SVG, "text");
      for (const [name, value] of [["class", "q"], ["x", "8"], ["y", "10.5"], ["text-anchor", "middle"]]) mark.setAttribute(name, value);
      mark.textContent = "?"; art.append(mark);
    }
    const card = node("li", undefined, "vault-bot");
    card.append(art, node("strong", open || index === 0 ? bot.name : "? ? ?"),
      node("small", open ? "Awake" : index === 0 ? `${visible}% uncovered` : `Wakes with ${bot.wakesWith}`));
    return card;
  }));
}
async function refresh() {
  const [me, stats, entries, value, quests, leaders, vault] = await Promise.all([
    api<{ player: Player }>("/api/me"), api<GameStatsWithProfessions>("/api/me/stats"), api<{ entries: Entry[] }>("/api/entries"),
    api<Clock>("/api/clock"), api<QuestPayload>("/api/quests"), api<{ players: Leader[] }>("/api/leaderboard"), api<Vault>("/api/vault")
  ]);
  const progress: ProgressSnapshot = {
    rungs: new Set(stats.ladder.reachedRungs),
    ranks: new Map(stats.professions.map(rank => [rank.profession, rank.rank])),
    quests: new Set(quests.completed)
  };
  if (previousProgress && (
    [...progress.rungs].some(rung => !previousProgress!.rungs.has(rung))
    || [...progress.ranks].some(([profession, rank]) => rank > (previousProgress!.ranks.get(profession) ?? 0))
    || [...progress.quests].some(quest => !previousProgress!.quests.has(quest))
  )) playReward();
  previousProgress = progress;
  if (previousVaultTiles !== null && vault.tiles > previousVaultTiles) playTileBreak();
  previousVaultTiles = vault.tiles;
  player = me.player;
  element("player-name").textContent = player.displayName ?? "Player";
  input("time-zone").value = player.timeZone ?? "UTC";
  renderStats(stats); renderEntries(entries.entries); renderClock(value); renderQuests(quests); renderLeaders(leaders.players); renderVault(vault);
  void api<Vault>("/api/vault/seen", {}).catch(() => undefined);
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
    if (!player?.welcomeCompletedAt && !element<HTMLDialogElement>("welcome-dialog").open)
      element<HTMLDialogElement>("welcome-dialog").showModal();
  } catch (error) {
    message(error instanceof Error ? error.message : "Could not load your progress. Please refresh.", true);
  } finally {
    availability();
    // Keep retry reachable if the initial requests failed.
    element<HTMLButtonElement>("refresh").disabled = false;
  }
}

async function finishWelcome(workTypes: string[]) {
  const saved = await api<{ complete: boolean; workTypes: string[] }>("/api/onboarding", { workTypes });
  if (player) player.welcomeCompletedAt = new Date().toISOString();
  element<HTMLDialogElement>("welcome-dialog").close();
  showApp(saved.workTypes[0] ?? "first", true);
  element("welcome-guide").hidden = false;
  element("welcome-guide-title").textContent = "Start your record";
  message("Your workspace is ready. You can change apps at any time.");
}
element<HTMLFormElement>("welcome-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const workTypes = [...element<HTMLFormElement>("welcome-form").querySelectorAll<HTMLInputElement>('input[name="workType"]:checked')].map(input => input.value);
  const submit = element<HTMLButtonElement>("welcome-form").querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  element("welcome-error").textContent = "";
  void finishWelcome(workTypes).catch(() => { element("welcome-error").textContent = "We could not save your choices. Please try again."; })
    .finally(() => { submit.disabled = false; });
});
element("welcome-skip").addEventListener("click", () => {
  const submit = element<HTMLButtonElement>("welcome-form").querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.disabled = true;
  void finishWelcome([]).catch(() => { element("welcome-error").textContent = "We could not skip right now. Please try again."; })
    .finally(() => { submit.disabled = false; });
});
element("welcome-import").addEventListener("click", () => {
  element("welcome-guide").hidden = true;
  showApp("paypal", true);
  window.setTimeout(() => element<HTMLInputElement>("paypal-csv").focus(), 0);
});
element("welcome-guide-dismiss").addEventListener("click", () => { element("welcome-guide").hidden = true; });

// The root element also carries data-tab (the Glass accent), so only buttons are sub-tabs.
const tabs = [...document.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
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

type Appearance = { skin: "glass" | "current" | "paper" | "slate"; mode: "system" | "light" | "dark" };
const SKINS = ["glass", "current", "paper", "slate"];
const appearanceKey = "onedime-appearance";
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const appearanceDialog = element<HTMLDialogElement>("appearance-dialog");
let appearance: Appearance = { skin: "glass", mode: "system" };
try {
  const stored = JSON.parse(localStorage.getItem(appearanceKey) ?? "null") as Partial<Appearance> | null;
  if (stored && SKINS.includes(stored.skin ?? "")
    && ["system", "light", "dark"].includes(stored.mode ?? "")) appearance = stored as Appearance;
  else {
    const previousMode = localStorage.getItem("onedime-theme");
    if (previousMode === "light" || previousMode === "dark") {
      // A mode saved before skins existed was chosen for Current, so keep that look.
      appearance = { skin: "current", mode: previousMode };
      // Save first so a failed write keeps the old preference for the next load.
      localStorage.setItem(appearanceKey, JSON.stringify(appearance));
    }
    localStorage.removeItem("onedime-theme");
  }
} catch { /* Appearance still works when storage is disabled. */ }
function applyAppearance() {
  const root = document.documentElement;
  if (appearance.skin === "current") delete root.dataset.skin;
  else root.dataset.skin = appearance.skin;
  if (appearance.mode === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance.mode;
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="skin"]')) input.checked = input.value === appearance.skin;
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) input.checked = input.value === appearance.mode;
  const dark = appearance.mode === "dark" || (appearance.mode === "system" && systemDark.matches);
  element("theme-toggle").textContent = dark ? "Light mode" : "Dark mode";
  element("theme-toggle").setAttribute("aria-label", "Switch to " + (dark ? "light" : "dark") + " mode");
  // Glass is dark by design, so a light/dark toggle would do nothing visible.
  element("theme-toggle").hidden = appearance.skin === "glass";
}
function saveAppearance() {
  applyAppearance();
  try { localStorage.setItem(appearanceKey, JSON.stringify(appearance)); } catch { /* Appearance still works when storage is disabled. */ }
}
applyAppearance();
systemDark.addEventListener("change", () => { if (appearance.mode === "system") applyAppearance(); });
element("appearance-open").addEventListener("click", () => appearanceDialog.showModal());
element("appearance-close").addEventListener("click", () => appearanceDialog.close());
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="skin"]')) input.addEventListener("change", () => {
  if (input.checked && SKINS.includes(input.value)) { appearance.skin = input.value as Appearance["skin"]; saveAppearance(); }
});
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) input.addEventListener("change", () => {
  if (input.checked && ["system", "light", "dark"].includes(input.value)) { appearance.mode = input.value as Appearance["mode"]; saveAppearance(); }
});
element("theme-toggle").addEventListener("click", () => {
  appearance.mode = (appearance.mode === "dark" || (appearance.mode === "system" && systemDark.matches)) ? "light" : "dark";
  saveAppearance();
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
element("xp-chip").addEventListener("click", () => showApp("vault", true));
element("logout").addEventListener("click", async () => {
  try { await api("/api/logout", {}); window.location.assign("/"); }
  catch (error) { message(error instanceof Error ? error.message : "Could not log out. Please try again.", true); }
});
initializeFeedback(feedback => api("/api/feedback", feedback));
availability();
setInterval(renderElapsed, 1000);
function showPostLoginBoot() {
  const overlay = element<HTMLElement>("post-login-boot");
  let seen = false;
  try { seen = sessionStorage.getItem("onedime-post-login-boot") === "shown"; sessionStorage.setItem("onedime-post-login-boot", "shown"); } catch { /* The overlay still works without session storage. */ }
  if (seen) return;
  const list = element<HTMLUListElement>("post-login-boot-log");
  const lines = ["Session established ...", "Loading your ledger ...", "5 apps online ...", "Ranks and stats synced ...", "Welcome back, player"];
  overlay.hidden = false;
  let index = 0;
  let timer = 0;
  const close = () => { window.clearInterval(timer); overlay.hidden = true; overlay.removeEventListener("click", close); window.removeEventListener("keydown", close); };
  const append = () => { if (index >= lines.length) { close(); return; } const item = document.createElement("li"); item.textContent = lines[index++]; list.append(item); };
  append(); timer = window.setInterval(append, 420); window.setTimeout(close, 2500);
  overlay.addEventListener("click", close); window.addEventListener("keydown", close, { once: true });
}
showPostLoginBoot();
void initialize();

document.addEventListener("onedime:payment-routed",()=>void refresh());
if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
const offlineStatus = element("offline-status");
const updateOfflineStatus = () => { offlineStatus.hidden = navigator.onLine; };
window.addEventListener("offline", updateOfflineStatus);
window.addEventListener("online", updateOfflineStatus);
updateOfflineStatus();
