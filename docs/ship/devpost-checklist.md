# Devpost submission checklist

Every field is filled in below except the links and credentials, marked `<...>`. The story text lives in
[devpost.md](devpost.md); paste each section as written. Field names follow Devpost's standard form, so check
them against the hackathon's own rules page before submitting.

Deadline: Nov 12, 12:00 PM PST (10:00 AM HST), the earlier of the page and the rules. Target: Nov 10.

## Fields

| Field | Value |
| --- | --- |
| Project name | OneDime |
| Elevator pitch (200 characters) | OneDime turns real online income into a game: keep one private record, match payments to your PayPal activity, and climb a ladder from your first dime to $1,000. |
| Inspiration | devpost.md, "Inspiration" |
| What it does | devpost.md, "What it does" |
| How we built it | devpost.md, "How we built it" |
| Challenges we ran into | devpost.md, "Challenges" |
| Accomplishments that we're proud of | devpost.md, "Accomplishments" |
| What we learned | devpost.md, "What we learned" |
| What's next | devpost.md, "What's next" |
| Built with | TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions, Render, PayPal Developer Platform (sandbox), Transformers.js, MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (MIT, quantized ONNX, runs in the browser), Claude, Codex |
| Team | Brandon Caris (solo, builder and owner). Built with Claude (lead and reviewer) and Codex (implementation). |
| Try it out link | https://onedime-web.onrender.com |
| Code repository link | `<public repo URL>` |
| Video demo link | `<video URL>` |
| Image gallery | `docs/screenshots/glass-first-1440.png`, `glass-stats-1440.png`, `glass-vault-1440.png`, `glass-paypal-1440.png`, `glass-first-390.png` |
| Thumbnail | `public/icons/coin-512.png` |
| Testing instructions | devpost.md, "Testing instructions", plus the judge login below |
| Judge sandbox login | email `<judge sandbox email>`, password `<judge sandbox password>` |

## Testing instructions box

Paste the "Testing instructions" section of devpost.md, then add:

> The sandbox login is for this hackathon only and moves no real money. The first visit after a quiet spell
> can take up to a minute while the free beta wakes up. If the beta is down, the local demo needs no keys:
> `npm ci`, then `npm run demo`.

## Before you submit

- [ ] Render deploy hook set, so the beta runs the code the docs describe: Glass skin, personal ladder, Vault.
- [ ] Judge sandbox email added to `BETA_ALLOWLIST` on Render, and the change deployed, so the judge login is
      accepted.
- [ ] Judge sandbox login created in the PayPal Developer dashboard, and tested once end to end on the hosted
      beta, including the Create or link step.
- [ ] Hosted beta on the paid plan (basic-256mb) so a judge never waits on a cold start.
- [ ] Public repo created from `scripts/export-public.ps1` output, with README and LICENSE (AGPL-3.0-only),
      and no handoffs, reviews or STATUS.
- [ ] Repo link added; the repo is public while judging runs.
- [ ] Video recorded (`npm run record:demo`) plus the hosted-beta sign-in clip, voice-over added, under 2:50, uploaded, link opens when signed out.
- [ ] Privacy policy and user agreement pages (Google Sites) match the current beta wording.
- [ ] Draft claims re-checked: "more than 300 application tests" and "4,920-step keyboard audit" match the
      latest CI output.
- [ ] Read the submission once as a judge would: no real platform names, no "verified by PayPal", no live
      PayPal claim.
- [ ] Submitted at least a day early, then reopened the public page to confirm every link works.
