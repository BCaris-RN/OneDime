/*  (o) OneDime | public/workspaces.ts
 *  ----------------------------------------------------------
 *  Pilot workspace controls backed by owned server records.
 */
import type { LedgerRow } from "../src/ledger/catalog.js";
import { dealStages, gigStages } from "../src/ledger/options.js";
import { summary } from "../src/ledger/summary.js";
import { monthInputs, monthQuery } from "./months.js";

type Form = {
  id: string;
  path: string;
  body: string;
  fields: [string, string, number?][];
  columns: (string | ((r: LedgerRow) => string))[];
  stage?: readonly string[];
};
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const control = (id: string) => el<HTMLInputElement>(id);
const usd = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const num = (r: LedgerRow, key: string) => Number(r[key] ?? 0);
const forms: Form[] = [
  {
    id: "sStreamForm",
    path: "/spotlight/income",
    body: "sIncBody",
    fields: [
      ["platform", "sPlat"],
      ["stream_type", "sType"],
      ["amount_cents", "sAmt", 100],
      ["earned_on", "sDate"],
      ["status", "sStatus"],
      ["content_minutes", "sMin", 1],
      ["note", "sNote"]
    ],
    columns: [
      "earned_on",
      "platform",
      "stream_type",
      (r) => usd(num(r, "amount_cents")),
      "status",
      "note"
    ]
  },
  {
    id: "sDealForm",
    path: "/spotlight/deals",
    body: "sDealBody",
    fields: [
      ["brand", "dBrand"],
      ["platform", "dPlat"],
      ["amount_cents", "dAmt", 100],
      ["due_on", "dDue"],
      ["deliverables", "dDeliv"],
      ["stage", "dStage"]
    ],
    columns: [
      (r) => `${r.brand} · ${r.platform}`,
      "deliverables",
      (r) => usd(num(r, "amount_cents")),
      "due_on",
      "stage"
    ],
    stage: dealStages
  },
  {
    id: "jobForm",
    path: "/freelance/gigs",
    body: "jBody",
    fields: [
      ["platform", "jPlat"],
      ["client", "jClient"],
      ["project", "jProj"],
      ["pricing", "jPrice"],
      ["gross_cents", "jGross", 100],
      ["fee_cents", "jFee", 100],
      ["hours_x100", "jHrs", 100],
      ["started_on", "jDate"],
      ["stage", "jStage"]
    ],
    columns: [
      "started_on",
      (r) => `${r.client}: ${r.project} · ${r.platform}`,
      (r) => usd(num(r, "gross_cents") - num(r, "fee_cents")),
      (r) => String(num(r, "hours_x100") / 100),
      "stage"
    ],
    stage: gigStages
  },
  {
    id: "driveForm",
    path: "/market/shifts",
    body: "dBody",
    fields: [
      ["platform", "vPlat"],
      ["worked_on", "vDate"],
      ["pay_cents", "vPay", 100],
      ["tips_cents", "vTips", 100],
      ["minutes_online", "vHrs", 60],
      ["miles_x10", "vMi", 10]
    ],
    columns: [
      "worked_on",
      "platform",
      (r) => usd(num(r, "pay_cents")),
      (r) => usd(num(r, "tips_cents")),
      (r) => String(num(r, "minutes_online") / 60),
      (r) => String(num(r, "miles_x10") / 10)
    ]
  },
  {
    id: "sellForm",
    path: "/market/sales",
    body: "xBody",
    fields: [
      ["store", "xPlat"],
      ["item", "xItem"],
      ["sold_on", "xDate"],
      ["price_cents", "xPrice", 100],
      ["fee_cents", "xFees", 100],
      ["cost_cents", "xCost", 100],
      ["ship_cents", "xShip", 100],
      ["made_by", "xSup"],
      ["status", "xStatus"]
    ],
    columns: [
      "sold_on",
      (r) => `${r.item} · ${r.store}`,
      (r) => usd(num(r, "price_cents")),
      (r) =>
        usd(
          num(r, "price_cents") - num(r, "fee_cents") - num(r, "cost_cents") - num(r, "ship_cents")
        ),
      "status"
    ]
  },
  {
    id: "sExpForm",
    path: "/spotlight/expenses",
    body: "sExpBody",
    fields: [
      ["item", "eItem"],
      ["amount_cents", "eAmt", 100],
      ["spent_on", "eDate"]
    ],
    columns: ["spent_on", "item", (r) => usd(num(r, "amount_cents"))]
  }
];
function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
}
function button(text: string, action: () => void) {
  const b = node("button", text);
  b.type = "button";
  b.className = "act ghost small";
  b.addEventListener("click", action);
  return b;
}
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(text: string) {
  el("toast").textContent = text;
  el("toast").classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el("toast").classList.remove("on"), 5000);
}
export async function request<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (response.status === 401) {
    location.assign("/");
    throw new Error("Please log in again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error === "fee_exceeds_gross"
        ? "The fee cannot exceed what the client paid."
        : response.status === 429
          ? "Please wait a minute and try again."
          : "Could not save or load. Check the fields and try again."
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
export function scaled(value: string, scale: number) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Use a positive number with up to two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const hundredths = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const result = hundredths * BigInt(scale);
  if (result % 100n || result / 100n > 2147483647n)
    throw new Error("Use whole minutes and miles to one decimal place.");
  return Number(result / 100n);
}
let currentMarket = "bal-drive";
export function showApp(app: string, focus = false) {
  for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-app]")) {
    const active = tab.dataset.app === app;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    el(tab.getAttribute("aria-controls")!).hidden = !active;
    if (active && focus) tab.focus();
  }
  document.dispatchEvent(new CustomEvent("onedime:app", { detail: app }));
}
function tabKeys(nav: HTMLElement, select: (button: HTMLButtonElement) => void) {
  const tabs = [...nav.querySelectorAll<HTMLButtonElement>("[role=tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index + tabs.length - 1) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : null;
      if (next !== null) {
        event.preventDefault();
        select(tabs[next]);
        tabs[next].focus();
      }
    });
  });
}
tabKeys(el("app-nav"), (tab) => showApp(tab.dataset.app!));
tabKeys(el("balNav"), (tab) => {
  currentMarket = tab.getAttribute("aria-controls")!;
  for (const b of el("balNav").querySelectorAll<HTMLButtonElement>("[role=tab]")) {
    const active = b === tab;
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
    const panel = el(b.getAttribute("aria-controls")!);
    panel.classList.remove("hide");
    panel.hidden = !active;
  }
});
el("b-sell").tabIndex = -1;
el("bal-sell").classList.remove("hide");
el("bal-sell").hidden = true;
for (const [formId, fieldId, stages] of [
  ["jobForm", "jStage", gigStages],
  ["sDealForm", "dStage", dealStages]
] as const) {
  const label = node("label", "Stage");
  const select = node("select");
  select.id = fieldId;
  for (const stage of stages) select.append(node("option", stage));
  label.append(select);
  el(formId).querySelector(".fields")!.append(label);
}
for (const [app, parent] of [
  ["freelance", "app-freelance"],
  ["market_delivery", "bal-drive"],
  ["market_selling", "bal-sell"]
]) {
  const section = node("section");
  section.className = "slip";
  const f = node("form");
  f.id = `expense-${app}`;
  f.append(node("h2", "Expenses"));
  const fields = node("div");
  fields.className = "fields";
  for (const [key, label, type] of [
    ["item", "Item", "text"],
    ["amount", "Amount ($)", "number"],
    ["date", "Date", "date"]
  ]) {
    const l = node("label", label),
      i = node("input");
    i.id = `${app}-${key}`;
    i.type = type;
    i.required = true;
    i.maxLength = 120;
    if (type === "number") {
      i.min = "0";
      i.max = "10000";
      i.step = "0.01";
    }
    l.append(i);
    fields.append(l);
  }
  const submit = node("button", "Add expense");
  submit.className = "act";
  f.append(fields, submit);
  const wrap = node("div");
  wrap.className = "tablewrap";
  const table = node("table"),
    thead = node("thead"),
    tr = node("tr");
  for (const text of ["Date", "Item", "Amount", "Actions"]) tr.append(node("th", text));
  thead.append(tr);
  const tbody = node("tbody");
  tbody.id = `expenses-${app}`;
  table.append(thead, tbody);
  wrap.append(table);
  section.append(f, wrap);
  el(parent).append(section);
  forms.push({
    id: f.id,
    path: app === "freelance" ? "/freelance/expenses" : "/market/expenses",
    body: tbody.id,
    fields: [
      ["item", `${app}-item`],
      ["amount_cents", `${app}-amount`, 100],
      ["spent_on", `${app}-date`]
    ],
    columns: ["spent_on", "item", (r) => usd(num(r, "amount_cents"))]
  });
}
const edits = new Map<string, string>();
const cancelButtons = new Map<string, HTMLButtonElement>();
let loading = false;
async function run(task: () => Promise<void>) {
  if (loading) return;
  loading = true;
  for (const f of forms)
    el(f.id)
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
  try {
    await task();
  } catch (error) {
    toast(error instanceof Error ? error.message : "Something went wrong.");
  } finally {
    loading = false;
    for (const f of forms)
      el(f.id)
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = false));
  }
}
function edit(f: Form, row: LedgerRow) {
  edits.set(f.id, row.id);
  cancelButtons.get(f.id)!.hidden = false;
  for (const [field, id, scale] of f.fields)
    control(id).value = scale ? String(num(row, field) / scale) : String(row[field] ?? "");
  el(f.id).querySelector<HTMLButtonElement>("button[type=submit],button:not([type])")!.textContent =
    "Save changes";
  el(f.id).scrollIntoView({ block: "center" });
  control(f.fields[0][1]).focus();
}
function reset(f: Form) {
  edits.delete(f.id);
  cancelButtons.get(f.id)!.hidden = true;
  el<HTMLFormElement>(f.id).reset();
  el(f.id).querySelector<HTMLButtonElement>("button[type=submit],button:not([type])")!.textContent =
    f.id.includes("expense") || f.id === "sExpForm"
      ? "Add expense"
      : f.id === "sStreamForm"
        ? "Add income"
        : f.id === "sDealForm"
          ? "Add deal"
          : f.id === "driveForm"
            ? "Log shift"
            : f.id === "sellForm"
              ? "Log sale"
              : "Add gig";
  dates();
  control(f.fields[0][1]).focus();
}
function renderRows(f: Form, rows: LedgerRow[]) {
  const tbody = el(f.body);
  const active=document.activeElement as HTMLElement|null;
  const focus=active&&tbody.contains(active)?{id:active.closest<HTMLElement>("[data-record-id]")?.dataset.recordId,action:active.dataset.action}:null;
  const restoreFocus=()=>{
    if(!focus)return;
    const target=tbody.querySelector<HTMLElement>(`[data-record-id="${focus.id}"] [data-action="${focus.action}"]`)
      ??tbody.querySelector<HTMLElement>("button,select")??control(f.fields[0][1]);
    target.focus();
  };
  tbody.replaceChildren();
  const app = f.id.startsWith("expense-")
    ? f.id.slice(8)
    : f.id === "sExpForm"
      ? "spotlight"
      : null;
  if (app) rows = rows.filter((row) => row.app === app);
  if (!rows.length) {
    const tr = node("tr"),
      td = node("td", "No entries yet.");
    td.colSpan = f.columns.length + 1;
    td.className = "empty";
    tr.append(td);
    tbody.append(tr);
    restoreFocus();
    return;
  }
  for (const row of rows) {
    const tr = node("tr");
    tr.dataset.recordId = row.id;
    tr.dataset.recordType =
      f.id === "sStreamForm"
        ? "income"
        : f.id === "jobForm"
          ? "gigs"
          : f.id === "driveForm"
            ? "shifts"
            : f.id === "sellForm"
              ? "sales"
              : "expense";
    for (const col of f.columns) {
      const td = node("td");
      if (col === "stage" && f.stage) {
        const select = node("select");
        select.setAttribute("aria-label", `Stage for ${row.project ?? row.brand}`);
        select.dataset.action = "stage";
        for (const stage of f.stage) select.append(node("option", stage));
        select.value = String(row.stage);
        select.addEventListener(
          "change",
          () =>
            void run(async () => {
              await request(`${f.path}/${row.id}`, { stage: select.value }, "PATCH");
              toast("Stage saved.");
              await refresh();
            })
        );
        td.append(select);
      } else td.textContent = typeof col === "function" ? col(row) : String(row[col] ?? "—");
      tr.append(td);
    }
    const actions = node("td");
    actions.append(
      button("Edit", () => edit(f, row)),
      button("Delete", () => {
        if (confirm("Delete this entry?"))
          void run(async () => {
            await request(`${f.path}/${row.id}`, {}, "DELETE");
            toast("Deleted.");
            await refresh();
          });
      })
    );
    if (row.status === "pending")
      actions.append(
        button(
          "Mark paid",
          () =>
            void run(async () => {
              await request(`${f.path}/${row.id}`, { status: "paid" }, "PATCH");
              toast("Marked paid.");
              await refresh();
            })
        )
      );
    const description=`${row.project??row.brand??row.item??row.platform??row.store??"entry"} ${row.started_on??row.earned_on??row.worked_on??row.sold_on??row.spent_on??""}`.trim();
    for(const action of actions.querySelectorAll("button")) {
      action.dataset.action=action.textContent!;
      action.setAttribute("aria-label",`${action.textContent} ${description}`);
    }
    tr.append(actions);
    tbody.append(tr);
  }
  restoreFocus();
}
function stats(id: string, items: [string, string][]) {
  el(id).replaceChildren(
    ...items.map(([label, value]) => {
      const d = node("div");
      d.append(node("dt", label), node("dd", value));
      return d;
    })
  );
}
function platforms(
  id: string,
  rows: ReturnType<typeof summary>["byPlatform"],
  columns: (keyof ReturnType<typeof summary>["byPlatform"][number])[]
) {
  el(id).replaceChildren(
    ...rows.map((row) => {
      const tr = node("tr");
      for (const key of columns)
        tr.append(
          node(
            "td",
            key.endsWith("Cents")
              ? usd(row[key] as number | null)
              : row[key] === null
                ? "—"
                : String(row[key]) + (key === "marginPercent" ? "%" : "")
          )
        );
      return tr;
    })
  );
}
let today = "";
function dates() {
  for(const f of forms)for(const [field,id] of f.fields)
    if(field.endsWith("_on")&&field!=="due_on"&&!control(id).value)control(id).value=today;
}
let refreshSequence = 0;
async function refresh() {
  const sequence = ++refreshSequence;
  const unique = [...new Set(forms.map((f) => f.path))];
  const [me, spot, freelance, market, ...lists] = await Promise.all([
    request<{ player: { timeZone: string | null } }>("/me"),
    request<ReturnType<typeof summary>>(`/spotlight/summary${monthQuery("spotlight")}`),
    request<ReturnType<typeof summary>>(`/freelance/summary${monthQuery("freelance")}`),
    request<{ delivery: ReturnType<typeof summary>; selling: ReturnType<typeof summary> }>(
      `/market/summary${monthQuery("market")}`
    ),
    ...unique.map((path) => request<{ rows: LedgerRow[] }>(path))
  ]);
  if (sequence !== refreshSequence) return;
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: (me as { player: { timeZone: string | null } }).player.timeZone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  today = ["year", "month", "day"]
    .map((type) => dateParts.find((part) => part.type === type)!.value)
    .join("-");
  dates();
  for (const input of monthInputs.values()) if (!input.value) input.value = today.slice(0,7);
  const a = spot as ReturnType<typeof summary>,
    b = freelance as ReturnType<typeof summary>,
    c = market as { delivery: ReturnType<typeof summary>; selling: ReturnType<typeof summary> };
  stats("sasuStats", [
    ["Earned selected month", usd(a.earnedCents)],
    ["Pending (all time)", usd(a.pendingCents)],
    ["Expenses selected month", usd(a.expensesCents)],
    ["Net selected month", usd(a.netCents)],
    ["Open brand deals (all time)", usd(a.openCents)]
  ]);
  stats("fiveStats", [
    ["Paid selected month", usd(b.paidNetCents)],
    ["Fees selected month", usd(b.paidFeesCents)],
    ["Clearing (all time)", usd(b.clearingCents)],
    ["In progress (all time)", usd(b.openCents)],
    ["Per hour (paid, all time)", usd(b.perHourCents)],
    ["Expenses selected month", usd(b.expensesCents)]
  ]);
  stats("driveStats", [
    ["Earned selected month", usd(c.delivery.earnedCents)],
    ["Tips selected month", usd(c.delivery.tipsCents)],
    ["Per hour", usd(c.delivery.perHourCents)],
    ["Per mile", usd(c.delivery.perMileCents)],
    ["Miles selected month", String(c.delivery.milesX10 / 10)],
    ["Net selected month", usd(c.delivery.netCents)]
  ]);
  stats("sellStats", [
    ["Sales selected month", String(c.selling.count)],
    ["Revenue selected month", usd(c.selling.earnedCents)],
    ["Profit selected month", usd(c.selling.netCents)],
    ["Margin", c.selling.marginPercent === null ? "—" : `${c.selling.marginPercent}%`],
    ["Pending (all time)", usd(c.selling.pendingCents)]
  ]);
  platforms("sPlatBody", a.byPlatform, [
    "platform",
    "earnedCents",
    "paidCents",
    "pendingCents",
    "perHourCents"
  ]);
  platforms("jPlatBody", b.byPlatform, [
    "platform",
    "count",
    "earnedCents",
    "feesCents",
    "netCents",
    "perHourCents"
  ]);
  platforms("dPlatBody", c.delivery.byPlatform, [
    "platform",
    "count",
    "earnedCents",
    "perHourCents",
    "perMileCents"
  ]);
  platforms("sPlatBody2", c.selling.byPlatform, [
    "platform",
    "count",
    "earnedCents",
    "feesCents",
    "netCents",
    "marginPercent"
  ]);
  for (const f of forms)
    renderRows(f, (lists[unique.indexOf(f.path)] as { rows: LedgerRow[] }).rows);
  document.dispatchEvent(new Event("onedime:rendered"));
}
for (const f of forms) {
  const cancel=button("Cancel edit", () => reset(f));cancel.hidden=true;cancelButtons.set(f.id,cancel);el(f.id).append(cancel);
  el(f.id).addEventListener("submit", (event) => {
    event.preventDefault();
    void run(async () => {
      const data: Record<string, unknown> = {};
      for (const [field, id, scale] of f.fields) {
        const value = control(id).value;
        data[field] = scale
          ? scaled(value || "0", scale)
          : field === "due_on"
            ? value || null
            : value;
      }
      if (f.id === "sExpForm") data.app = "spotlight";
      if (f.id.startsWith("expense-")) data.app = f.id.slice(8);
      const editId = edits.get(f.id);
      await request(editId ? `${f.path}/${editId}` : f.path, data, editId ? "PATCH" : "POST");
      reset(f);
      toast("Saved.");
      try {
        await refresh();
      } catch {
        toast("Saved. Refresh to load the latest totals.");
      }
    });
  });
}
control("jHrs").step = "0.01";
for (const f of forms)
  for (const [field, id, scale] of f.fields) {
    if (scale) {
      const i = control(id);
      if (scale === 100 && field.endsWith("_cents")) i.max = "10000";
      else if (field === "hours_x100" || field === "minutes_online") i.max = "24";
      else if (field === "miles_x10") i.max = "2000";
      else if (field === "content_minutes") i.max = "1440";
    }
  }
void run(refresh);

document.addEventListener("onedime:payment-routed", () => void run(refresh));
document.addEventListener("onedime:month", event => {
  if (["spotlight","freelance","market"].includes((event as CustomEvent<string>).detail))
    void refresh().catch(() => toast("Could not load that month. Try again."));
});
