# PR 6 source review checkpoint

R2 rebases `week5-beta` onto main `4be44f57dd18e4ed7dd80eb3666e525f2f9bb955`
(merged PR 7). The previous beta source was `e3918ad0635fcbb7551e867c630bf9f20aec9102`.
The earlier independent QA branch `codex/beta-qa` remains preserved at
`b803d91dd13f75a85e59b2e93d0ebf3a406d2d8c`.

The rebase retained both sets of npm scripts and the Current stylesheet; its only
CSS difference from new main is the existing feedback/menu styling. Checkpoint
STATUS text was replaced by the current R2 status. README combined automatically.
No financial, import, authentication or game calculations were changed during R2.
The original PR 6 feedback route, exporter, migration and their tests are included
in the complete source archive for review; this statement does not imply Claude
has approved them.

The only new hosting changes are `healthCheckPath: /health` on `onedime-web` and
`postgresMajorVersion: "16"` on `onedime-db`. No resources were created or changed.
The two fields were checked against the
[official Blueprint reference](https://render.com/docs/blueprint-spec) on October 20, 2026.

The permanent contrast scanner recognizes the active modal as the visible scope,
selects native controls from that scope and places its neutral native checkbox
reference inside the modal's top layer. Regression mutations ensure background
failures do not leak into a modal scan, and that an authored checkbox cannot
silently use the native appearance exemption. The runner exercises the real menu
and empty, invalid, error, delayed sending and sent dialog states in both selected
themes against both OS schemes. It asserts textarea and checkbox observations,
excludes background controls and samples keyboard focus/hover/active combinations.
Failure/success HTTP responses are fictional and intercepted locally.

Policy routes are checked with redirects disabled and exact expected Location
headers. No hosted policy content is fetched or audited. External browser origins
are blocked and reported as failures. Local ports are configurable; CI defaults
remain browser 3404 and contrast 3406. This run uses 3422 and 3426 with separate
disposable PostgreSQL 16 containers named internally `onedime_longrun_beta_test`.
Unit tests use their own ephemeral containers with `DATABASE_URL` unset.

## Validation

Node 24.14.0; Windows PowerShell; Chromium and PostgreSQL 16. Logs and verified
process exit codes are in `evidence/`. The first local parallel DB-backed runs
encountered cold setup timeouts; those failures are retained and are not passes.
The final report records the serial reruns separately. No existing test timeout
or assertion was weakened, and no tests were skipped intentionally.

Build, strict contrast typing, strict browser/export typing, dependency installation
and a full `npm audit --json` pass. Audit reports zero vulnerabilities. The contrast
regression suite passes 24 check groups, including eight modal guard checks.
Full unit/browser/contrast results and exact CI evidence are recorded at completion.

## Final source package

After final-head CI and bot review, run `node reviews/claude-pr6/package.mjs` from
the repository root using Node 24. The stable ignored output is
`reviews/claude-pr6/onedime-pr6-source-review.zip`. It contains:

- The complete binary Git diff and changed-file manifest against the exact main base.
- Complete contents of every changed existing file, including feedback route/export,
  client, migration 000009, Prisma schema, server, exporter and test source. Deleted
  files are preserved under `deleted-base/` for review, rather than restored to the app.
- Final-head CI and bot comment JSON, plus per-file SHA-256 hashes and exact head/base.

Generated final-head CI/comment JSON and the ZIP are ignored to avoid embedding their
own SHA or nesting an archive inside its own diff. The committed sources and logs are
the review materials; the manifest identifies the final archive's exact source head.

## Remaining limits and gates

This validates local Chromium fixtures and CI, not physical devices, screen readers,
Firefox native controls, deployed Render, sandbox connectivity or external accounts.
The dialog's decorative outside border is measured using the ancestor surface as a
diagnostic, not a backdrop-specific conformance claim. Native appearance exemptions
and decorative/disabled pairs remain labeled exemptions, never passes.

Claude's source review and Brandon's separate PR 6 merge approval remain required.
No merge, deployment, tester invitation, account creation, provider call, secret or
hosting setting change occurred. Policy wording, tester access decisions, free-tier
limits and private feedback retention remain operator gates. R3 owns the separately
authorized beta allowlist; no allowlist was added in R2.
