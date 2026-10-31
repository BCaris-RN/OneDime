TASK HANDOFF: OneDime landing console (login page + post-login boot)
Operator: Brandon. Lead/design: Claude (chat). Implementer: Claude Code (cloud). Reviewer pass: Codex.
Spec: reference/landing-console.html (Claude's working prototype; open it and play with it first).
Read AGENTS.md and docs/SDLC.md. Branch landing-console from main. One PR. Never merge or deploy.

PORT EXACTLY (layout, colors, motion, copy, controls) into the app's public landing page:
- Original handheld console (NOT a copy of any game company's device; no Nintendo/Game Boy names,
  logos or text anywhere). Shell, bezel "LEDGER SCREEN", plate "OneDime ¢10", D-pad, A/B, SELECT/START,
  coin-shaped speaker grille.
- Backdrop: the prototype's ORIGINAL CSS multiverse (nebula, gold portal rings, stars, clouds). Do NOT
  use any stock image (the Adobe Stock picture Brandon shared is licensed/watermarked).
- LCD screens: boot log (timestamped, Render-style CLI) -> raised slanted pixel "ONE DIME" coin logo
  builds -> home. Home = login: START or A logs in. LEFT = tour (5 slides, LEFT/RIGHT page).
  DOWN = info list (Contact, Privacy, User agreement, Affiliates/Careers/Merch = under construction).
  UP or SELECT = home. B = back. Any button skips the boot.
- Login has NO fields: PayPal handles the password. START/A go to /auth/paypal/start after the
  "Opening PayPal sandbox" log lines (~1s). Keep the line "PayPal checks your password. OneDime never sees it."
- After login: show the post-login boot ("Session established ... Welcome back, player") once per
  session as an overlay on /app, max 2.5s, skippable by any key/tap, then the normal app.
  (Phase 5 first-run welcome still shows after it for new players.)
- Keyboard: arrows = D-pad, Enter/Z = A, Backspace/Escape/X = B, Space = Start, Shift = Select.
  Ignore keys while focus is in a real input/link.
- Plain links under the device (Log in with PayPal, Privacy, User agreement, Contact) and a
  "Skip the console" link: the page must work with no console interaction at all.
- Accessibility: real buttons with aria-labels, aria-live announcements per screen, visible focus,
  prefers-reduced-motion = no typing/building/rotation (instant screens), 44px+ touch targets.
- App constraints: self-hosted fonts (Fontsource, no Google Fonts request), CSP-compliant (move
  inline JS to public/landing.ts and the boot overlay to public/app.ts; no inline handlers),
  CONFIG.LOGIN_URL = "/auth/paypal/start", contact caris.industries@gmail.com, links to the
  Google Sites policies.
- Keep the current beta-page (allowlist) and /health untouched.

TESTS: Playwright at 320, 390, 1280 and 1440 wide: no horizontal overflow; every control works by
click and by keyboard; reduced motion shows screens instantly; plain links work with JS disabled;
login START navigates to /auth/paypal/start; post-login boot shows once per session and is
skippable; contrast checks pass for LCD text (lcd-4 on lcd-2) and the plain links on the backdrop.
Screenshots of every screen at 390 and 1440 in the PR. Then a 5-line summary for Claude.
