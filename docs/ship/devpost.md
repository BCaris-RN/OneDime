# OneDime

> Submission draft for Nov 9-10, 2026. Everything below is on the main branch. The hosted beta runs on
> PayPal sandbox only.

## Inspiration

Independent workers keep earnings and time records in different places, and the first dollars are the
hardest to feel. I wanted a small, private tool that helps someone record the work, see what is matched to
your PayPal activity, and decide where their next hour is best spent. I also wanted the first dime to feel
like a win, so the whole thing is a game you play with your real record.

## What it does

OneDime opens on a handheld console: a boot log, a tour and a Log in with PayPal button. After sign-in it
has seven tabs.

- **First Dime** is the first-income ledger: log work, time and pay, keep a streak, finish quests, and climb
  your ladder. Every player can earn every rung of the ladder. A rung needs a payment matched to your PayPal
  activity, it is permanent, and each one is worth 100 XP.
- **Spotlight, Freelance and Market** are workspaces for creator income, gigs, delivery shifts and sales.
  Matched earnings there add XP and advance a permanent profession rank: Creator, Freelancer, Driver or
  Seller. Ranks never create money.
- **PayPal** imports the player's own activity CSV, suggests a workspace for each payment and links it once,
  so a payment never counts twice. A monthly overview and exports (CSV, Excel and a tax-summary worksheet)
  bring the records together.
- **Stats** shows monthly income, matched share, real hourly rate per platform, a streak across apps and a
  matched-versus-pending meter. Every chart has a table view.
- **Vault** hides a sleeping robot behind 100 tiles. Matched pay, distinct work days and completed quests
  break tiles; nothing can be bought. Penny wakes at 100 tiles and opens the Mint door. Four more robots
  sleep, each waiting for its own kind of work.

The app looks like Glass by default: frosted panels over a quiet nebula with one accent color per tab. Current
(the handheld screen), Paper and Slate are one tap away under Menu > Appearance. It installs to a phone's
home screen,
works with reduced motion and reduced transparency, and is checked for contrast and keyboard use.

## How we built it

OneDime uses TypeScript, Express, PostgreSQL and a plain HTML/CSS/TypeScript client. Money is integer cents.
"AI reads, the server decides". Each phase starts from an approved handoff, gets
implemented on its own branch, and goes through local tests, GitHub Actions and Claude review. A merge to
main that passes CI deploys the beta to Render. See [how I built it](how-we-built-it.md).

The AI is a small classifier, Transformers.js running MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33
(MIT, quantized ONNX), and it runs in the player's browser. When a player imports a PayPal payment from a
payer OneDime does not know, the model suggests which workspace it belongs to. It runs on the device, so
payment details stay private and it costs players nothing. It is off until the player turns on Smart
suggestions. The player confirms each suggestion, and the server decides what counts.

I started on Oct 13, 2026 and had 38 pull requests merged by Nov 3, 2026.

The beta runs on Render. `render.yaml` is a blueprint for one web service and one Postgres 16 database, with
secrets left unset (`sync: false`) so they are entered in Render and never committed. Render's own
auto-deploy is off. Instead a merge to main that passes CI triggers the deploy hook from GitHub Actions, so
nothing deploys on red. The app's `/health` route reports the live commit, and the workflow waits until it
matches the commit just merged. Then the Playwright smoke test (`npm run smoke:beta`) runs against the live
URL, so a deploy only counts once the real site answers.

PayPal is used in sandbox mode for sign-in. Entries are matched to your PayPal activity file. A CSV
import is user-provided evidence and is not an authenticated PayPal transaction lookup. The isolated local
demo uses fake sign-in and fictional data and makes no provider calls.

## Challenges

The tricky cases were keeping ownership boundaries consistent across every app, counting a routed payment
only once, handling payouts whose batch and individual-item outcomes differ, and accounting for payments
that land in a different month than the work. Making ranks permanent, so deleting a record never takes back
what a player earned, needed claims that survive concurrent requests. Stats also had to agree with the
overview when a platform fee changes which amount matched. We kept money in integer cents and added tests
for the failure and timing cases.

Getting a handheld console, a frosted-glass skin and three other looks to stay readable was its own
challenge. Glass puts text on translucent panels over colored shapes, so the contrast check measures real
pixels over the brightest shape behind each tab instead of trusting the color tokens.

## Accomplishments

