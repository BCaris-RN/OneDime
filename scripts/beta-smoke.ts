import assert from "node:assert/strict";
import { chromium } from "playwright";

const PRIVACY_URL = "https://sites.google.com/view/onedime-privacy-policy/home";
const TERMS_URL = "https://sites.google.com/view/onedime-user-agreement/home";
const PAYPAL_SANDBOX_HOST = "www.sandbox.paypal.com";
// Render's free web service sleeps after 15 idle minutes and takes about a minute to wake.
const COLD_START_MS = 60_000;

assert(process.env.BETA_URL, "Set BETA_URL to the beta origin, such as https://<service>.onrender.com");
const target = new URL(process.env.BETA_URL);
const isLocal = ["localhost", "127.0.0.1"].includes(target.hostname);
assert(target.protocol === "https:" || isLocal, "BETA_URL must use https");
const origin = target.origin;

const log = (message: string) => console.log(`smoke: ${message}`);

async function waitForHealth(): Promise<Response> {
  const deadline = Date.now() + COLD_START_MS;
  let lastFailure = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(deadline - Date.now()) });
      if (response.ok) return response;
      lastFailure = `status ${response.status}`;
    } catch (error) {
      lastFailure = (error as Error & { cause?: { code?: string } }).cause?.code ?? (error as Error).name;
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(`/health did not answer within ${COLD_START_MS / 1000}s (${lastFailure})`);
}

async function checkRedirect(path: string, expected: string): Promise<void> {
  const response = await fetch(`${origin}${path}`, { redirect: "manual" });
  assert.equal(response.status, 302, `${path} returned ${response.status}, expected 302`);
  assert.equal(response.headers.get("location"), expected, `${path} redirects somewhere unexpected`);
}

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const startedAt = Date.now();
  const health = await waitForHealth();
  assert.deepEqual(await health.json(), { ok: true }, "/health body");
  log(`health ok after ${Math.round((Date.now() - startedAt) / 1000)}s`);

  // Third-party policy pages are not fetched; only the redirect targets are checked.
  await checkRedirect("/privacy", PRIVACY_URL);
  await checkRedirect("/terms", TERMS_URL);
  log("policy redirects ok");

  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));

  const home = await page.goto(`${origin}/`, { timeout: COLD_START_MS });
  assert.equal(home?.status(), 200, `home page returned ${home?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  const login = page.getByRole("link", { name: "Log in with PayPal" });
  assert(await login.isVisible(), "login button visible");
  log("home page ok");

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 844 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollWidth <= width, `horizontal overflow at ${width}px (scrollWidth ${scrollWidth})`);
  }
  log("no horizontal overflow at 320, 390 and 1280px");

  assert.deepEqual(errors, [], `console errors on the home page: ${errors.join(" | ")}`);
  log("no console errors");

  // Stop at PayPal's door: the request is captured and aborted, so nothing signs in.
  await page.route(url => url.hostname.endsWith("paypal.com"), route => route.abort("aborted"));
  const paypalRequest = page.waitForRequest(request => new URL(request.url()).hostname.endsWith("paypal.com"));
  await login.click();
  const authorize = new URL((await paypalRequest).url());
  assert.equal(authorize.hostname, PAYPAL_SANDBOX_HOST, `login went to ${authorize.hostname}, not sandbox PayPal`);
  assert.equal(authorize.searchParams.get("redirect_uri"), `${origin}/auth/paypal/callback`,
    "PayPal redirect_uri must match BETA_URL");
  log("login reaches sandbox PayPal with a matching callback");

  log(`passed against ${origin}`);
} catch (error) {
  console.error(`smoke: failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
