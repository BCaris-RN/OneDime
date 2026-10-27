# Try OneDime

## Hosted beta

The hosted beta URL is not published yet: **[URL to be provided by Brandon]**.

Request a tester login from the operator: **[sandbox test login to be provided by
Brandon]**. Use only the test PayPal login supplied for the beta, never your real
PayPal password. The beta uses PayPal's sandbox environment.

## Local demo

For a fictional-data demo, install Node 24 and Docker Desktop, then run:

```powershell
npm ci
npm run demo
```

Open `http://127.0.0.1:3403/demo-login`. The local demo has fake login, fictional
records and no provider credentials. It does not demonstrate real PayPal sign-in.
Stop the command with Ctrl+C to remove its disposable database container.

## Current feature status

Verified profession ranks, first-run/install, operator metrics, Stats and tax-summary
exports are in open PR #9. They are not part of main until reviewed and merged. The
hosted URL and sandbox tester login stay blank until Brandon finishes deployment and
tester-access checks.