Private sessions, player-owned records, safe exports, optional on-device suggestions, sandbox activity-file
matching, personal ladders, profession ranks, Stats, the Vault and a private feedback path are all merged and
tested. There are more than 300 application tests, a 4,920-step keyboard focus audit across every workspace
and phone and desktop widths, and automated contrast checks for four skins, the landing console and the
Glass backdrops.

## What we learned

Imported data needs careful labels: a user's CSV can help match a record, but it does not prove that the
file is genuine. Keeping that distinction visible matters as much as the calculation. A batch-level success
and an item-level payment are different things, and earning month and payment month answer different
questions. A game layer only works if every reward traces back to something real, which is why a rung, a rank
or a tile always needs a record matched to your PayPal activity.

## What's next

### v1.0 "First Dime" (this release)

One private record across five kinds of online work: Log in with PayPal,
PayPal activity matching, private on-device AI suggestions, the ladder,
profession ranks, the Vault, Stats and exports.

### v1.1 "Proof"

Apply for PayPal partner access. If approved, connect PayPal directly so
payments arrive and match with the player's permission, without CSV. Add
certifications that count toward a profession rank after they're checked.
Keep AI private; let it learn from the player's own confirmations and
account for fees and expenses.

### v1.2 "Your Lot"

Build a walkable Mint and Your Lot. Lumen, Quill, Axle and Barter wake in
their own apps after real matched work, each with a short story. The Vault
shows Grit, Shine, Range and Craft from the player's real record.

### v1.3 "Everywhere"

Build an iPhone app on the same server and rules, a desktop sidebar layout
and more Stats charts, and opt-in guilds of players in the same profession.
Add portable proof: a verifiable badge for milestones a player can show anyone.

### v2.0 "Plus"

"Level your way to master your craft with the ultimate bot." Plus turns
five robots into helpers for their professions, for subscribers paid through
PayPal Subscriptions:

- Penny finds which starter gigs pay this player best per hour.
- Lumen plans content and prices sponsorships.
- Quill drafts proposals, sets rates from the player's own hourly data and
  sends client invoices through PayPal Invoicing.
- Axle finds the player's best hours and tracks miles and expenses.
- Barter writes listings and prices items.

Robots still wake only from real matched work. Plus adds their help, never
XP, ranks or tiles.

### Later

Hyperwallet as a payout source and live PayPal come later, only with care.
Payouts stay off until both are approved.

### What won't change

The core stays free. XP bonuses are only bonuses, never money. Nothing that
counts can be bought. The bots help you do the work; they never do it for you
or log in to gig platforms. AI suggests; the server decides.

## Built with

TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions, Render, the PayPal
Developer Platform (sandbox), Transformers.js, MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (MIT,
quantized ONNX, runs in the browser), Claude and Codex.

## Testing instructions

**Hosted beta:** https://onedime-web.onrender.com. Sign in with the judge sandbox login: email `<judge
sandbox email>`, password `<judge sandbox password>`. Use only that login. The first visit after a quiet
spell can take up to a minute. Follow [Try OneDime](judges-try-it.md): log a $1.99 Prolific entry, turn on
Smart suggestions (off by default; it downloads a one-time model, about 41 MB, that runs on your device),
and import the [sample PayPal activity](sample-paypal-activity.csv). Choose **Download and suggest**. The
logo, creator sponsorship and store orders suggest Freelance, Spotlight, and Market: selling. Avery Ellis
gets no suggestion. Nothing moves until you confirm. Route Hyperwallet to First Dime and select the existing
Prolific entry under **Create or link**. Otherwise, "Create a new record" adds another $1.99 entry. Matching
it gives two ladder rungs and their XP. The euro payment cannot be routed, on purpose. A payment from an
unknown payer gets "Suggested: <workspace> / Other. Confirm or change it." with the workspace picked by the
on-device model; nothing is routed until you confirm. The separate browser-test fixture,
`tests/fixtures/paypal-activity.csv`, has no unknown payer, so it shows "No unknown unrouted payments to
suggest. Using the fixed payer map."

**Local demo:** with Node 24 and Docker Desktop, run `npm ci` then `npm run demo`, and open
`http://127.0.0.1:3403/demo-login`. It uses fake sign-in and fictional data.

**Run the tests:** use Node 24 and PostgreSQL 16 (or Docker), then `npm ci`, `npm run build` and `npm test`.
Do not use real account or payment data.
