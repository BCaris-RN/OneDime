/*  (o) OneDime | public/pad.ts
 *  ----------------------------------------------------------
 *  The D-pad: docked or a floating pane that moves focus and tabs across the app.
 *  The pad never takes focus itself; it acts on the last control you were on.
 */
const controls = document.querySelector<HTMLElement>(".controls")!;
const grip = document.getElementById("pad-grip") as HTMLButtonElement;
const toggle = document.getElementById("pad-float") as HTMLButtonElement;
const statusLine = document.getElementById("control-status")!;
const home = document.createComment("docked pad");
const storageKey = "onedime-pad";
const margin = 8, step = 16, bigStep = 64;
const focusSelector = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"])';
const pressTypes = ["button", "submit", "reset", "image", "checkbox", "radio", "file"];
let cursor: HTMLElement | null = null;

controls.before(home);

// The docked status is cut short to keep the header on one row, so the full text rides in the tooltip.
const say = (text: string) => { statusLine.textContent = text; statusLine.title = text; };
const openDialog = () => document.querySelector<HTMLDialogElement>("dialog[open]");

function view() {
  const port = visualViewport;
  return { left: port?.offsetLeft ?? 0, top: port?.offsetTop ?? 0, width: port?.width ?? innerWidth, height: port?.height ?? innerHeight };
}

function save() {
  const floating = controls.classList.contains("is-floating");
  const box = controls.getBoundingClientRect();
  try {
    localStorage.setItem(storageKey, JSON.stringify(floating ? { mode: "floating", x: Math.round(box.left), y: Math.round(box.top) } : { mode: "docked" }));
  } catch { /* A private window still works; the pad just forgets where it was. */ }
}

function place(x: number, y: number) {
  const port = view(), box = controls.getBoundingClientRect();
  const left = Math.min(Math.max(x, port.left + margin), Math.max(port.left + margin, port.left + port.width - box.width - margin));
  const top = Math.min(Math.max(y, port.top + margin), Math.max(port.top + margin, port.top + port.height - box.height - margin));
  controls.style.left = `${Math.round(left)}px`;
  controls.style.top = `${Math.round(top)}px`;
}

function setMode(floating: boolean) {
  controls.classList.toggle("is-floating", floating);
  grip.hidden = !floating;
  toggle.setAttribute("aria-label", floating ? "Dock the pad" : "Detach the pad");
  toggle.title = floating ? "Dock the pad" : "Detach the pad";
}

function detach(at?: { x: number; y: number }) {
  // A fixed pane inside a filtered ancestor would be positioned against that ancestor, so it lives on body.
  document.body.append(controls);
  setMode(true);
  controls.style.left = "0px";
  controls.style.top = "0px";
  const box = controls.getBoundingClientRect(), port = view();
  place(at?.x ?? port.left + port.width - box.width - 16, at?.y ?? port.top + port.height - box.height - 16);
}

function dock() {
  setMode(false);
  controls.style.removeProperty("left");
  controls.style.removeProperty("top");
  home.after(controls);
}

function savedPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { mode?: string; x?: unknown; y?: unknown } | null;
    if (saved?.mode === "floating" && typeof saved.x === "number" && typeof saved.y === "number" && Number.isFinite(saved.x) && Number.isFinite(saved.y))
      return { x: saved.x, y: saved.y };
  } catch { /* Bad or blocked storage means docked. */ }
  return null;
}

function restore() {
  const saved = savedPosition();
  if (!saved) return;
  detach(saved);
  const box = controls.getBoundingClientRect(), port = view();
  const inside = saved.x >= port.left && saved.y >= port.top && saved.x + box.width <= port.left + port.width && saved.y + box.height <= port.top + port.height;
  if (!inside) dock();
}

// --- moving the pane -----------------------------------------------------------------------------
let drag: { dx: number; dy: number } | null = null;
grip.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const box = controls.getBoundingClientRect();
  drag = { dx: event.clientX - box.left, dy: event.clientY - box.top };
  grip.setPointerCapture(event.pointerId);
  event.preventDefault();
});
grip.addEventListener("pointermove", (event) => { if (drag) place(event.clientX - drag.dx, event.clientY - drag.dy); });
for (const type of ["pointerup", "pointercancel"]) grip.addEventListener(type, () => { if (drag) { drag = null; save(); } });
grip.addEventListener("keydown", (event) => {
  const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  const box = controls.getBoundingClientRect(), size = event.shiftKey ? bigStep : step;
  place(box.left + move[0] * size, box.top + move[1] * size);
  save();
  say("Pad moved");
});
toggle.addEventListener("click", () => {
  if (controls.classList.contains("is-floating")) dock(); else detach();
  save();
  toggle.focus();
  say(controls.classList.contains("is-floating") ? "Pad detached" : "Pad docked");
});
const keepInside = () => {
  if (!controls.classList.contains("is-floating")) return;
  const box = controls.getBoundingClientRect();
  place(box.left, box.top);
};
window.addEventListener("resize", keepInside);
visualViewport?.addEventListener("resize", keepInside);

