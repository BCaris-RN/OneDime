# Sandbox login diagnostics

The callback logs fixed step names, start/ok/rejected/failed outcomes and elapsed
milliseconds only. It never logs query strings, codes, state, cookies, identity,
provider response bodies, error messages, credentials or tokens. The last failed
step distinguishes state validation, token exchange, userinfo, account access,
player storage and session storage. Request URLs must not be added to these logs.

Both state and session cookies use HttpOnly and SameSite=Lax. Production enables
Secure cookies. OAuth state is stored in Postgres for ten minutes and must match
the browser cookie before atomic consumption; a callback cannot be replayed.
Starting another login replaces the browser's previous pending login.

The configured app origin and callback must agree exactly; production requires
HTTPS. The PayPal dashboard Return URL must match PAYPAL_REDIRECT_URI character
for character. Neither redirect nor cookie security is derived from forwarded
host headers. Production trusts one ingress hop for Express protocol/IP handling,
matching Render's public ingress; direct local/test requests trust no proxy.

Each PayPal request has a 15-second abort deadline, including response reading.
Authorization codes are never retried after an ambiguous provider failure.
Render's free-service spin-up occurs before Node handles a request, so extending
the outbound PayPal timeout does not address that delay. State survives a process
restart in Postgres. After an expired state or failed exchange, start a fresh login.

Hosted configuration and a real sandbox callback are still operator checks after
an explicitly approved deployment. Local mocked tests cannot establish which
step failed on the currently deployed site.

Sources checked October 29, 2026:
- [PayPal login integration](https://developer.paypal.com/log-in/build)
- [PayPal authorization and exact Return URL](https://developer.paypal.com/log-in/build-button/)
- [Express proxy boundaries](https://expressjs.com/en/guide/behind-proxies/)
- [SameSite cookie behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [Render free-service spin-up](https://render.com/docs/free)
