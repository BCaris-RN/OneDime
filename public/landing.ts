const CONFIG = {
  LOGIN_URL: "/auth/paypal/start",
  PRIVACY: "https://sites.google.com/view/onedime-privacy-policy/home",
  TERMS: "https://sites.google.com/view/onedime-user-agreement/home",
  CONTACT: "caris.industries@gmail.com"
} as const;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, reduce ? 0 : ms));
const stamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const say = (text: string) => { byId("announce").textContent = text; };

const stars: string[] = [];
const starCount = window.innerWidth < 600 ? 140 : 260;
for (let i = 0; i < starCount; i += 1) {
  const x = Math.random() * 200, y = Math.random() * 200, alpha = (Math.random() * .7 + .3).toFixed(2);
  const size = Math.random() < .08 ? 2 : 1;
  stars.push(`${x}vw ${y}vh 0 ${size - 1}px rgba(255,255,255,${alpha})`);
}
byId("stars").style.boxShadow = stars.join(",");

const FONT: Record<string, string[]> = {
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"]
};
function coinHtml() {
  const cells: [number, number][] = []; let x = 0;
  for (const character of "ONE DIME") {
    if (character === " ") { x += 3; continue; }
    FONT[character].forEach((row, y) => [...row].forEach((cell, dx) => { if (cell === "#") cells.push([x + dx, y]); }));
    x += 6;
  }
  const width = x - 1, offsetX = 30 - width / 2, offsetY = 11.5;
  let side = "", deep = "", top = "", highlight = "";
  cells.sort((a, b) => a[0] - b[0]).forEach(([cellX, cellY]) => {
    const X = offsetX + cellX, Y = offsetY + cellY, style = `style="--i:${cellX}"`;
    deep += `<rect class="px px-deep" ${style} x="${X + .9}" y="${Y + .9}" width="1" height="1"/>`;
    side += `<rect class="px px-side" ${style} x="${X + .45}" y="${Y + .45}" width="1" height="1"/>`;
    highlight += `<rect class="px px-hi" ${style} x="${X - .22}" y="${Y - .22}" width="1" height="1"/>`;
    top += `<rect class="px px-top" ${style} x="${X}" y="${Y}" width="1" height="1"/>`;
  });
  const band = (cx: number, cy: number, rx: number, ry: number, thickness: number) => `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${2 * rx},0a${rx},${ry} 0 1,0 ${-2 * rx},0zM${cx - rx + thickness},${cy}a${rx - thickness},${ry - thickness} 0 1,1 ${2 * (rx - thickness)},0a${rx - thickness},${ry - thickness} 0 1,1 ${-2 * (rx - thickness)},0z`;
  return `<svg viewBox="-2 -2 64 36" role="img" aria-label="OneDime"><g transform="skewX(-14) translate(4.2 0)"><g class="rim"><path class="rim-side" fill-rule="evenodd" d="${band(30.6,16.9,29,14.2,2.6)}"/><path class="rim-top" fill-rule="evenodd" d="${band(30,15,29,14.2,2.6)}"/><ellipse class="rim-hi" cx="29.6" cy="14.6" rx="28.6" ry="13.8" stroke-dasharray="20 6 9 70"/><ellipse class="reed" cx="30" cy="15" rx="25.6" ry="11.2"/></g>${deep}${side}${highlight}${top}<text class="cents px" style="--i:60" x="30.5" y="22.6" text-anchor="middle">¢10 · REAL WORK</text></g></svg>`;
}
byId("bootcoin").innerHTML = coinHtml(); byId("homecoin").innerHTML = coinHtml();