// A modal dialog makes the rest of the page inert, pad included, so the pad rides inside it while it is open.
let parked: { floating: boolean; x: number; y: number } | null = null;
function park(dialog: HTMLDialogElement) {
  const box = controls.getBoundingClientRect();
  parked = { floating: controls.classList.contains("is-floating"), x: box.left, y: box.top };
  setMode(false);
  controls.style.removeProperty("left");
  controls.style.removeProperty("top");
  controls.classList.add("in-dialog");
  dialog.append(controls);
}
function unpark() {
  if (!parked) return;
  const before = parked;
  parked = null;
  controls.classList.remove("in-dialog");
  if (before.floating) detach({ x: before.x, y: before.y }); else dock();
}
function followDialog() {
  const dialog = openDialog();
  if (dialog && controls.parentElement === dialog) return;
  unpark();
  if (dialog) park(dialog);
}
new MutationObserver(followDialog).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });

// Focus protection calls this when scrolling cannot clear the pane off the focused control.
export function movePaneAway() {
  const box = controls.getBoundingClientRect(), port = view();
  const inLowerHalf = box.top + box.height / 2 > port.top + port.height / 2;
  place(box.left, inLowerHalf ? port.top + margin : port.top + port.height - box.height - margin);
  save();
}

// --- moving through the app ----------------------------------------------------------------------
document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && !controls.contains(target)) cursor = target;
});
for (const button of controls.querySelectorAll<HTMLElement>("[data-pad],#btnA,#btnB")) {
  // Keep focus where it is: the pad acts on the control you were on, not on itself.
  button.addEventListener("pointerdown", (event) => event.preventDefault());
  button.addEventListener("mousedown", (event) => event.preventDefault());
}

function nameOf(element: HTMLElement) {
  const labelled = element.getAttribute("aria-label") || (element as HTMLInputElement).labels?.[0]?.textContent || element.textContent || element.id;
  return (labelled ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || element.tagName.toLowerCase();
}

function reachable(scope: ParentNode) {
  return [...scope.querySelectorAll<HTMLElement>(focusSelector)].filter((element) =>
    element.tabIndex >= 0 && !controls.contains(element) && !element.matches(":disabled,.skip-link,.sr-only") &&
    !element.closest("[inert],[aria-hidden='true']") && element.checkVisibility());
}

function land(target: HTMLElement) {
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  say(nameOf(target));
}

function moveFocus(direction: 1 | -1) {
  const scope = openDialog() ?? document;
  const list = reachable(scope);
  if (!list.length) return;
  const from = cursor?.isConnected && scope.contains(cursor) ? cursor : null;
  if (!from) return land(direction === 1 ? list[0] : list[list.length - 1]);
  const index = list.indexOf(from);
  if (index >= 0) return land(list[(index + direction + list.length) % list.length]);
  // The cursor is no longer reachable, so continue from where it sat in the page.
  const after = direction === 1 ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
  const near = (direction === 1 ? list : [...list].reverse()).find((element) => from.compareDocumentPosition(element) & after);
  land(near ?? (direction === 1 ? list[0] : list[list.length - 1]));
}

function moveTab(direction: 1 | -1) {
  if (openDialog()) return;
  const tabs = [...document.querySelectorAll<HTMLElement>('#app-nav [role="tab"]')];
  const index = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  const next = tabs[(index + direction + tabs.length) % tabs.length];
  next.click();
  next.focus({ preventScroll: true });
  say(`Tab: ${nameOf(next)}`);
}

function press() {
  const target = cursor?.isConnected ? cursor : null;
  if (!target) return say("Nothing selected");
  const typing = target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && !pressTypes.includes(target.type));
  if (target instanceof HTMLSelectElement) {
    try { target.showPicker(); } catch { target.focus(); }
  } else if (typing) target.focus();
  else target.click();
  say(`Pressed ${nameOf(target)}`);
}

function goBack() {
  const dialog = openDialog();
  if (dialog) {
    // Same path as Escape, so a dialog that vetoes its own cancel still can.
    if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
    return say("Closed");
  }
  const tab = document.querySelector<HTMLElement>('#app-nav [aria-selected="true"]');
  if (tab) land(tab);
}

const actions: Record<string, () => void> = {
  up: () => moveFocus(-1), down: () => moveFocus(1), left: () => moveTab(-1), right: () => moveTab(1)
};
for (const button of controls.querySelectorAll<HTMLButtonElement>("[data-pad]"))
  button.addEventListener("click", () => actions[button.dataset.pad!]());
document.getElementById("btnA")!.addEventListener("click", press);
document.getElementById("btnB")!.addEventListener("click", goBack);

restore();
followDialog();
