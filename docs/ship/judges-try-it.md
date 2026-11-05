# Try OneDime

## Hosted beta

Open **https://onedime-web.onrender.com**. It runs on PayPal's sandbox, so no real money moves.

Sign in with the judge sandbox login: email `<judge sandbox email>`, password `<judge sandbox password>`.
Brandon puts the real values in the Devpost submission. Use only that login, never your real PayPal password.
OneDime never sees the password; PayPal's sandbox page handles it.

The beta sleeps when nobody is using it, so the first visit after a quiet spell can take up to a minute.

## What to click first

1. On the console, press **START** (or choose **Log in with PayPal**) and sign in with the judge login.
2. In **First Dime**, log a session: platform Prolific, amount `1.99`, any minutes.
3. Open **PayPal** and turn on **Smart suggestions** (off by default; the notice states the one-time model
   download, about 41 MB, which runs on your device). Then import `tests/fixtures/paypal-activity.csv` from
   the repository. Press **Download and suggest**. In this sample file Hyperwallet is a known payer and the
   euro payment cannot be routed, so you should see "No unknown unrouted payments to suggest. Using the fixed
   payer map." A payment from an unknown payer would instead show "Suggested: <workspace> / Other. Confirm
   or change it." with the workspace picked by the on-device model; nothing moves until you confirm. Now route the Hyperwallet
   payment to First Dime. Under **Create or link**, pick your existing Prolific entry before you confirm;
   leaving it on "Create a new record" adds a second $1.99 entry. The record is now matched to your PayPal
   activity, and two rungs of your ladder land with their XP. The second payment in that file is in euros and cannot be routed, on purpose.
4. Open **Stats** and **Vault** to see the matched pay become tiles. Open **Appearance** to try the skins.
   Glass is the default once the beta runs the newest build, and the local demo always has it.

## Local demo

If the beta is down, install Node 24 and Docker Desktop, then run:

```powershell
npm ci
npm run demo
```

Open `http://127.0.0.1:3403/demo-login`. The local demo has fake login, fictional records and no provider
credentials. It does not demonstrate real PayPal sign-in. Stop the command with Ctrl+C to remove its
disposable database container.

## What is in this version

Everything is on main: the First Dime ledger and personal ladder, Spotlight, Freelance and Market, PayPal
import and routing, matched profession ranks, Stats, the Vault, exports with a tax summary, first-run and
install support, the console landing page and the Glass skin. Payouts are disabled.