type Screen = "boot" | "home" | "tour" | "info" | "detail" | "go" | "go-demo" | "go-done";
let screen: Screen = "boot", tourIndex = 0, infoIndex = 0, busy = false;
const screens: Screen[] = ["boot", "home", "tour", "info", "detail", "go"];
function show(name: Screen, announcement?: string) {
  screens.forEach(item => { byId(`s-${item}`).hidden = item !== name; });
  screen = name; if (announcement) say(announcement);
  if (!reduce) { const scan = byId("scan"); scan.classList.remove("go"); void scan.offsetWidth; scan.classList.add("go"); }
}
const pixel = (rows: string[]) => rows.map((row, y) => [...row].map((cell, x) => cell === "#" ? `<rect class="k" x="${x}" y="${y}" width="1" height="1"/>` : cell === "+" ? `<rect class="m" x="${x}" y="${y}" width="1" height="1"/>` : "").join("")).join("");
const art: Record<string, string[]> = {
  dime: ["....####....", "..##++++##..", ".#++####++#.", "#++#....#++#", "#+#..##..#+#", "#+#.#..#.#+#", "#+#.#..#.#+#", "#+#..##..#+#", "#++#....#++#", ".#++####++#.", "..##++++##..", "....####...."],
  apps: ["############", "#..#..#..#.#", "#..#..#..#.#", "############", "#..#..#..#.#", "#..#..#..#.#", "############", "............", "##.##.##.##.", "##.##.##.##.", "............", "............"],
  pp: ["..#######...", "..#.....#...", "..#.###.#...", "..#.....#...", "..#.###.#...", "..#.....#...", "..#######...", "...........#", "........###.", "....##.##...", "...#..#.....", "....##......"],
  rank: ["......#.....", ".....###....", "....#####...", "......#.....", "..#...#...#.", ".###..#..###", "#####.#.#####", "..#...#...#.", "..#...#...#.", "############", "#++++++++++#", "############"],
  stats: ["#...........", "#.........##", "#.........##", "#.....##..##", "#.....##..##", "#..##.##..##", "#..##.##..##", "#..##.##..##", "############", "............", "+.+.+.+.+.+.", "............"]
};
const tour = [
  ["dime", "EARN YOUR FIRST DIME", "Start with starter gigs. Log the minutes, log the pay. $0.10 is the first rung."],
  ["apps", "FIVE APPS, ONE LEDGER", "First Dime, Spotlight, Freelance and Market keep every income stream in its own lane."],
  ["pp", "MATCHED TO PAYPAL", "Import your own PayPal activity file. Entries that match it count. Nothing else does."],
  ["rank", "RANKS FOR REAL WORK", "Creator, Freelancer, Driver, Seller. Every rank is earned with matched pay, never bought."],
  ["stats", "SEE WHAT PAYS", "Real hourly rate by platform. Know where your time is worth the most."]
] as const;
function renderTour() { const current = tour[tourIndex]; byId("s-tour").innerHTML = `<div class="slide pop" style="display:grid;gap:.6em"><svg class="pixart" viewBox="0 0 12 12" aria-hidden="true">${pixel(art[current[0]])}</svg><h2>${current[1]}</h2><p>${current[2]}</p></div><div class="dots" aria-hidden="true">${tour.map((_, i) => `<i class="${i === tourIndex ? "on" : ""}"></i>`).join("")}</div><div class="legend" aria-hidden="true"><span>◀ ▶ page</span><span>START log in</span><span>B back</span></div>`; say(`Tour ${tourIndex + 1} of ${tour.length}. ${current[1]}. ${current[2]}`); }
const info = [{ text: "CONTACT", kind: "contact" }, { text: "PRIVACY STATEMENT", kind: "link", href: CONFIG.PRIVACY }, { text: "USER AGREEMENT", kind: "link", href: CONFIG.TERMS }, { text: "AFFILIATES", kind: "soon" }, { text: "CAREERS", kind: "soon" }, { text: "MERCH", kind: "soon" }] as const;
function renderInfo() { byId("infomenu").innerHTML = info.map((item, index) => `<li aria-current="${index === infoIndex}">${index === infoIndex ? "<span aria-hidden=\"true\">▶</span>" : "<span aria-hidden=\"true\">&nbsp;</span>"}${item.text}${item.kind === "soon" ? '<span class="k">SOON</span>' : item.kind === "link" ? '<span class="k">OPENS</span>' : ""}</li>`).join(""); say(`${info[infoIndex].text}${info[infoIndex].kind === "soon" ? ", under construction" : ""}`); }
function openInfo() { const item = info[infoIndex]; if (item.kind === "link") { window.open(item.href, "_blank", "noopener"); say(`${item.text} opened in a new tab`); return; } if (item.kind === "contact") { byId("s-detail").innerHTML = `<h2>CONTACT</h2><svg class="pixart" viewBox="0 0 12 12" aria-hidden="true">${pixel(["............", "############", "##........##", "#.#......#.#", "#..#....#..#", "#...#..#...#", "#....##....#", "#..........#", "############", "............", "............", "............"])}</svg><p class="sub">Questions, ideas or partnerships:</p><p class="tag"><a href="mailto:${CONFIG.CONTACT}">${CONFIG.CONTACT}</a></p><div class="legend" aria-hidden="true"><span>A send email</span><span>B back</span></div>`; show("detail", `Contact. ${CONFIG.CONTACT}. Press A to email.`); return; } byId("s-detail").innerHTML = `<h2>${item.text}</h2><svg class="pixart uc-cone" viewBox="0 0 12 12" aria-hidden="true">${pixel(["......#.....", ".....###....", ".....+++....", "....#####...", "....+++++...", "...#######..", "...+++++++..", "..#########.", "..+++++++++.", ".###########", "############", "............"])}</svg><p class="tag">UNDER CONSTRUCTION</p><p class="sub">This part of the ledger is still being built.</p><div class="legend" aria-hidden="true"><span>B back</span></div>`; show("detail", `${item.text}. Under construction.`); }
async function typeLog(list: HTMLElement, lines: string[], gap = 260) { for (const line of lines) { if (screen === "home") return; const item = document.createElement("li"); item.innerHTML = `<time>${stamp()}</time>${line}`; list.append(item); await wait(gap); } }
async function boot() { show("boot"); say("Booting OneDime"); await typeLog(byId("bootlog"), ["<b>Incoming player detected</b> ...", "Waking up the ledger ..."]); byId("bootcoin").classList.add("building"); await wait(1500); await typeLog(byId("bootlog2"), ["Counting dimes ...", "PayPal sandbox link ready ...", "<b>Press start</b>"], 300); await wait(500); if (screen === "boot") home(); }
function home() { show("home", "Home. Press Start to log in with PayPal, left for the tour, down for info."); }
async function login() { if (busy) return; busy = true; show("go", "Opening PayPal"); byId("golog").innerHTML = ""; byId("gonote").textContent = ""; byId("gobar").innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="animation-delay:${reduce ? 0 : i * 90}ms"></i>`).join(""); await typeLog(byId("golog"), ["Login requested ...", "Opening PayPal sandbox ...", "Secure handoff ready ..."], 320); window.location.assign(CONFIG.LOGIN_URL); }
function press(key: string) {
  if (screen === "boot") { home(); return; } if (busy) return;
  if (key === "up" || key === "select") { if (screen === "info" && key === "up" && infoIndex > 0) { infoIndex -= 1; renderInfo(); return; } home(); return; }
  if (key === "start") { void login(); return; }
  switch (screen) {
    case "home": if (key === "left") { tourIndex = 0; renderTour(); show("tour"); } else if (key === "down") { infoIndex = 0; renderInfo(); show("info"); } else if (key === "a") void login(); break;
    case "tour": if (key === "right") { tourIndex = Math.min(tour.length - 1, tourIndex + 1); renderTour(); } else if (key === "left") { tourIndex = Math.max(0, tourIndex - 1); renderTour(); } else if (key === "b") home(); else if (key === "down") { infoIndex = 0; renderInfo(); show("info"); } else if (key === "a" && tourIndex === tour.length - 1) void login(); else if (key === "a") { tourIndex += 1; renderTour(); } break;
    case "info": if (key === "down") { infoIndex = Math.min(info.length - 1, infoIndex + 1); renderInfo(); } else if (key === "a") openInfo(); else if (key === "b" || key === "left") home(); break;
    case "detail": if (key === "b") show("info", info[infoIndex].text); else if (key === "a" && info[infoIndex].kind === "contact") window.location.assign(`mailto:${CONFIG.CONTACT}`); break;
  }
}
document.querySelectorAll<HTMLButtonElement>(".device [data-k]").forEach(button => button.addEventListener("click", () => press(button.dataset.k ?? "")));
const keys: Record<string, string> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Enter: "a", z: "a", Z: "a", Backspace: "b", Escape: "b", x: "b", X: "b", " ": "start", Shift: "select" };
window.addEventListener("keydown", event => { const key = keys[event.key]; if (!key) return; const target = event.target as HTMLElement; if (target.matches("input,textarea,select,a,[contenteditable]") || (target.tagName === "BUTTON" && (event.key === "Enter" || event.key === " "))) return; event.preventDefault(); const button = document.querySelector<HTMLButtonElement>(`.device [data-k="${key}"]`); button?.classList.add("press"); window.setTimeout(() => button?.classList.remove("press"), 120); press(key); });
document.querySelectorAll<HTMLAnchorElement>("[data-login]").forEach(link => link.href = CONFIG.LOGIN_URL);
void boot();
