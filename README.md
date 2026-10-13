# OneDime

OneDime is a small TypeScript/Express app with PayPal sandbox login, PostgreSQL-backed sessions, and a plain HTML/CSS/TypeScript frontend.

## Week 1 scope

- Express server with `GET /health`
- PayPal sandbox OAuth/OpenID Connect login
- PostgreSQL sessions with signed, httpOnly cookies
- Prisma schema and checked-in migration for Week 1 through Week 3 tables
- Plain frontend shell for landing and logged-in tracker views
- Vitest coverage for auth/session/database constraints
- GitHub Actions test workflow
- Render Blueprint for a web service plus Postgres database

## Local setup

1. Install dependencies.

   ```bash
   npm ci
   ```

2. Copy the environment template and fill in local sandbox values.

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and set `DATABASE_URL` in `.env`.

4. Apply migrations.

   ```bash
   npm run db:migrate
   ```

5. Build and run the app.

   ```bash
   npm run build
   npm start
   ```

6. Open `http://localhost:3000`.

## Environment

Secrets are loaded from `.env` only. Do not commit `.env`.

- `DATABASE_URL`
- `SESSION_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_REDIRECT_URI`
- `PUBLIC_BASE_URL`
- `COOKIE_SECURE`

The PayPal integration is sandbox-only. The app rejects non-sandbox PayPal endpoint configuration.

## Tests

Run:

```bash
npm test
```

When `DATABASE_URL` is unset, tests start a temporary PostgreSQL container with Testcontainers. In CI, the workflow provides a PostgreSQL service and the tests use that database URL.

## PayPal docs used

- PayPal Log in with PayPal integration guide: https://developer.paypal.com/log-in/build/
- PayPal manual button build guide: https://developer.paypal.com/log-in/build-button/
- PayPal Log in with PayPal scope reference: https://developer.paypal.com/log-in/references/
- PayPal Identity API userinfo reference: https://developer.paypal.com/api/identity/v1/userinfo-get
- PayPal REST API base URL guidance: https://developer.paypal.com/api/make-api-requests

## Waiting on Brandon

- `/reference/pilot.html` was not present during the Week 1 build, so the current UI is a minimal placeholder shell for tracker, quests, leaderboard, playbook, and help.
- Real PayPal sandbox client credentials and redirect URI must be added locally by Brandon.
- Render deployment, public repository visibility, PR merge, payouts, webhooks, and live PayPal credentials are intentionally out of scope.

