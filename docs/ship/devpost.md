# OneDime

## Inspiration

The hardest dollar to earn online is the first one.

Everyone starts in the same place: signing up for gig sites, taking tests, waiting on approvals, and wondering if any of it will ever pay. That's where most people give up, right before their first win.

Jobs are moving home, and some are being automated away. The people starting over online need a way up, and a record of what they've actually done.

Games figured this out a long time ago. Nobody quits level one, because the first win comes fast and the next goal is always in sight. So I asked: what if earning money online was the game, and every reward in it had to be real?

## What it does

OneDime is a quest game for real online work, and every journey starts with a dime.

- **Sign in with PayPal.** Press START on the handheld console and log in with PayPal. PayPal checks the password; OneDime never sees it.
- **Log it. Clock it.** Clock in, do the work, clock out, and log what you earned. New pay waits as pending.
- **Match it.** Import your own PayPal activity file. Pay that matches your PayPal activity moves you forward. Nothing else does.
- **Climb the ladder.** $0.10, then $1, $10, $50, $100, $250, $500 and $1,000. Every player can reach every rung, each one is permanent, and each is worth 100 XP.
- **Private AI.** Turn on Smart suggestions and a small AI model runs in your browser to suggest where each payment belongs. You confirm. The server decides.
- **Real profession ranks.** Spotlight (creator income), Freelance and Market (delivery and selling) turn matched pay into XP and permanent ranks: Creator, Freelancer, Driver and Seller.
- **Know your worth.** Stats shows your real hourly rate on every site, matched vs pending, and your month at a glance. Every chart has a table view.
- **Quests, streaks and rest.** 19 quests guide you from your first log to a full record. Your streak grows every day you work, and days off build rested XP for a bonus next session. OneDime rewards rest.
- **The Vault.** Real work breaks tiles. Break all 100 and Penny the robot wakes up.
- **Your record, your call.** Export any month to CSV or Excel for tax time, or delete your data anytime. Opt into the leaderboard only if you want to.

It works on a phone or a desktop, by keyboard or with an on-screen D-pad, in four looks: Glass, Current, Paper and Slate.

**Code of honor:** nothing that counts can be bought. No loot boxes, no buying rank. OneDime pays nobody and promises no income. It keeps an honest record of what you earned.

## How I built it

- **Log in with PayPal** (OpenID Connect, sandbox) gives every player one real identity and one private record.
- **PayPal activity matching:** the player imports their own activity CSV. OneDime keeps only date, payer, gross, fee, net, currency, transaction ID and type, and throws the rest away. Only incoming USD payments can be matched, and each payment counts once.
- **On-device AI:** Transformers.js runs MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (MIT, quantized ONNX) in the browser. It suggests a workspace for payers OneDime doesn't know. No payment data leaves the device, and it costs players nothing.
- **Server-side rules:** TypeScript, Express, PostgreSQL and Prisma. Money is always integer cents, and ladder rungs and ranks are decided on the server inside database transactions, never in the browser.
- **Render:** a render.yaml blueprint for the web service and Postgres 16, secrets kept out of Git, and a deploy hook that fires only after CI passes on main. /health reports the live commit, and a Playwright smoke test checks the real site after every deploy.
- **The team:** I'm a solo builder. Claude is my lead architect and reviewer, and Codex builds each phase from written specs. Nothing merges without review, green CI and my approval. I started on Oct 13, 2026.

## Challenges I ran into

Trust was the big one. A game about money only matters if every number in it is real. My first plan was a race for each rung, paid out with PayPal Payouts. I dropped it: OneDime shouldn't pay people to play, and a race only rewards whoever got there first. Now every player climbs their own ladder, and only pay matched to PayPal activity counts.

The details were harder than they looked: counting a payment only once, handling fees that change which amount matches, pay that lands in a different month than the work, and ranks that stay earned even if a record is deleted later.

Making it feel like a game while staying readable was its own challenge. Glass puts text on see-through panels, so the contrast checks measure real pixels instead of trusting the color codes.

## Accomplishments that I'm proud of

- More than 300 automated tests, all green, and nothing deploys until they pass
- A 4,920-step keyboard audit and automated contrast checks across four skins
- Private AI that runs on the player's own device and never decides on its own
- A game that rewards rest, not burnout
- A code of honor that stays in the rules: nothing that counts can be bought

## What I learned

Game design mattered as much as the code. Every mechanic had to answer one question: does this help someone earn, or does it just keep them clicking?

Imported data needs honest labels too. A CSV helps match a record, but it isn't proof that the file is genuine, so OneDime says "matched to your PayPal activity" and never claims more.

## What's next for OneDime

- **v1.1 "Proof":** apply for PayPal partner access so payments can match directly with the player's permission, no file needed. Add certifications that count toward a rank once they're checked.
- **v1.2 "Your Lot":** a walkable Mint where Lumen, Quill, Axle and Barter wake up after real work in their professions.
- **v1.3 "Everywhere":** an iPhone app, guilds for players in the same profession, and a portable badge for milestones you can show anyone.
- **v2.0 "Plus":** "Level your way to master your craft with the ultimate bot." The robots become real AI helpers for each profession, through PayPal Subscriptions. The core stays free, and Plus never buys XP, ranks or tiles.

Social media shows what people claim. OneDime will show what they actually did, down to the very first dime.

## Built with

TypeScript, Express, PostgreSQL, Prisma, HTML, CSS, Playwright, GitHub Actions, Render, the PayPal
Developer Platform (sandbox), Transformers.js, MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (MIT,
quantized ONNX, runs in the browser), Claude and Codex.

## Testing instructions

**Hosted beta:** <https://onedime-web.onrender.com> (PayPal sandbox). Sign in with one of the three judge sandbox logins: email `<judge sandbox email>`, password `<judge sandbox password>`. Use only a judge sandbox login. The beta stays awake on Render's paid plan; if it is slow to load, wait a moment. Refreshing does not make it faster. Follow [Try OneDime](judges-try-it.md): log a $1.99 Prolific entry, turn on
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
