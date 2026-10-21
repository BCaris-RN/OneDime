# R3 beta allowlist review package

Checkpoint: October 20, 2026 (Hawaii). PR #8 is a draft stacked on PR #6, targeting `week5-beta`; it is unmerged. Branch head `68ac0406d2c1531541b3abff3cbebd9559ac2353` has successful exact-head CI. PR #6 remains unmerged pending Claude source review.

## Behavior and scope

`BETA_ALLOWLIST` optionally restricts PayPal sandbox login by exact normalized provider email (trim and lowercase only). Rejected email or missing email cannot create/update the player or establish a session. Existing sessions for removed identities are deleted when next checked. Blank/unset retains current behavior; malformed nonblank configuration fails startup with a generic message and does not echo values. The static beta page uses existing Current theme tokens. No credentials or tester addresses are in the repo.

The PR changes only the allowlist behavior, its configuration/documentation, static rejection page, targeted checks, CI invocation and status/evidence. It does not change financial, import, game, database, payout, Sheets or skin behavior. It does include authentication access gating as the explicitly approved R3 scope.

## Exact changed files

Compared with stacked parent `214307161bcd544ae02ac1eadf111a6e9b5a3ec8`:

- `.env.example`
- `.github/workflows/test.yml`
- `README.md`
- `STATUS.md`
- `docs/deploy-render.md`
- `package.json`
- `public/beta.html`
- `render.yaml`
- `scripts/check-beta-access.ts`
- `src/auth/beta.ts`
- `src/auth/paypal.ts`
- `src/auth/session.ts`
- `src/config.ts`
- `tests/config.test.ts`
- `tests/server.test.ts`

The review package adds 11 evidence paths:

- `reviews/beta-allowlist/README.md`
- `reviews/beta-allowlist/initial-ci.json`
- `reviews/beta-allowlist/page-contrast.md`
- `reviews/beta-allowlist/page-evidence.json`
- `reviews/beta-allowlist/targeted-tests.json`
- `reviews/beta-allowlist/screenshots/beta-dark-1280.png`
- `reviews/beta-allowlist/screenshots/beta-dark-320.png`
- `reviews/beta-allowlist/screenshots/beta-dark-390.png`
- `reviews/beta-allowlist/screenshots/beta-light-1280.png`
- `reviews/beta-allowlist/screenshots/beta-light-320.png`
- `reviews/beta-allowlist/screenshots/beta-light-390.png`

The updated PR therefore contains 26 paths total. Verify GitHub's changed-file list after this checkpoint commit is pushed.

## Verification

- Local Node 24 production build and strict contrast/browser typing passed.
- Targeted auth/config suite: 41 passed, 0 failed; 118 tests were filtered out by that targeted invocation.
- Focused static beta-page check: 18 combinations (System/Light/Dark × light/dark OS × 320/390/1280px), keyboard and return-link checks passed, no external requests; 19 contrast pairs passed, 3 documented exemptions, 0 failures, 0 uncovered. Six screenshots are included beside the JSON evidence.
- Full exact-head GitHub CI run [39526082045](https://github.com/BCaris-RN/OneDime/actions/runs/39526082045) passed every step: install, build, strict typing, all 236 unit tests, beta-page browser check, full Current contrast audit and full application browser suite.
- The earlier run on `ccf4b78` failed the new focus-visible check because the test had moved to pointer modality. Commit `68ac040` makes the check use keyboard Tab first and retains the focus assertion. Final full CI passed.
- Independent read-only source review found no actionable findings. This does not represent Claude approval.

Detailed machine-readable evidence is in `targeted-tests.json`, `page-evidence.json` and `initial-ci.json`; human-readable contrast results are in `page-contrast.md`.

## Risks and open gates

- Until a separately authorized operator configures a real nonblank sandbox tester list and deploys it, the gate remains disabled. No service setting was changed and no testers were invited.
- PR #8 is stacked on PR #6. Do not merge it until PR #6 is reviewed/merged, then rebase or retarget and rerun required checks.
- Claude source review, Brandon's merge decision, deployment, policy wording, physical-device/screen-reader checks and real sandbox connectivity remain open gates.
- The overall coordinator run stopped after R3 because the delegated operator hit its usage limit. R4–R8 have not started.

## Resume details

The user confirmed that F1 must preserve current First Dime XP; rank bonuses apply only to Creator, Freelancer, Driver and Seller. Canonical sources now present on main are `reference/pilot.html` (SHA-256 `D83A9DE592E5E26761FA00E23B30FCCAEF7C36428FC175D35E082F2F9736A45C`) and `docs/designs/skins-report.md` (SHA-256 `6B01C8E6240FD493227E0B3B4F669CC1CBD38056ACE85D74E48E844E0F99AD63`).
