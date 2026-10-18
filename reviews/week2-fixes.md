# Week 2 correction evidence

Oct 17, 2026 (Hawaii). Addresses the operator-supplied [fix list](../handoffs/week2-fixes.md).

- Clock-out floors elapsed milliseconds to whole minutes, clamped at zero. API tests cover
  0, 45000, 59999, 60000, 90000, 119999 and 120000 ms, plus clock races and 409 conflicts.
- `reference/` is ignored; the pilot remains on disk but is removed from the tracked tree.
  The catalog parity test uses only `tests/fixtures/quests.json`, extracted from the existing
  pilot's 19 public quests, without private HTML, capability code or personal notes.
- Help explains Log in with PayPal, database storage, verified earnings eligibility,
  opt-in visibility including rung claims, and private email/notes. Playbook keeps its daily
  loop and tips and removes the personal bigger-play section.
- Dollar XP explicitly floors summed integer cents divided by 10. Tests cover both a
  199-cent entry and 99 + 100 cents across entries, each yielding 19 XP with no minute XP.
- Time-zone route test rejects `not/a-zone` with 400; accepted zones use Intl validation.
- API tests verify double clock-in and clock-out without clock-in return 409.
- Leaderboard code sorts verified totals descending, then XP descending. A three-player
  API test checks priority and the XP tie-break. This retains the approved Phase 2 rule:
  general progression XP may include logged earnings; earnings rankings use verified totals.
- Deleting a verified entry via the API leaves all eight earned rung claims unchanged.
- Endpoint scan: authentication and API URLs are sandbox-only. `uri.paypal.com` is the
  PayPal attribute scope identifier, and `developer.paypal.com` links are documentation,
  neither is a live API endpoint. Runtime config rejects alternate endpoint overrides.
- Requested application text scan finds only two `localStorage` uses in `public/app.ts`,
  both reading/writing `onedime-theme`. No authentication or player data is stored there.

## Validation

- Node 24.22.0: `npm run build` passed (server and browser type-check/build).
- `npm test`: 94 passed, 2 files, disposable PostgreSQL 16 via Docker/Testcontainers.
- `npm audit --json`: zero vulnerabilities across all dependencies.
- `git diff --check`: passed.
- CI evidence is linked in the corrective PR once its final commit is tested.

## Remaining boundary

The earlier pilot commit remains in Git history. Untracking the file does not erase prior
versions. Review/purge private history before public visibility; no history rewrite was
performed. PR #2 merged externally before these corrections. No merge, deploy, visibility
change, new credentials, or Phase 3 implementation is part of this correction.
