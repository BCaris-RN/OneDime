import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPayPalAuthorizationUrl, FetchPayPalIdentityClient, parsePayPalUserInfo, PayPalUserInfoError } from "../src/auth/paypal.js";
import { loadConfig } from "../src/config.js";

const config = loadConfig({
  SESSION_SECRET: "fixture-session-value-at-least-32-characters",
  PAYPAL_CLIENT_ID: "fixture-id", PAYPAL_CLIENT_SECRET: "fixture-secret",
  PUBLIC_BASE_URL: "https://app.example"
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OAuth transport", () => {
  it("uses the exact configured redirect URI without trusting request headers", () => {
    expect(buildPayPalAuthorizationUrl(config, "fixture-state").searchParams.get("redirect_uri"))
      .toBe("https://app.example/auth/paypal/callback");
  });
  it.each(["token", "userinfo"])("bounds the %s request and never retries a consumed code", async stage => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const transport = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => reject(options.signal!.reason));
    }));
    vi.stubGlobal("fetch", transport);
    const client = new FetchPayPalIdentityClient(config);
    const pending = stage === "token" ? client.exchangeCodeForToken("fixture-code") : client.fetchUserInfo("fixture-token");
    const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    controller.abort(new DOMException("fixture timeout", "TimeoutError"));
    await assertion;
    expect(timeout).toHaveBeenCalledWith(15000);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][1].redirect).toBe("error");
  });

  it.each([
    { user_id: "payer-1", email: "payer@example.test" },
    { payer_id: "payer-2", emails: [{ value: "payer2@example.test" }] },
    { sub: "payer-3", emails: ["payer3@example.test"] }
  ])("normalizes realistic userinfo claims and keeps optional fields optional", payload => {
    expect(parsePayPalUserInfo(payload)).toMatchObject({
      user_id: expect.stringMatching(/^payer-/),
      email: expect.stringMatching(/^payer\d?@example\.test$/)
    });
  });

  it.each([
    [{ user_id: "payer-1" }, ["email"]],
    [{ email: "payer@example.test" }, ["user_id"]],
    [{ user_id: "", email: "" }, ["user_id", "email"]]
  ])("rejects userinfo without required claim names", (payload, missingClaims) => {
    expect(() => parsePayPalUserInfo(payload)).toThrow();
    try { parsePayPalUserInfo(payload); } catch (error) {
      expect(error).toMatchObject({ missingClaims });
    }
  });

});

describe("PayPal userinfo", () => {
  const respondWith = (response: Response) => {
    const transport = vi.fn(async (_url: string, _options: RequestInit) => response);
    vi.stubGlobal("fetch", transport);
    return transport;
  };
  const failure = () => new FetchPayPalIdentityClient(config).fetchUserInfo("fixture-token")
    .then(() => { throw new Error("expected a rejection"); }, (error: unknown) => error as PayPalUserInfoError);

  it("requests the OpenID Connect profile with the openid schema", async () => {
    const transport = respondWith(Response.json({ user_id: "fixture-user", email: "fixture@example.test" }));
    await new FetchPayPalIdentityClient(config).fetchUserInfo("fixture-token");
    const url = new URL(transport.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe("https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo");
    expect(url.searchParams.get("schema")).toBe("openid");
  });

  it("keeps the status, error name and debug id from a failed response", async () => {
    respondWith(Response.json({ name: "AUTHENTICATION_FAILURE", debug_id: "f00d1e5ca7", message: "private-token",
      details: [{ issue: "private@example.test" }] }, { status: 401 }));
    const error = await failure();
    expect(error).toBeInstanceOf(PayPalUserInfoError);
    expect(error.fields).toEqual({ status: 401, errorName: "AUTHENTICATION_FAILURE", debugId: "f00d1e5ca7" });
  });

  it("reads an OAuth-style error field as the error name", async () => {
    respondWith(Response.json({ error: "invalid_token", error_description: "private-token" }, { status: 401 }));
    expect((await failure()).fields).toEqual({ status: 401, errorName: "invalid_token" });
  });

  it("drops error fields that are not plain identifiers", async () => {
    respondWith(Response.json({ name: "bad private@example.test", debug_id: "private token" }, { status: 400 }));
    expect((await failure()).fields).toEqual({ status: 400 });
  });

  it("keeps only the status when the error body is not JSON", async () => {
    respondWith(new Response("<html>private-token</html>", { status: 502 }));
    expect((await failure()).fields).toEqual({ status: 502 });
  });

  it("reports only missing required claim names for a successful but incomplete profile", async () => {
    respondWith(Response.json({ user_id: "fixture-user" }));
    const error = await failure();
    expect(error.fields).toEqual({ status: 200, missingClaims: ["email"] });
    expect(error.missingClaims).toEqual(["email"]);
  });
});
