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
(the handheld screen), Paper and Slate are one tap away in Appearance. It installs to a phone's home screen,
works with reduced motion and reduced transparency, and is checked for contrast and keyboard use.

## How we built it

OneDime uses TypeScript, Express, PostgreSQL and a plain HTML/CSS/TypeScript client. Money is integer cents.
"AI reads, the server decides": the optional suggestion model runs on the device and only proposes a
workspace, and the server decides what counts as matched. Each phase starts from an approved handoff, gets
implemented on its own branch, and goes through local tests, GitHub Actions and Claude review. A merge to
main that passes CI deploys the beta to Render. See [how I built it](how-we-built-it.md).

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

After the hackathon: a walkable Mint and Your Lot for the robots, wake rules and story arcs for the other
four, an iPhone app, a desktop sidebar layout and more charts. See the
[backlog](../backlog.md). Payouts stay disabled and live PayPal use stays off until the operator decides
otherwise.

## Built with

TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions, Render and the PayPal
Developer Platform (sandbox).

## Testing instructions

**Hosted beta:** https://onedime-web.onrender.com. Sign in with the judge sandbox login: email `<judge
sandbox email>`, password `<judge sandbox password>`. Use only that login. The first visit after a quiet
spell can take up to a minute. Follow [Try OneDime](judges-try-it.md) to
log a $1.99 Prolific entry, turn on Smart suggestions, and import the
[sample PayPal activity](sample-paypal-activity.csv).
Choose **Download and suggest**. The logo, creator, and store-order payments
suggest Freelance, Spotlight, and Market: selling. Avery Ellis gets no
suggestion. Route Hyperwallet to First Dime and select the existing Prolific
entry under Create or link.

**Local demo:** with Node 24 and Docker Desktop, run `npm ci` then `npm run demo`, and open
`http://127.0.0.1:3403/demo-login`. It uses fake sign-in and fictional data.

**Run the tests:** use Node 24 and PostgreSQL 16 (or Docker), then `npm ci`, `npm run build` and `npm test`.
Do not use real account or payment data.
