import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
const fixture = { SESSION_SECRET: "fixture-session-value-at-least-32-characters" };
describe("configuration boundaries", () => {
  it("keeps payout network calls disabled by default", () => {
    expect(loadConfig(fixture)).toMatchObject({
      payoutsEnabled: false
    });
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
