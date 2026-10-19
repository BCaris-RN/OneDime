import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
const fixture = { SESSION_SECRET: "fixture-session-value-at-least-32-characters" };
describe("configuration boundaries", () => {
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
