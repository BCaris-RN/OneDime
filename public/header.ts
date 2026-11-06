/*  (o) OneDime | public/header.ts
 *  ----------------------------------------------------------
 *  Keep account controls beside the player name on desktop and inside Menu on phones.
 */
const compact = matchMedia("(max-width:520px)");
const playerStrip = document.getElementById("player-strip")!;
const menu = document.getElementById("header-menu") as HTMLDetailsElement;
const menuItems = document.getElementById("header-menu-items")!;
const xpChip = document.getElementById("xp-chip")!;
const feedback = menuItems.querySelector("[data-feedback-open]")!;
const accountItems = ["player-name", "theme-toggle", "appearance-open", "sound-open", "logout"]
  .map(id => document.getElementById(id)!);

function placeAccountItems() {
  if (compact.matches) {
    for (const item of accountItems) menuItems.insertBefore(item, feedback);
    playerStrip.classList.add("is-compact");
    return;
  }
  menu.open = false;
  playerStrip.insertBefore(accountItems[0], xpChip);
  for (const item of accountItems.slice(1)) playerStrip.insertBefore(item, menu);
  playerStrip.classList.remove("is-compact");
}

placeAccountItems();
compact.addEventListener("change", placeAccountItems);
