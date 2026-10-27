# R2 local command evidence

Working directory: `G:\one_dime_worktrees\long-run-beta`. Node 24.14.0 was invoked
by its absolute Codex-bundled executable, and task-local npm/npx shims put that same
Node first for nested commands. No `.env` was copied. Commands used fictional local
fixtures and disposable PostgreSQL 16; `DATABASE_URL` was unset for unit tests.

| Command | Final result |
| --- | --- |
| `npm ci` | Exit 0; 355 packages installed; zero vulnerabilities. |
| `npm run build` | Exit 0; server and client strict builds. |
| `npm run typecheck:contrast` | Exit 0; also independently passed in full CI. |
| `tsc --noEmit --strict --target es2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck scripts/check-browser-smart.ts scripts/export-feedback.ts` | Exit 0. |
| `npm test` (unchanged serial rerun) | Exit 0; 208 tests in nine files; 470.48s. |
| `node node_modules/tsx/dist/cli.mjs scripts/check-current-contrast-regressions.ts` | Exit 0; 24 regression groups, including eight modal guards. |
| `node node_modules/tsx/dist/cli.mjs scripts/check-current-contrast.ts --report reviews/claude-pr6/contrast-after.md` | Exit 0; 242 unique pairs; zero failing/uncovered. |
| `npm run test:browser` | Exit 0; 3,920 Tab steps, five apps/all sub-tabs, 320/390px, both themes; inference/privacy/cache/feedback/deletion. |
| `npm audit --json` | Exit 0; zero vulnerabilities, all severities. |
| `node --check reviews/claude-pr6/package.mjs` | Exit 0. |

Contrast used `CONTRAST_TEST_PORT=3426`; browser used `BROWSER_TEST_PORT=3422`.
Both set `TEST_DATABASE_NAME=onedime_longrun_beta_test` inside their own containers.
CI defaults remain 3406 and 3404 respectively, and CI runs commands sequentially.

Initial parallel unit and browser attempts failed during setup; their failed logs and
exit 1 are preserved as `*-initial-failed.*`. Unit results were 81 passed/127 skipped,
with the existing 120-second setup hook expiring; browser initialization hit the
existing PostgreSQL health timeout. The first contrast process was interrupted before
a scheme completed and is retained separately; it is not a passing or failing audit.
No test/timeouts, database durability settings, financial/auth/game/import logic or
original test assertions were changed to obtain the serial results.
