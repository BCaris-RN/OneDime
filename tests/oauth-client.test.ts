import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPayPalAuthorizationUrl, FetchPayPalIdentityClient } from "../src/auth/paypal.js";
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
});
