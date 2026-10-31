// Glass skin: one accent per app tab and the abstract shapes behind it, ported from the pilot.
const DEFS = `<svg width="0" height="0" style="position:absolute"><defs>`
  + `<linearGradient id="glass-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2)"/></linearGradient>`
  + `<linearGradient id="glass-b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.9"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.05"/></linearGradient>`
  + `</defs></svg>`;
const shape = (position: string, viewBox: string, body: string, opacity = .55) =>
  `<svg viewBox="${viewBox}" style="${position};opacity:${opacity}" class="in">${body}</svg>`;
const ring = (radius: number, width: number) => `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="url(#glass-a)" stroke-width="${width}"/>`;
const dots = [...Array(25)].map((_, i) => `<circle cx="${10 + (i % 5) * 20}" cy="${10 + Math.floor(i / 5) * 20}" r="4" fill="url(#glass-b)"/>`).join("");

const SHAPES: Record<string, string[]> = {
  first: [
    shape("width:42vmin;right:-9vmin;top:9vh", "0 0 100 100", ring(38, 12)),
    shape("width:16vmin;left:-5vmin;bottom:16vh", "0 0 100 100", `<circle cx="50" cy="50" r="48" fill="url(#glass-a)"/>`, .45),
    shape("width:3.2vmin;left:30vw;top:13vh", "0 0 10 10", `<circle cx="5" cy="5" r="5" fill="url(#glass-b)"/>`, .6)
  ],
  spotlight: [
    shape("width:40vmin;left:-10vmin;top:12vh", "0 0 100 100", `<polygon points="50,6 96,90 4,90" fill="url(#glass-b)"/>`, .45),
    shape("width:26vmin;right:-6vmin;bottom:14vh", "0 0 100 100", ring(40, 10)),
    shape("width:3vmin;right:24vw;top:16vh", "0 0 10 10", `<circle cx="5" cy="5" r="5" fill="url(#glass-a)"/>`, .6)
  ],
  freelance: [
    shape("width:40vmin;right:-8vmin;top:14vh", "0 0 100 100", `<g fill="none" stroke="url(#glass-a)" stroke-width="3" stroke-linejoin="round"><path d="M50 8 88 30v42L50 94 12 72V30z"/><path d="M12 30 50 52 88 30M50 52v42"/></g><circle cx="50" cy="52" r="10" fill="url(#glass-a)" opacity=".8"/>`, .6),
    shape("width:22vmin;left:-6vmin;bottom:12vh", "0 0 100 100", `<path d="M50 6 88 28v44L50 94 12 72V28z" fill="url(#glass-b)"/>`, .4)
  ],
  market: [
    shape("width:30vmin;right:-4vmin;top:10vh;transform:rotate(16deg)", "0 0 100 100", `<rect x="8" y="8" width="84" height="84" rx="18" fill="url(#glass-b)"/>`, .45),
    shape("width:22vmin;right:14vmin;top:30vh;transform:rotate(-8deg)", "0 0 100 100", `<rect x="10" y="10" width="80" height="80" rx="16" fill="none" stroke="url(#glass-a)" stroke-width="5"/>`),
    shape("width:24vmin;left:-7vmin;bottom:10vh", "0 0 100 100", ring(38, 12), .45)
  ],
  stats: [
    shape("width:34vmin;right:-4vmin;bottom:8vh", "0 0 100 100", `<rect x="6" y="52" width="22" height="44" rx="6" fill="url(#glass-b)"/><rect x="39" y="30" width="22" height="66" rx="6" fill="url(#glass-a)"/><rect x="72" y="8" width="22" height="88" rx="6" fill="url(#glass-b)"/>`, .5),
    shape("width:38vmin;left:-14vmin;top:8vh", "0 0 100 100", `<path d="M8 92A84 84 0 0 1 92 8" fill="none" stroke="url(#glass-a)" stroke-width="9" stroke-linecap="round"/><path d="M30 92A62 62 0 0 1 92 30" fill="none" stroke="url(#glass-a)" stroke-width="4" stroke-linecap="round" opacity=".6"/>`)
  ],
  vault: [
    shape("width:40vmin;right:-10vmin;top:10vh", "0 0 100 100", `<g fill="none" stroke="url(#glass-a)"><rect x="6" y="6" width="88" height="88" rx="16" stroke-width="5"/><rect x="20" y="20" width="60" height="60" rx="12" stroke-width="3" opacity=".7"/><rect x="33" y="33" width="34" height="34" rx="8" stroke-width="2" opacity=".5"/></g><circle cx="50" cy="50" r="6" fill="url(#glass-a)"/>`),
    shape("width:20vmin;left:-2vmin;bottom:14vh", "0 0 100 100", dots, .5)
  ],
  paypal: [
    shape("width:36vmin;right:-8vmin;top:12vh", "0 0 100 100", ring(40, 10)),
    shape("width:36vmin;right:6vmin;top:20vh", "0 0 100 100", ring(40, 10), .4)
  ]
};

function showShapes(app: string) {
  const tab = app in SHAPES ? app : "first";
  document.documentElement.dataset.tab = tab;
  const layer = document.getElementById("glass-shapes");
  if (!layer) return;
  layer.innerHTML = DEFS + SHAPES[tab].join("");
  // Two frames so the starting transform paints before the enter transition runs.
  requestAnimationFrame(() => requestAnimationFrame(() => layer.querySelectorAll("svg.in").forEach(svg => svg.classList.remove("in"))));
}

showShapes(document.querySelector<HTMLElement>("#app-nav [aria-selected='true']")?.dataset.app ?? "first");
document.addEventListener("onedime:app", event => showShapes((event as CustomEvent<string>).detail));
