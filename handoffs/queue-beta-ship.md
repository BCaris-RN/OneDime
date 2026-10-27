TASK QUEUE: OneDime, Beta and Ship (agent-run)
Operator: Brandon Caris. Lead: Claude. Implementer: Codex app (local, G:\one_dime).
Written Oct 20, 2026. Submission target Nov 10; deadline Nov 12, 11:00 AM HST.
Read AGENTS.md and docs/SDLC.md first. They win over this file on approvals, secrets and accounts.

HOW THIS QUEUE RUNS
  - Work the jobs in order. At each STOP, push, update the PR and STATUS.md, then STOP and wait.
    Everything between STOPs runs without asking.
  - GATES are Brandon-only actions. When you reach one, list exactly what Brandon must do, then stop.
  - Every job: tests for new logic, CI green on the exact head, no secrets printed, no live PayPal,
    fictional data only in screenshots, seeds and video.

====================================================================================
J1  BETA TOOLING  (branch week5-beta, extend draft PR #6)  target Oct 25
  1. In-app feedback
     - A "Send feedback" button in the header menu and in Help. Opens a short form: which app
       (auto-filled from the current tab), what happened (required, <= 1,000 chars), optional
       "this blocked me" checkbox.
     - Table feedback: id, player_id (cascade on delete), app, body, blocking bool, status
       (new | triaged | fixed | wontfix), created_at. Session required, rate-limited (5/hour/player),
       zod-validated, same-origin. Players see only a thank-you; they never read others' feedback.
     - "Delete my data" removes their feedback too. Update the privacy policy note list in the PR
       (Brandon edits Google Sites himself).
  2. Feedback export for the operator
     - npm run feedback:export writes feedback/feedback-<date>.md (folder gitignored), grouped by app,
       blocking first, with no player emails or names, only a short anonymous player tag.
     - Reads DATABASE_URL from .env. Never prints the URL.
  3. Beta guide: docs/beta-guide.md, plain and short. How to log in with the sandbox test account
     Brandon sends, what to try in each app (5 to 8 tasks), how to send feedback, what not to upload
     (client files, study content), and that it's a test version that may be reset.
  4. Deploy guide: docs/deploy-render.md, click-by-click for Brandon: create the Blueprint from
     render.yaml (free plans), set every env var (names only, where each value comes from), run
     migrations, open the Render URL, then update PayPal's return URL and PUBLIC_BASE_URL /
     PAYPAL_REDIRECT_URI to the Render address. Include how to check logs and how to redeploy.
  5. Cold-start note: a static line on the login page, "First visit after a quiet spell can take up
     to a minute to wake up." (Free tier sleeps after 15 minutes idle.)
  STOP 1.  GATES for Brandon: merge PR #6; deploy to Render free using docs/deploy-render.md;
           update PayPal return URL; create sandbox test accounts; send testers their logins and the guide.

====================================================================================
J2  FEEDBACK TRIAGE  (repeatable; run each time Brandon says "triage feedback")  Nov 1-8
  1. Run npm run feedback:export (Brandon may also paste notes into STATUS.md under "Play-test notes").
  2. Write reviews/beta-feedback-<date>.md: each item grouped, a one-line cause, a proposed fix,
     and a size (S/M/L). Mark anything touching money math, verification, privacy or game rules
     "NEEDS BRANDON".
  3. On a branch week5-fixes-<date> from main: fix every S and M item that is NOT "NEEDS BRANDON",
     with tests. Mark the feedback rows triaged/fixed (status only).
  4. Open a PR listing each fix against its feedback item.
  STOP 2 (each run).  GATE: Brandon merges, then redeploys from the Render dashboard.

====================================================================================
J3  SHIP PREP  (branch week6-ship from main, after the last beta fixes merge)  target Nov 8
  1. License: LICENSE = GNU AGPL-3.0 full text; package.json "license": "AGPL-3.0-only";
     README License section; one line that the OneDime name and logo are not covered.
  2. Screenshots: keep the 4 best (desktop First Dime, phone Market, phone PayPal overview, dark mode
     on any tab). Delete the rest. README shows them.
  3. Judge access: README "Try it" section at the top: the live URL (placeholder), a sandbox test
     login (placeholders Brandon fills; never commit real values until he says so), what to click
     first, the cold-start note, and npm run demo as the no-login fallback.
  4. Paid hosting at submission: a commit that switches render.yaml to Starter web + Basic-256mb
     Postgres, and README notes the demo runs on paid hosting through Dec 15. Don't deploy.
  5. Public repo export: scripts/export-public.ps1 builds a clean copy in ..\onedime-public with a
     single fresh commit from the current tree, excluding: STATUS.md, docs/phase*-decisions.md,
     feedback/, reference/, .env*, and any file that names an employer or contains personal notes.
     List every excluded file and why in the PR. Do NOT create the GitHub repo or push it.
  6. Agent story for judges: docs/how-we-built-it.md. One page: roles (Brandon operator, Claude lead
     and reviewer, Codex implementer, GitHub Codex review bot), the phase loop, approval gates,
     numbers (phases, PRs, tests, CI runs), two real catches by review (payout batch status,
     cross-month paid totals). First person, Brandon's voice, no hype.
  STOP 3.  GATES: Brandon reviews the exclusion list.

====================================================================================
J4  DEMO VIDEO AND DEVPOST DRAFT  (same branch week6-ship)  target Nov 9
  1. Video mode: a DEMO_VIDEO=true flag, demo mode only, that shows FICTIONAL platform names in place
     of real ones (e.g. "StudyHub" for research sites, "TubeCast" for video). The rules forbid
     third-party trademarks in the video. PayPal is the sponsor and stays named.
  2. scripts/record-demo.ts (Playwright): records a walkthrough at 1280x720 and one at 390x844 of the
     seeded demo: log in, First Dime log + quest, Spotlight brand deal to paid, Freelance gig to paid,
     Market shift + sale, PayPal import, a Smart suggestion confirmed, overview, export. Output to
     video/ (gitignored). Steady pacing, no cursor jumps, total under 2:40.
  3. docs/video-script.md: voice-over script timed to the recording, under 2:50 total: the problem
     (first dime is the hardest), who it's for, the demo, PayPal + on-device AI, why it matters.
     Plain spoken sentences Brandon can read.
  4. docs/devpost.md: Devpost's sections (Inspiration, What it does, How we built it, Challenges,
     Accomplishments, What we learned, What's next), Built-with list, and testing instructions.
     Use only features that exist. AI in the app = on-device model; Claude and Codex = how it was built.
     Never "Claude + PayPal presents."
  STOP 4.  GATES for Brandon, in order:
     a. Record the voice-over and combine with the recording (any video editor), upload to YouTube public.
     b. Create the public GitHub repo, approve pushing the export to it, add the license topic.
     c. Merge week6-ship, switch Render to paid, redeploy, fill the README placeholders.
     d. Paste docs/devpost.md into Devpost, add the video and repo links, submit by Nov 10.
     e. Tag the submitted commit v1.0.0-hackathon (Codex may do this after Brandon says "tag it").

====================================================================================
OPTIONAL, ONLY WITH BRANDON'S EXPLICIT YES IN CHAT
  - Branch protection on main: require green CI and all review conversations resolved before merge.
    (Repo settings change, so it needs his yes for this specific action.)

DO NOT TOUCH: game rules, XP for other apps, live PayPal, payouts enablement, deploys, repo visibility,
  creating or pushing to any GitHub repo, any gig-platform automation.

FALLBACK: if anything needs a value only Brandon has (URLs, test logins, keys), use a clearly marked
  placeholder, list it at the STOP, and keep going on everything else.
