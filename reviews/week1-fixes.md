# Week 1 Fixes Codex Report

Date: October 13, 2026

Repository: BCaris-RN/OneDime
PR: https://github.com/BCaris-RN/OneDime/pull/1

## Summary

Codex completed the Phase 1 fix-before-merge list on branch `week1-foundation` and pushed commit `f381965` (`Address Week 1 review fixes`).

Fixes applied:

- Node 24 pinned in `package.json`, `@types/node`, GitHub Actions, and Render `NODE_VERSION`.
- Render build command changed to `npm ci --include=dev && npm run build && npm run db:migrate`.
- OAuth state consumption changed from find-then-delete to one atomic `deleteMany({ state, expiresAt: { gt: now } })`.
- Session IDs are stored as SHA-256 hashes in Postgres; the cookie keeps the raw random token.
- README now states local `npm test` needs Docker Desktop unless `DATABASE_URL` is set.
- Added regression tests for OAuth state race protection and hashed session storage.

## Verification

Local verification:

- `npm run build` passed.
- `npm test` passed: 1 test file, 9 tests, using PostgreSQL 16 through Testcontainers.
- `npm audit --omit=dev` passed with 0 vulnerabilities.

Remote verification:

- GitHub Actions `Test` passed on commit `f381965`.
- PR #1 was confirmed mergeable with the expected Week 1 changed file set.
- PR #1 was merged into `main` with merge commit `6dd6155`.

## Caveats

- The local machine was still running Node 22 during Codex's local checks, while the project and CI now require Node 24.
- CI passed on Node 24, so the code path was verified against the project runtime.
- Phase 2 was not started during this fix pass.

