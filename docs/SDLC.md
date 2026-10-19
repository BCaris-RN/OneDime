# OneDime Software Development Lifecycle

Oct 13, 2026

How OneDime gets built: who does what, how each phase moves from plan to merged code, and what has to be true before anything ships.

## Roles and principles

| Role | Who | Owns |
| --- | --- | --- |
| Operator | Brandon | Scope, final decisions, every merge, deploy and visibility change, secrets in .env, PayPal and GitHub accounts |
| Lead | Claude | Phase specs, Codex handoffs, review of every pull request, game rules, AI prompts, docs |
| Implementer | Codex app (local) | Code, tests and pull requests from a handoff. Local runs. Repo custodian |
| Implementer | Codex Cloud | Sandboxed coding tasks once the repo exists. Never on a branch the local app owns |
| Research | Gemini (personal account) | Current PayPal, Render and Devpost docs |
| Project memory | NotebookLM (personal account) | Answers from this doc, the vision doc, handoffs and reviews |

**Non-negotiables:**

1. Brandon approves every merge, deploy, release and visibility change, each time. No standing permission.
2. One agent owns a branch at a time.
3. Sandbox PayPal only until Brandon says otherwise. Anything pointing at live PayPal stops the work.
4. Secrets live in .env and Render's settings, never in code, chat or commits.
5. Personal accounts only. Nothing touches an employer account.
6. Money is integer cents everywhere.
7. External docs are checked live, never from memory, and the pages used are cited in the pull request.
8. Unsure means ask in the pull request, not guess.

## The lifecycle of one phase

Every phase runs the same loop. Claude writes the spec and the Codex handoff. Brandon approves the scope. Codex builds on the phase branch and opens a pull request. Claude reviews it against the handoff and writes a fix list if anything fails. Only a passing review goes to Brandon, who approves the merge. Each Sunday, lessons from the pilot and the build feed the next spec.

Flow: Plan the phase (Claude) -> Approve scope (Brandon) -> Build on branch (Codex, tests, PR) -> Claude review passes? If no, fix list back to Codex. If yes -> Approve merge (Brandon, each time) -> Merge to main (CI green) -> Sunday retro -> next phase.

Every handoff uses the same template: target repo, target and base branch, files in scope, source of incoming work, expected behavior, tests to run, do not touch, desired output, and a fallback for anything missing. Handoffs and reviews are saved in the project as handoffs/<phase>.md and reviews/<phase>-review.md.

## Branches, approvals and environments

**Branches.** main always holds reviewed, merged work. Each phase gets one branch named for it, cut from main after the previous phase merges: week1-foundation, week2-game, week3-money-ai, and so on. Fixes from a review go on the same phase branch.

| Action | Who can do it |
| --- | --- |
| Push to a phase branch | The Codex agent that owns it, within an approved handoff |
| Open a pull request | Codex |
| Merge to main | Brandon only, after a passing review and green CI |
| Deploy to Render | Brandon only, starting in phase 3 |
| Make the repo public | Brandon only, before submission |
| Add or change secrets | Brandon only |

| Environment | What it is | PayPal |
| --- | --- | --- |
| Local | Brandon's machine, Postgres in Docker | Sandbox |
| CI | GitHub Actions on every push and pull request | Mocked |
| Demo | Render web service and Postgres, from phase 3 | Sandbox |
| Production | Not planned before the hackathon | Live, only with Brandon's explicit go-ahead |

## Quality gates and definition of done

A phase is done only when every box is checked.

- [ ] Every item in the handoff's expected behavior works
- [ ] Every test in the handoff exists and passes, locally and in CI
- [ ] New logic has tests, including the failure cases
- [ ] Every API route acts only on the logged-in player's own data
- [ ] Input is validated on the server. Amounts are non-negative integer cents
- [ ] No secrets in code, logs, commits or the pull request
- [ ] Nothing points at live PayPal
- [ ] Game rules match the pilot and the vision doc, unless the handoff changes them
- [ ] Pages work by keyboard, on a phone screen and in dark mode
- [ ] README explains how to run the new parts locally
- [ ] Pull request lists what was built, test results, doc links used and open questions
- [ ] Claude's review is saved, with every fix-before-merge item resolved
- [ ] Brandon has approved and merged

## Phase plan and current status

The dated build timeline lives in the [OneDime vision doc](https://claude.ai/code/artifact/00bc4008-e708-4ef2-96a4-d02628342816). Submission target is Nov 10. The deadline is Nov 12 at 10:00 AM Hawaii time.

| Phase | Branch | Scope | Status |
| --- | --- | --- | --- |
| 1. Foundation and login | week1-foundation | Repo, schema, Log in with PayPal, sessions, CI | Merged (PR #1) |
| 2. The game | week2-game | Logging, XP, rested XP, streaks, quests, opt-in leaderboard, rung race | Merged with review corrections (PR #2 and PR #3) |
| 3. OneDime app | week3-onedime-app | Pilot workspaces, exports, sandbox activity routing, disabled payouts, AI suggestions, deployment prep | Merged PR #4 at 423c33d; no deployment |
| 4. Real players | week4-playtest | Payout review fixes, free browser suggestions, overview/settings/policies, accessibility | P1-P4 ready for review; PR #5 unmerged |
| 5. Ship | week5-ship | Demo video, submission, repo public, license | Not started |

**Open decisions for Brandon:** zero-cost hosting, draft policy/legal review, physical-device
play-testing, and enabling sandbox milestone payouts.
The existing root LICENSE is unchanged. Rested XP starting at zero after the first logged day is approved.
