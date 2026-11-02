TASK HANDOFF: OneDime, guardrails from the agent app template
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local).
Written Nov 2, 2026. Brandon asked for the easy, low-risk parts of his agentic-app-template before the
Nov 12 deadline. The full review is in the claude.ai project at reviews/agentic-template-review.md.

AUTHORIZED: create branch template-guardrails from origin/main in a new worktree, apply the patch,
  push the branch, open a PR, update STATUS.md on the branch.
NOT AUTHORIZED: merge, deploy, repo settings, rulesets, secrets, visibility. Brandon does those.

INPUT
  G:\one_dime\reference\template-guardrails.patch (reference/ is gitignored, so it isn't in git).
  One commit, authored as Brandon, made against main edcb40c. It touches:
    .gitignore                         env variants, *.pem, *.key, credentials.json,
                                       .claude/settings.local.json; .env.example stays tracked
    .github/pull_request_template.md   sections match AGENTS.md and the SDLC definition of done
    .claude/settings.json              Claude Code only: refuses to read or edit secrets and to
                                       force-push; asks before merges, pushes to main, workflow
                                       runs (deploys), releases, visibility, secrets and gh api
                                       PUT/PATCH/DELETE
    AGENTS.md                          one line: PR descriptions use the template's sections
    handoffs/template-guardrails.md    this file

STEPS
  1. git fetch origin
     git worktree add G:/one_dime_worktrees/template-guardrails -b template-guardrails origin/main
  2. In that worktree: git am --3way G:/one_dime/reference/template-guardrails.patch
     If it still conflicts, git am --abort and report. Don't hand-merge AGENTS.md.
  3. Check:
     - git check-ignore -v .env .env.local .env.production x.pem x.key credentials.json
       .claude/settings.local.json             -> every path is ignored
     - git check-ignore -v .env.example        -> NOT ignored (exit code 1)
     - git ls-files -ci --exclude-standard     -> prints nothing (no tracked file became ignored)
     - node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"
     - npm ci && npm run build
     No app code changes, so the full suite runs in CI on the PR rather than locally.
  4. Add a STATUS.md checkpoint, push, and open the PR. Fill the body from the new template
     (gh pr create --body-file). Wait for CI on the exact head and read the result.
  5. Stop and report: PR link, head commit, CI result.

DO NOT TOUCH: app code, workflows, render.yaml, docs/ship (ship-prep owns it), other agents' branches.

AFTER MERGE (Brandon, by hand)
  Once the public repo exists, turn these on in its security settings (all free on public repos):
  secret scanning with push protection, Dependabot alerts, CodeQL default setup, and private
  vulnerability reporting.
