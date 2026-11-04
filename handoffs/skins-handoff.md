TASK HANDOFF: OneDime, two new visual skins
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local).
Authorized: create branch skins-two-themes from main, commit and push, open a PR.
NOT authorized: merge, deploy, public repo, live PayPal, any change to financial or game logic.

CONSTRAINT
  The current app already uses the Game Boy green palette (#9BBC0F, #8BAC0F, #306230, #0F380F).
  Do NOT use those greens or the burgundy A/B accents in either new skin. Keep the current theme
  unchanged; the new skins are additions, not replacements. Confirm in the PR that the existing
  theme is preserved and selectable.

STEP 0 (REQUIRED BEFORE ANY EDIT)
  Audit and report in the PR description:
  - Where styles and theme variables live.
  - Existing theme mechanism (prefers-color-scheme, data-theme, or none).
  - Every hardcoded color in use today.
  - Whether a controller bar (D-pad, A, B) exists and where it renders.
  If the repo differs substantially from this handoff, STOP and wait for Claude.

SKINS
  Selected by a data attribute on the root element, e.g. <html data-skin="paper" data-theme="dark">.
  Skin choices in Settings > Appearance: Current (existing theme), Paper, Slate.
  Default stays as the current theme. Theme follows the OS unless the user overrides it.

  PAPER (neutral, blue accent)
    Light: surface #F7F5EF, panels #FFFFFF, text #1B2430, secondary text #4A5563,
           action #1E4D8C (white text), border #C9C4B6, focus #1E4D8C
    Dark:  surface #141A24, panels #1C2432, text #E8ECF2, secondary text #AEB7C4,
           action #7FA8E0 (text #0B1220), border #39445A, focus #A9C8F2

  SLATE (dark-first, amber accent)
    Light: surface #E9ECEF, panels #FFFFFF, text #14181D, secondary text #3F4A55,
           action #8A5A00 (white text), border #BFC6CE, focus #8A5A00
    Dark:  surface #111315, panels #1B1F23, text #ECEEF0, secondary text #B4BAC1,
           action #F2B33D (text #1A1200), border #3C434B, focus #F2B33D

  Token values are proposals. Adjust only to pass contrast, and list every change in the PR.

RULES
  - Components reference tokens only. No hardcoded colors in component files.
  - Skin selection changes only the token set. No reload, no data change.
  - Persist the skin preference where the app already stores preferences. Never store
    financial data in local storage or preferences.
  - prefers-reduced-motion: disable the XP bar fill and stamp animations.
  - No new runtime dependencies. No remote web fonts. Use bundled files or system stacks.
  - Any controller bar must not cover focused content (scroll padding).
  - No new controller behavior. Copy unchanged except the new Appearance labels.

ACCESSIBILITY (WCAG 2.2 AA, verified by script)
  - Normal text 4.5:1; large text, essential icons, and focus indicators 3:1.
  - Check every text and control pair in every skin, in light and dark.
  - Status colors (Verified, Unverified, Mismatch, Late, Paid, Pending) always pair with a
    text label and an icon.
  - Focus visible in all skin and theme combinations.
  - Save the contrast table to docs/skins-contrast.md.

TESTS
  - Visual or snapshot tests for each skin, light and dark, at 375px and 1280px.
  - CI check that fails on hardcoded colors outside the token files.
  - Test that the skin preference persists across reload.
  - Existing tests pass unchanged. Do not edit financial, game, or import tests.

SCREENSHOTS
  Home, Work, Payments, and Progress in each skin at 375px, dark mode included.
  Save under docs/screenshots/skins/.

DO NOT TOUCH
  Financial calculations, import parsing, matching, XP rules, milestones, quests, rested XP,
  authentication, sessions, database schema, migrations, API contracts. Nothing deployed.

OPEN QUESTIONS (report in the PR, do not guess)
  - Is there an existing theme toggle? If so, merge it into Settings > Appearance.
  - Any component that cannot be tokenized without changing its layout: list it, do not fix it.

DESIRED OUTPUT
  PR into main, NOT merged, with: audit, token tables, contrast table, screenshots,
  test results, and open questions.

FALLBACK
  If a file this handoff names is missing, complete what exists, list what is missing, and
  stop before inventing structure.
