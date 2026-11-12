# Devpost submission checklist

Every field is filled in below except the judge credentials, which stay as `<...>` placeholders. The story
text lives in [devpost.md](devpost.md); paste each section as written. Field names follow Devpost's standard
form, so check them against the hackathon's own rules page before submitting.

Deadline: Nov 12, 12:00 PM PST (10:00 AM HST).

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
| Built with | TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions, Render (blueprint, Postgres 16, deploy hook), PayPal Developer Platform (sandbox), Transformers.js, MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (MIT, quantized ONNX, runs in the browser), Claude, Codex |
| Team | Brandon Caris (solo, builder and owner). Built with Claude (lead and reviewer) and Codex (implementation). |
| Try it out link | https://onedime-web.onrender.com |
| Code repository link | https://github.com/BCaris-RN/OneDime |
| Video demo link | https://www.youtube.com/watch?v=BbFXWSLfNaU |
| Image gallery | `docs/screenshots/glass-first-1440.png`, `glass-stats-1440.png`, `glass-vault-1440.png`, `glass-paypal-1440.png`, `glass-first-390.png` |
| Thumbnail | `public/icons/coin-512.png` |
| Testing instructions | devpost.md, "Testing instructions", plus the judge login below |
| Judge sandbox login | email `<judge sandbox email>`, password `<judge sandbox password>` |

## Testing instructions box

Paste the "Testing instructions" section of devpost.md, then add:

> The judge sandbox logins are for this hackathon only and move no real money. The beta stays awake on
> Render's paid plan; if it is slow to load, wait a moment. If the beta is unavailable, the local demo
> needs no keys: `npm ci`, then `npm run demo`.

## Before you submit

- [ ] Claim the $50 Render credits for Best Use of Render: "Start building with $50 of Render credits" on
      https://paypalaihackathon.devpost.com/details/render.

- [ ] Render deploy hook set, so the beta runs the code the docs describe: Glass skin, personal ladder, Vault.
- [x] Judge sandbox logins are on `BETA_ALLOWLIST` on Render, so judges can enter the hosted beta.
- [ ] Judge sandbox login created in the PayPal Developer dashboard, and tested once end to end on the hosted
      beta, including the Create or link step.
- [x] Hosted beta and database run on Render's paid plans through judging, so the beta stays awake
      and the database does not expire.
- [x] Public repo ready at https://github.com/BCaris-RN/OneDime with README and LICENSE (AGPL-3.0).
- [ ] Repo link added; the repo is public while judging runs.
- [x] Demo video recorded and published: https://www.youtube.com/watch?v=BbFXWSLfNaU (final cut: 2:58.7).
- [ ] Privacy policy and user agreement pages (Google Sites) match the current beta wording.
- [ ] Draft claims re-checked: "more than 300 application tests" and "4,920-step keyboard audit" match the
      latest CI output.
- [ ] Read the submission once as a judge would: no real platform names and no live PayPal claim; use
      matched-activity wording.
- [ ] Submitted at least a day early, then reopened the public page to confirm every link works.
