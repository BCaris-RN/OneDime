## What changed and why

<!-- One or two sentences. Name the handoff this PR delivers (handoffs/<name>.md). -->

## How to run it

<!-- Commands, and env var NAMES only (never values). Say what Brandon has to set. -->

## Test results

<!-- Local: build, npm test (file and test counts), and test:beta, test:contrast, test:browser
     when they apply. CI: the run on the exact head commit. Say which checks were skipped and why. -->

## Doc links used

<!-- The live PayPal, Render, Google, Anthropic or npm pages this change relied on. -->

## Open questions

<!-- Anything you were unsure about, instead of a guess. -->

## Checklist

- [ ] Routes touched act only on the logged-in player's own data
- [ ] Server input is validated with zod; money is non-negative integer cents
- [ ] Nothing points at live PayPal
- [ ] No secrets, tokens, emails or `.env` values in the diff, logs or this description
- [ ] No employer name or account anywhere in the diff
- [ ] New behavior has tests, including the failure cases
- [ ] UI changes work by keyboard, at phone width, and in light and dark mode
- [ ] STATUS.md has the head commit, test counts and CI status

## Needs Brandon

<!-- Merge approval, always. Also any deploy, visibility, secret or PayPal account action this depends on. -->
