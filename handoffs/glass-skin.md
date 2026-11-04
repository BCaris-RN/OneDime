TASK HANDOFF: Glass skin (new default look of the web app)
Owner: Claude Code. Start AFTER PR #12 (Paper/Slate skins) merges; branch glass-skin from main. One PR.
Spec: the Glass skin in reference/pilot.html (now the pilot's default). Port it exactly:
- Tokens: the [data-skin="glass"] block (dark by design; Mode setting doesn't lighten it; say so in
  Settings: "Glass - frosted, dark by design"). Glass becomes the default; Current, Paper, Slate stay
  selectable. Saved choices are respected.
- Backdrop: quiet nebula gradients (no images). Frosted panels: translucent panel color +
  backdrop-filter blur(18px) saturate(140%), 1px light border, 18px radius, soft shadow.
- One accent per tab via html[data-tab]: First Dime gold #E8B54A, Spotlight rose #E2558C,
  Freelance periwinkle #8F8CFF, Market teal #3CC6B4, PayPal: use #5BA8FF, Stats lime #9BBC0F,
  Vault amber #F2C35B. Accent drives the selected tab, focus ring on inputs, progress bars, shapes.
- Abstract shapes per tab (inline SVG, fixed behind content, 2-3 per tab, opacity .4-.6, gentle
  enter transition): coin ring (First Dime), triangle + ring (Spotlight), wireframe cube + hexagon
  (Freelance), rounded squares + ring (Market), arcs + bars (Stats), concentric vault squares + dot
  grid (Vault), and for PayPal two overlapping rings. Gradient defs defined once.
- Type system (dashboard style): small uppercase tracked labels (.7rem, .09em), big numbers in
  JetBrains Mono with tabular figures, headings in Atkinson Hyperlegible 700/800.
- Buttons: 10px radius, burgundy gradient (#C2306A -> #8B1D45), white text. Ghost buttons translucent.
- prefers-reduced-transparency: solid panels and no shapes. prefers-reduced-motion: no transitions.
TESTS: contrast for every text style over the panel color composited on the brightest shape behind it
(4.5:1 text, 3:1 boundaries/focus), every tab at 320/390/1440 with no overflow, reduced
transparency/motion modes, Settings switching among all four skins without reload.
PR with screenshots of every tab at 390 and 1440; 5-line summary for Claude. Never merge or deploy.
