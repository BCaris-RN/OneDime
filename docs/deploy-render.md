# Deploy the sandbox beta to Render

Brandon performs these steps after reviewing and merging PR #6 and approving the
deployment. This guide creates a free web service and a free Postgres database from
the private repository. Keep sandbox PayPal, payouts off, Google integration off,
demo seeding off and automatic deploys off. No deployment has been performed by
writing this guide.

## Before creating anything

Use your personal Render, GitHub and PayPal Developer accounts. Have the sandbox
app's credentials available privately and create a new random session secret of at
least 32 characters in your password manager. Never paste values into GitHub, feedback,
screenshots or chat. Do not connect an employer account.

Create the database close to the beta dates: free Postgres expires 30 days after
creation and has no backups. A free web service sleeps after 15 minutes without
incoming traffic and takes about a minute to wake. Only one free Postgres database
can be active in a workspace. Export records you want to keep before the beta ends.
These are [Render's free-plan limits](https://render.com/docs/free).

## Create the Blueprint

1. Open the [Render dashboard](https://dashboard.render.com/). Choose **New > Blueprint**.
2. Connect your personal GitHub account if needed, giving access to the private
   OneDime repository. Select that repository, select **main**, and leave Blueprint
   Path as `render.yaml` at the repository root.
3. Review the proposed resources: `onedime-web` and `onedime-db`, both **Free**.
   Do not select a paid plan or add resources. If Render reports an existing-resource
   conflict, stop and review it rather than creating a duplicate database.
4. Fill the prompted environment variables using the table below. For the first
   startup only, the two URL settings can use your existing local sandbox origin and
   matching callback. Do not test login until the Render address is configured in
   the next section. Leave the optional unused credentials blank; they are not
   prerequisites for this beta.
5. Review the changes, then choose **Deploy Blueprint**. This is the first deployment.
6. On the Blueprint's **Settings** page, set **Auto Sync** to **No**. On the web
   service's **Settings** page, confirm **Auto-Deploy** is **Off**. These are separate
   controls: Blueprint changes can otherwise apply resource changes automatically.

Render documents [Blueprint creation and manual sync](https://render.com/docs/infrastructure-as-code).
The committed [Blueprint](../render.yaml) supplies plans, commands and fixed settings;
its `sync: false` fields are entered privately during creation. Later changes to those
fields go through the web service's **Environment** page, as described in
[Render's environment-variable guide](https://render.com/docs/configure-environment-variables).

The database is pinned to PostgreSQL 16 to match local and CI fixtures. The web service
uses the existing `/health` endpoint for readiness. These are the `postgresMajorVersion`
and `healthCheckPath` fields in [Render's Blueprint reference](https://render.com/docs/blueprint-spec)
(checked October 20, 2026); the version pin applies when creating the database.

## Environment-variable checklist

This lists every key in `render.yaml`, with its source rather than credential values.
Keep the fixed Blueprint settings unchanged. Do not import a whole local `.env` file:
it may contain local URLs or flags that are unsuitable for Render.

| Variable | Where it comes from / action |
| --- | --- |
| `NODE_ENV` | Supplied by the Blueprint for the hosted server. |
| `NODE_VERSION` | Supplied by the Blueprint for the supported Node version. |
| `DATABASE_URL` | Render fills this from `onedime-db`'s internal connection string. Do not copy it into the repository or print it. |
| `SESSION_SECRET` | Your new private random secret, at least 32 characters. Required at startup. |
| `PAYPAL_CLIENT_ID` | The OneDime app under **Sandbox > Apps & Credentials** in your personal PayPal Developer dashboard. Required before testing login. |
| `PAYPAL_CLIENT_SECRET` | The secret for that same sandbox app. Required before testing login; enter it only in Render's private field. |
| `PAYPAL_REDIRECT_URI` | Initially your existing local sandbox callback; replace with `<RENDER_ORIGIN>/auth/paypal/callback` below. Required before testing login. |
| `PUBLIC_BASE_URL` | Initially your existing local sandbox origin; replace with `<RENDER_ORIGIN>` below. Required before testing writes or login. |
| `COOKIE_SECURE` | Supplied by the Blueprint for HTTPS cookies. |
| `PAYPAL_ENVIRONMENT` | Supplied by the Blueprint; keep sandbox. |
| `BETA_ALLOWLIST` | Privately enter the sandbox test accounts' PayPal emails, separated by commas. Do not put the list in this guide, logs or GitHub. Blank keeps login unrestricted. |
| `SESSION_TTL_DAYS` | Supplied by the Blueprint for session lifetime. |
| `PAYPAL_WEBHOOK_ID` | Leave blank. Payouts are disabled; this beta does not require a webhook. Do not create or enable one as part of these steps. |
| `PAYOUTS_ENABLED` | Supplied by the Blueprint; keep disabled. |
| `GOOGLE_SHEETS_ENABLED` | Supplied by the Blueprint; keep disabled. File exports work without Google OAuth. |
| `GOOGLE_CLIENT_ID` | Leave blank; reserved and unused. |
| `GOOGLE_CLIENT_SECRET` | Leave blank; reserved and unused. |
| `TOKEN_ENCRYPTION_KEY` | Leave blank; reserved and unused. No Google tokens are stored. |
| `DEMO_SEED_ENABLED` | Supplied by the Blueprint; keep disabled. Do not seed the hosted beta. |

Render supplies `PORT`; do not replace it with the local development port. Leave
`APP_BASE_URL` unset, because a conflicting alias makes startup fail. Leave the optional
PayPal endpoint and scope overrides unset so the app keeps its reviewed sandbox defaults.
Placeholders in angle brackets are instructions for Brandon, never literal final values.

The tester allowlist trims and lowercases exact email addresses; it does not merge
plus aliases or dotted addresses. Missing, blank or whitespace-only `BETA_ALLOWLIST`
keeps the existing login behavior. A nonblank value containing only separators or
any malformed address stops startup with a generic error. Empty comma-separated
slots are ignored when at least one valid address remains. An enabled list rejects
provider identities without an email before creating or updating a player/session.
After an approved deployment applies a changed list, removed accounts lose access
on their next request; the rejected session is deleted. Re-adding an account requires
signing in again for a session that was rejected. Existing financial records remain.
Changing this setting on Render requires Brandon's separate deployment approval;
**Save only** does not change the running process. No allowlist has been configured
on a hosted service by this code change.

## Migrations, address and sandbox login

1. Open `onedime-web` and its first deploy. Watch its build log. The Blueprint runs:

   ```text
   npm ci --include=dev && npm run build && npm run db:migrate
   ```

   `db:migrate` runs Prisma's pending migrations before `npm start`. A migration failure
   fails the build. Use the build log to check success; free web services have no shell
   or one-off jobs, so there is no separate dashboard migration command to run.
2. When the service is live, copy its exact HTTPS `onrender.com` address from the web
   service page. Call this `<RENDER_ORIGIN>` with no trailing slash. Open it and check
   that the login page and cold-start note load. Do not log in yet.
3. In the web service's **Environment** page, set `PUBLIC_BASE_URL` to that origin and
   `PAYPAL_REDIRECT_URI` to the same origin followed by `/auth/paypal/callback`.
   Choose **Save only** while completing the PayPal setup.
4. In your personal **PayPal Developer dashboard**, select **Sandbox**, then
   **Apps & Credentials**, then the OneDime app used for Render's credentials. Under
   **Other features**, enable **Log in with PayPal** if necessary and open
   **Advanced Settings**. Set its **Return URL** to exactly the same callback as
   `PAYPAL_REDIRECT_URI`, including HTTPS and path. Preserve the reviewed login
   attributes; the app requests identity, profile, email and PayPal account attributes.
   Set the policy URLs to the [privacy policy](https://sites.google.com/view/onedime-privacy-policy/home)
   and [user agreement](https://sites.google.com/view/onedime-user-agreement/home), then save.
   PayPal describes these fields in its [sandbox login integration guide](https://developer.paypal.com/log-in/build).
5. Back in Render, open **Deploys > Manual Deploy > Deploy a specific commit**.
   Select the merged, green-CI commit you approved and deploy it to apply the saved
   environment settings. Keep Auto-Deploy off. Build runs migrations again safely.
6. Open the exact Render origin and choose **Log in with PayPal**. Use only a sandbox
   personal test account you created, never your real PayPal login. Confirm the
   callback returns to OneDime and a fictional entry saves. If login fails, compare
   the two Render URL settings and PayPal Return URL character for character.

Do not share the URL until that check passes. Create the testers' sandbox accounts
yourself and send each login privately with [the beta guide](beta-guide.md), replacing
its beta-URL placeholder in the message you send. Do not commit their logins.

## Check logs and redeploy

To collect hosted feedback from your own computer, open the database's **Connect**
panel and copy its external connection URL privately into your local `.env` as
`DATABASE_URL`. Run `npm run feedback:export`, then restore your local database
setting. The hosted server keeps its internal connection URL. Do not paste either
URL into chat, GitHub or the feedback report. Reports are gitignored; review any
personal details typed into notes before sharing them, and remove local reports
when you no longer need them. Deleting an account removes database feedback, not
already-downloaded operator reports.

Open the web service's **Logs** page for runtime errors. Open a deploy on **Deploys**
for build and migration output. Share only a redacted error and time if you need help;
never share environment values, connection strings, authorization codes or account data.
[Render's logs guide](https://render.com/docs/logging) describes the two views.

After an approved fix merges and CI passes, use **Deploys > Manual Deploy > Deploy a
specific commit** for the approved SHA. Wait for it to become live, check the login page
and try the affected behavior with fictional data. If a build fails, read that deploy's
log before retrying. Keep both automatic controls off; do not create a deploy hook.
See [Render's manual-deploy guide](https://render.com/docs/deploys).

Writing this guide does not authorize paid hosting, enabling payouts, live PayPal,
changing repository visibility or any later deployment.
