# Current contrast review evidence

Prepared October 20, 2026 (Hawaii). Claude review is pending. Brandon decides whether to merge.

## Scope and baseline

Worktree: `G:\one_dime`. Branch: `fix-current-contrast`. Base:
`ab7bc89bf12134b8c0d5015c64298ac44021ac49` (`main`, merged PR #5).
Runtime color source commit: `f6734602339372431b9b1609abab0ee56976cf6e`.
The only changed application file is `public/styles.css`. Its changes are color values,
color tokens, and selectors applying those colors. Financial, import, game, auth, session,
API, schema, migration, layout, copy, and behavior code is unchanged.

The immutable [before stylesheet](current-before.css) was captured before application
colors changed. Both reports and screenshot sets use the same current audit program,
with `--before` intercepting the stylesheet request to serve that snapshot. The later
native-checkbox measurement correction was applied equally to both report runs.

Main's UI is five workspaces: First Dime, Spotlight, Freelance, Market, and PayPal.
Settings is generated within PayPal. The existing theme toggle persists `onedime-theme`
and resolves OS preference at startup. The controller is in the header on desktop and
fixed at the bottom on narrow screens. These mechanisms are unchanged.
The earlier phase/status discrepancies are recorded in
[the approved direct-instruction brief](../../handoffs/fix-current-contrast.md).

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline contrast | Expected exit 1: 236 semantic/color pairs, 24 failing, 1 uncovered | [Before table](current-before.md), [run log](before.log) |
| Current contrast | Exit 0: 227 semantic/color pairs, 0 failing, 0 uncovered | [After table](current-after.md), [run log](after.log) |
| Write-free CI command | `npm run test:contrast` passed: 16 regression groups, 0 failing/uncovered pairs | [Check-only log](check-only.log) |
| Focused harness regressions | 16 check groups passed | `scripts/check-current-contrast-regressions.ts` |
| Existing tests | 185 passed across 8 files | Unchanged `npm test`; disposable PostgreSQL, `DATABASE_URL` unset |
| Build | Passed | [Build log](build.log) |
| Strict contrast TypeScript | Passed | [Type-check log](typecheck.log) |
| Existing browser suite | Passed: 3,912 Tab steps; all apps/sub-tabs, inference/privacy/cache checks | [Browser log](browser.log) |
| CSS scope proof | 16 changed declarations; all color properties/tokens | [Machine-readable proof](color-only-proof.json) |
| Minimum candidates | Six fixed-hue/saturation paths and selection alpha passed | [Candidate proof](minimal-candidates.json) |

Both tables record identical runner/scanner SHA-256 hashes. The final runner explicitly
establishes and asserts keyboard `:focus-visible` for each representative control before
measuring focus, which adds two measured pairs to earlier draft tables.
The exact [69-file change manifest](changed-files.json) lists every included path,
including the 44 screenshots. The two preserved unrelated untracked files are excluded.

The baseline's uncovered row is deliberate: Chromium conceals visited-link colors from
`getComputedStyle`, and the old CSS has no unconditional author color for ordinary links.
The current stylesheet explicitly colors links, and the audit verifies the cascade has
no separate visited-color override. A privacy-restricted unknown is never counted as a pass.

The reports are contrast checks, not a claim that every WCAG 2.2 criterion or every browser
has been certified. They record Chromium 156.0.8078.4. Physical-device and assistive-technology
review remains useful; Claude has not reviewed or approved this PR yet.

## Color changes and measured candidates

Ratios use unrounded relative luminance. The candidate search fixes the original HSL hue
and saturation, moves lightness monotonically in increments of 0.00001, and rounds the
result to 8-bit RGB. It selects the first passing quantized candidate along that path.
This is an explicit reproducible constraint, not a claim of globally smallest perceptual
distance across arbitrary colors. Selection retains the existing green and uses a 0.01
alpha grid. The source for this calculation is
`scripts/measure-current-contrast-candidates.ts`.

| Declaration/token and surface | Old | New | Required | New ratio | Adjacent failing candidate and ratio |
| --- | --- | --- | ---: | ---: | --- |
| Dark `--error` text on shell | `#8B0000` | `#FF7A7A` | 4.5 | 4.504774 | `#FF7979`: 4.475635 |
| Light `--link` text on card | UA `#0000EE` | `#0000E6` | 4.5 | 4.519237 | `#0000E7`: 4.495591 |
| Dark `--link` text on card | OS-dark UA `#9E9EFF` | `#ADADFF` | 4.5 | 4.512111 | `#ACACFF`: 4.468250 |
| Dark selected tab underline/frame on shell | `#8B1D45` | `#DB5283` | 3 | 3.004325 | `#DB5183`: 2.988105 |
| Light ghost-button pressed fill with existing white 20% overlay | `#5E1230` | `#D6296D` | 4.5 | 4.507171 | `#D5296D`: 4.487363 |
| OS-dark native calendar/month icon backdrop | `#8BAC0F` | `#82A00E` | 3 | 3.006947 | `#82A10E`: 2.977265 |
| Selection green opacity on darkest selectable surface | 0.47 | 0.93 | 4.5 | 4.559499 | 0.92: 4.495376 |

The new `--selected-border` alias remains `var(--btn)` in light mode; only its dark override
changes the selected state. Ordinary and visited/pressed link colors now share explicit
theme-specific values, covering OS/explicit-theme mismatches as well as normal modes.
The native icon backdrop follows the actual OS scheme because Chromium's native glyph
does. The four LCD tokens and normal burgundy button fills remain unchanged.
Dark-error card colors were not invented: the actual error message appears on the shell.

## Coverage and exemptions

The scanner walks rendered text, text-field values and placeholders, resolves ancestor
backgrounds, composites selection and button overlays before luminance, and rejects
unsupported painted backgrounds rather than silently accepting them. It exercises focus,
hover without keyboard focus, pressed states, selected tabs, and test-only invalid/error/toast
fixtures. It scans populated and empty players, all five workspaces and existing sub-tabs,
the landing page, and both policy pages. Explicit light and dark each run against both OS
schemes. The screenshot runs additionally inspect 375px and 1280px viewport widths.

The minimum comparison happens before rounding. Math reference checks include black/white
21:1, `#777777`/white 4.478089453577214:1, and 50% alpha compositing. Native glyphs are sampled
from solid pixel cores and their adjacent backdrop; antialiased edge colors and whole-input
dominant colors cannot replace the actual glyph backdrop.

Every reported exemption has a reason and is separate from a pass. Text-labeled button
borders and decorative card/table/ring/controller edges are measured without forcing color
changes to optional frames. Required selected-tab indicators, focus outlines, and identifying
input surfaces remain checked at 3:1. Disabled controls are classified as inactive.

Unchecked native checkbox borders use flat edge midpoints and the fill center, avoiding
rounded corners that show the outside card. The UA appearance exemption is guarded by an
actual same-position `all:revert` reference render. Core pixels must match; only a one-channel
raster difference in the 3px rounded corner areas is tolerated. An authored `appearance`
mutation fails coverage in the regression suite. The checked state's authored burgundy
accent and white checkmark are tested separately at 8.900290:1; that visible icon identifies
the control/state, so an additional outer frame is optional.

## Commands

Use Node 24. On this Windows machine the validated executable is
`C:\Users\bwcar\AppData\Local\OpenAI\Codex\bin\node.exe`. The system npm wrapper otherwise
selects Node 22, so verification used Node 24 directly with npm's `npm-cli.js` and the local
Node 24 npm/npx PATH shims. No dependency versions changed.

```text
npm run build
npm test
npm run typecheck:contrast
npm run test:contrast:regressions
npx tsx scripts/check-current-contrast.ts --before --report docs/contrast/current-before.md --screenshots docs/screenshots/current-contrast/before
npx tsx scripts/check-current-contrast.ts --report docs/contrast/current-after.md --screenshots docs/screenshots/current-contrast/after
npx tsx scripts/prove-current-contrast-scope.ts
npx tsx scripts/measure-current-contrast-candidates.ts
npm run test:browser
npm run test:contrast
```

The first contrast command intentionally returns 1. `npm run test:contrast` runs the focused
regressions followed by a write-free current audit; CI runs that after Chromium installation.
Both integration harnesses use their own disposable databases and test-only login routes.
The new runner names its database `onedime_contrast_test`. No app data or live provider calls
are used. No credentials or environment-file contents are included in this evidence.

The two one-off scope/candidate proof scripts are review tools, not permanent CI constraints
requiring future application layouts to match this old baseline.

## Screenshots and review limits

[Before screenshots](../screenshots/current-contrast/before/) and
[after screenshots](../screenshots/current-contrast/after/) contain 22 fictional-data images
each: five workspaces at 375px/1280px in light/dark, plus desktop error/toast states.
All sub-tabs are scanned; the main workspace screenshots show their default panel.
Historical browser-test screenshots are restored rather than included in this PR.

Visual inspection covered the dark mobile First Dime page, light mobile PayPal view, and
dark desktop error/toast state. The existing fixed controller and horizontally scrolling
tables retain their prior layout. These captures do not establish other-browser or physical
phone behavior.

## Primary sources checked

- [W3C Contrast (Minimum), 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): text thresholds and large-text definition.
- [W3C Non-text Contrast, 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): unrounded thresholds, adjacent surfaces, optional boundaries, focus, disabled controls, and native appearance exceptions.
- [W3C Focus Visible, 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html): visible keyboard focus.
- [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts): package check commands and script execution.
- [Playwright screenshots](https://playwright.dev/docs/api/class-locator#locator-screenshot): element captures used for native control probes.
- [Playwright browser contexts](https://playwright.dev/docs/api/class-browser#browser-new-context): isolated OS scheme, viewport, and reduced-motion fixtures.

## Review state

Claude review is pending. No merge, deployment, settings change, live payment, or skins work
is authorized by this package. The unrelated untracked proposal and original skins handoff
are preserved and excluded. The branch's final commit, PR link, and exact-head CI status will
be recorded in the documentation checkpoint and PR; no local test result is a substitute for CI.
