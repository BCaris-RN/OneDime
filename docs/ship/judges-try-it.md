# Try OneDime: a 10-minute guide for judges and testers

Thanks for testing OneDime. This guide walks the main path from sign-in to the Vault, says what you should
see at each step, and covers what to do if something looks off. It takes about 10 minutes.

**Everything runs on PayPal's sandbox. No real money moves, and nothing touches a real PayPal account.**

---

## Before you start

**Open the beta:** https://onedime-web.onrender.com

The web service and database run on Render's paid plans through judging, so the beta doesn't sleep and
the database doesn't expire. If it's slow to load, wait a moment; refreshing doesn't make it faster.

**Use one of the three judge sandbox logins (A, B or C)** (the real values are in the Devpost
testing instructions, never in Git):

| Login | Email | Password |
| --- | --- | --- |
| Judge A (main) | `<judge A sandbox email>` | `<judge A sandbox password>` |
| Judge B (spare) | `<judge B sandbox email>` | `<judge B sandbox password>` |
| Judge C (spare) | `<judge C sandbox email>` | `<judge C sandbox password>` |

Use only these logins, never your own PayPal password. If another tester already used a login, take a
spare. Each login is its own private record.

**Download the sample PayPal activity file:** [sample-paypal-activity.csv](sample-paypal-activity.csv).
It's fictional: six payments, including one from a known payer, three from businesses OneDime doesn't know
yet, one from a person, and one in euros.

**Best on:** a desktop browser (Chrome, Edge, Firefox or Safari). It also works on a phone. See step 8.

---

## Step 1 · Sign in with PayPal (1 minute)

1. On the handheld console, press **START** (or click **Log in with PayPal**).
2. PayPal's sandbox page opens. Sign in with your judge login.
3. You return to OneDime. A short boot screen reads "Session established... Loading your ledger."
4. If a welcome card asks what kind of work you do, choose anything or press **Skip for now**.

**What you should see:** the app with seven tabs: First Dime, Spotlight, Freelance, Market, Stats, Vault
and PayPal.

**Why it matters:** PayPal checks the password. OneDime never sees it, and it only receives your sandbox
identity.

---

## Step 2 · Log your first session (1 minute)

1. Stay on **First Dime**, under **Log**.
2. Optional: in **Work clock**, type `Prolific` as the site, press **Clock in**, wait a few seconds, then
   press **Clock out**. The minutes fill in for you (rounded down, so a few seconds gives 0).
3. In **What did you work on?**, set:
   - Site or platform: `Prolific`
   - Minutes: any number, for example `20`
   - Earned: `1.99`
4. Press **Log it**.

**What you should see:**
- **Your entries** shows the row with status **Awaiting matching**.
- **Your ladder** shows "$1.99 logged but unmatched · pending" and **0% matched**.

**Why it matters:** logged pay is pending. Only pay that matches your PayPal activity moves progress.

---

## Step 3 · Import your PayPal activity (1 minute)

1. Open the **PayPal** tab.
2. Under **Activity CSV**, choose the `sample-paypal-activity.csv` file you downloaded.
3. Press **Import activity CSV**.

**What you should see:** the payments appear in the review list. The euro payment says it can't be routed,
on purpose, because only incoming USD payments count.

**Why it matters:** OneDime keeps only date, payer, gross, fee, net, currency, transaction ID and type.
Emails, IP addresses and every other column are thrown away.

---

## Step 4 · Turn on the private AI (1 to 2 minutes)

1. Tick **Smart suggestions**. It's off by default.
2. Press **Download and suggest**. A small model (about 41 MB, downloaded once and cached) runs in your
   browser.

**What you should see:**
- The logo studio payment: **Suggested: Freelance / Other**
- The creator sponsorship: **Suggested: Spotlight / Other**
- The store order: **Suggested: Market: selling / Other**
- Avery Ellis (a person): no suggestion
- Hyperwallet: **Suggested: First Dime / Prolific** (from the fixed payer map, not the model)

Nothing moves until you confirm.

**Why it matters:** no payment data is sent anywhere for AI. The model only suggests, and the server
decides what counts.

---

## Step 5 · Match the payout to your entry (1 minute)

1. On the **Hyperwallet** card, open **Create or link** and choose your existing **Prolific** entry.
   (If you leave "Create a new record", OneDime adds a second $1.99 entry instead of matching yours.)
