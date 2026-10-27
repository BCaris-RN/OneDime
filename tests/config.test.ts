import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
const fixture = { SESSION_SECRET: "fixture-session-value-at-least-32-characters" };
describe("configuration boundaries", () => {
  it.each([undefined, "", " \t\n"])("keeps beta access unchanged for a blank allowlist", value => {
    expect(loadConfig({ ...fixture, BETA_ALLOWLIST: value }).betaAllowlist).toBeUndefined();
  });
  it("normalizes and deduplicates exact beta account addresses", () => {
    expect(loadConfig({ ...fixture, BETA_ALLOWLIST: "  TESTER@example.test, second@example.test, tester@EXAMPLE.test, , " }).betaAllowlist)
      .toEqual(new Set(["tester@example.test", "second@example.test"]));
  });
  it.each([", ,", "not-an-email", "tester@example.test,private-invalid-value"])(
    "rejects a malformed nonblank beta allowlist without exposing its contents", value => {
      expect(() => loadConfig({ ...fixture, BETA_ALLOWLIST: value }))
        .toThrow(new Error("BETA_ALLOWLIST must contain comma-separated email addresses."));
    }
  );
  it("keeps payout network calls disabled by default", () => {
    expect(loadConfig(fixture)).toMatchObject({
      payoutsEnabled: false
    });
  });
  it("uses the numeric loopback app origin for the sandbox callback", () => {
    expect(loadConfig({...fixture,APP_BASE_URL:"",PUBLIC_BASE_URL:"http://localhost:3000"}).publicBaseUrl).toBe("http://localhost:3000");
    expect(loadConfig({...fixture,APP_BASE_URL:"http://127.0.0.1:3000"})).toMatchObject({
      publicBaseUrl:"http://127.0.0.1:3000",paypalRedirectUri:"http://127.0.0.1:3000/auth/paypal/callback"
    });
    expect(()=>loadConfig({...fixture,APP_BASE_URL:"http://127.0.0.1:3000",PUBLIC_BASE_URL:"http://localhost:3000"})).toThrow();
  });
  it("rejects non-sandbox environments and alternate provider endpoints", () => {
    expect(() => loadConfig({ ...fixture, PAYPAL_ENVIRONMENT: "live" })).toThrow();
    expect(() => loadConfig({ ...fixture, PAYPAL_API_BASE_URL: "https://example.test" })).toThrow();
    expect(() => loadConfig({ ...fixture, PAYPAL_AUTH_URL: "https://example.test" })).toThrow();
  });
  it("rejects production payout activation and the deferred Sheets integration", () => {
    expect(() =>
      loadConfig({ ...fixture, NODE_ENV: "production", PAYOUTS_ENABLED: "true" })
    ).toThrow();
    expect(() => loadConfig({ ...fixture, GOOGLE_SHEETS_ENABLED: "true" })).toThrow();
  });
});
