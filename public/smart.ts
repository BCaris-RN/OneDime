/*  (o) OneDime | public/smart.ts
 *  ----------------------------------------------------------
 *  Explicit device-only suggestions, with a fixed-map fallback.
 */
import { request } from "./workspaces.js";
type Suggestion = { app: string; record_type: string; platform: string; confidence: number };
type Row = { id: string; payer: string; net_cents: number; kind: string; eligible: boolean;
  routed_record_id: string | null; suggestion: Suggestion | null };
export function smartControls(parent: HTMLElement, rows: () => Row[], apply: (id: string, value: Suggestion | null) => void) {
  const label = document.createElement("label"), toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.disabled = true;
  label.append(toggle, "Smart suggestions");
  const notice = document.createElement("p");
  notice.textContent = "Off by default. About 42 MB once, cached by your browser. Suggestions run on this device; no payment data is sent for AI. Your imported activity is stored in OneDime.";
  void fetch("/smart-model.json").then(r => r.json()).then(({ downloadBytes }) => {
    notice.textContent = `Off by default. ${(downloadBytes / 1_000_000).toFixed(1)} MB once, cached by your browser. Suggestions run on this device; no payment data is sent for AI. Your imported activity is stored in OneDime.`;
  }).catch(() => {});
  const button = document.createElement("button");
  button.type = "button"; button.className = "act small"; button.textContent = "Download and suggest"; button.disabled = true;
  const status = document.createElement("p"); status.setAttribute("role", "status");
  status.textContent = "Smart suggestions off. Using the fixed payer map.";
  parent.append(label, notice, button, status);
  let worker: Worker | null = null, running = false, cancel: (() => void) | null = null;
  const generated = new Set<string>();
  const stop = () => { worker?.terminate(); worker = null; running = false; cancel?.(); cancel = null; };
  void request<{ smartSuggestions: boolean }>("/settings").then(settings => {
    toggle.checked = settings.smartSuggestions; toggle.disabled = false;
    button.disabled = !toggle.checked;
    if (toggle.checked) status.textContent = "Smart suggestions on. Download and suggest when ready.";
  }).catch(() => { status.textContent = "Could not load settings. Using the fixed payer map."; });
  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    toggle.disabled = true;
    if (!enabled) stop();
    button.disabled = true;
    void request("/settings", { smartSuggestions: enabled }, "PATCH").then(() => {
      button.disabled = !enabled;
      status.textContent = enabled ? "Ready to download and suggest on this device." : "Smart suggestions off. Using the fixed payer map.";
      if (!enabled) { for (const id of generated) apply(id, null); generated.clear(); }
    }).catch(() => {
      toggle.checked = !enabled; button.disabled = !toggle.checked;
      status.textContent = "Could not save the setting. Your previous setting is unchanged.";
    }).finally(() => { toggle.disabled = false; });
  });
  button.addEventListener("click", () => {
    if (!toggle.checked || running) return;
    const candidates = rows().filter(row => row.eligible && !row.routed_record_id && !row.suggestion).slice(0, 10);
    if (!candidates.length) { status.textContent = "No unknown unrouted payments to suggest. Using the fixed payer map."; return; }
    running = true; button.disabled = true;
    status.textContent = "Loading the local model. The first download may take a minute.";
    try {
      worker ??= new Worker("/smart-worker.js", { type: "module" });
      const id = crypto.randomUUID();
      const finish = (message: string) => { clearTimeout(timer); running = false; button.disabled = !toggle.checked; status.textContent = message; };
      const timer = setTimeout(() => { stop(); finish("This device took too long. Using the fixed payer map."); }, 120000);
      cancel = () => clearTimeout(timer);
      worker.onerror = () => { stop(); finish("The model could not load here. Using the fixed payer map."); };
      worker.onmessage = event => {
        if (event.data.progress) { status.textContent = "Loading cached model files or downloading once. Payment data stays here."; return; }
        if (event.data.id !== id) return;
        if (event.data.error || !Array.isArray(event.data.suggestions)) { stop(); finish("Smart suggestions unavailable. Using the fixed payer map."); return; }
        candidates.forEach((row, index) => { generated.add(row.id); apply(row.id, event.data.suggestions[index] ?? null); });
        finish("Suggestions ready. Low-confidence payments have none. Review and confirm; the server validates every route.");
      };
      worker.postMessage({ id, rows: candidates.map(row => ({ payer: row.payer, netCents: row.net_cents, kind: row.kind })) });
    } catch { stop(); button.disabled = !toggle.checked; status.textContent = "This browser cannot run the model. Using the fixed payer map."; }
  });
}