2. Press **Confirm routing**.

**What you should see:**
- Back in **First Dime → Your entries**, the row now says **Matched**, with "Paid via PayPal" plus its
  gross, fee and net.
- **Your ladder** shows **$0.10 · reached** and **$1.00 · reached**, and your XP and level jump.

**Why it matters:** each rung is permanent and worth 100 XP once. Deleting the entry later doesn't take a
rung back.

---

## Step 6 · Route the rest and earn ranks (2 minutes)

1. Back on **PayPal**, confirm the Freelance, Spotlight and Market: selling suggestions. Keep "Create a new
   record" for these.
2. Open **Spotlight**, **Freelance** and **Market** (Selling).

**What you should see:**
- Each app has a rank line, for example "Creator · rank 4", "Freelancer · rank 3", "Seller · rank 2", plus
  totals for the selected month and records with Edit and Delete.
- The PayPal tab's **This month, everywhere** table adds every app up once, with no double counting.

**Why it matters:** matched pay in Spotlight, Freelance and Market adds 10 XP per matched dollar and
advances a permanent profession rank. Ranks never create money.

---

## Step 7 · Stats and the Vault (1 minute)

1. Open **Stats**: earned this month, matched share, best real hourly rate, a monthly chart, real hourly
   rate by platform and a **Matched vs pending** meter. Every chart has a **Show as a table** view.
2. Open **Vault**. Matched pay, work days and quests break tiles. With the sample activity matched,
   it should reach 100 tiles. **Penny wakes up** and the Mint door appears. The other four robots stay
   asleep. They're on the roadmap.

**Why it matters:** nothing in the Vault can be bought. Only real, matched work breaks tiles.

---

## Step 8 · Try the rest (optional, 2 minutes)

- **Exports:** in any app, open **Export** and download CSV or Excel for a month or date range. PayPal's
  **Export everything** gives a monthly summary workbook.
- **Skins:** open **Appearance** (inside **Menu** on a phone) and try Glass, Current, Paper and Slate, in
  light or dark mode.
- **Keyboard:** Tab to the app tabs, then use the arrow keys, Home and End. Focus is always visible.
- **Phone:** open the beta on a phone, or narrow your browser to phone width. The layout stacks, and you can
  add it to your home screen. The floating D-pad and A/B buttons drive it like a game.
- **Delete my data:** at the bottom of the PayPal tab. Export first if you want a copy, then type
  `DELETE MY DATA`. This removes the account and all its records and logs you out. Use it only when
  you're done, because it resets that login.

---

## If something looks off

| What you see | What to do |
| --- | --- |
| The page takes a long time to load | The beta is slow to respond. Wait a moment; refreshing does not make it faster. |
| PayPal says the login is wrong | Check for typos, or use a spare login. |
| OneDime turns the login away | Use another judge login and tell Brandon (it may need adding to the beta list). |
| Smart suggestions stays on "Loading" | The model is downloading (about 41 MB). Wait, or try again on a faster connection. |
| "Create or link" doesn't list your entry | Make sure step 2 used platform `Prolific` and amount `1.99`. |
| You routed a payment by mistake | Use Delete on the record it created, then route it again. |
| Someone already used your login | Switch to a spare, or use **Delete my data** to start fresh. |

**If the hosted beta is down:** run the local demo, which needs no keys. Install Node 24 and Docker
Desktop, then run `npm ci` and `npm run demo`, and open `http://127.0.0.1:3403/demo-login`. It uses
fictional data and a fake sign-in, so it doesn't show real PayPal sign-in.

---

## What to look for (judging criteria)

- **Technological implementation:** Log in with PayPal, PayPal activity matching that drives every reward,
  an on-device AI model with server-side validation, integer-cent money, more than 300 automated tests, and
  deploys only after green CI.
- **Design:** one coherent product across seven tabs and four skins, built for keyboard and phone.
- **Potential impact:** a private, honest record for people starting over online as work moves home.
- **Innovation:** a game where every reward traces back to real, matched pay, and nothing can be bought.
- **Presentation:** the demo video follows this same path.

Built by Brandon Caris with Claude (lead and reviewer) and Codex (implementation), on the PayPal Developer
Platform. OneDime isn't endorsed by PayPal.
