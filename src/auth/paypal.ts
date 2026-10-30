/*  (o) OneDime | src/auth/paypal.ts
 *  ----------------------------------------------------------
 *  Sandbox identity and one-time OAuth state consumption.
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { PAYPAL_USERINFO_PATH, type AppConfig } from "../config.js";
import type { SessionStore } from "./session.js";
import { allowsBetaEmail } from "./beta.js";

export type PayPalTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export type PayPalUserInfo = {
  user_id?: string;
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  verified_account?: boolean;
};

export type PayPalIdentityClient = {
  exchangeCodeForToken(code: string): Promise<PayPalTokenResponse>;
  fetchUserInfo(accessToken: string): Promise<PayPalUserInfo>;
};

export const OAUTH_STATE_COOKIE = "onedime_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStep = "state_create" | "state_check" | "code_check" | "token_exchange" | "userinfo" | "beta_access" | "player_save" | "session_create" | "redirect";

function logStep(step: OAuthStep, outcome: "start" | "ok" | "rejected" | "failed", started: number) {
  // Fixed fields only: provider errors and callback input can contain credentials.
  console.info("oauth step", { step, outcome, elapsedMs: Date.now() - started });
}

type PayPalRouterOptions = {
  prisma: PrismaClient;
  config: AppConfig;
  sessions: SessionStore;
  paypalClient?: PayPalIdentityClient;
};

export class FetchPayPalIdentityClient implements PayPalIdentityClient {
  constructor(private readonly config: AppConfig) {}

  async exchangeCodeForToken(code: string): Promise<PayPalTokenResponse> {
    assertPayPalCredentials(this.config);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code
    });

    const response = await fetch(`${this.config.paypalApiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${this.config.paypalClientId}:${this.config.paypalClientSecret}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body,
      signal: AbortSignal.timeout(15000), redirect: "error"
    });

    if (!response.ok) {
      throw new Error(`PayPal token exchange failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as PayPalTokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<PayPalUserInfo> {
    const response = await fetch(`${this.config.paypalApiBaseUrl}${PAYPAL_USERINFO_PATH}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15000), redirect: "error"
    });

    if (!response.ok) {
      throw new Error(`PayPal userinfo request failed with HTTP ${response.status}.`);
    }

    return (await response.json()) as PayPalUserInfo;
  }
}

export function createPayPalRouter(options: PayPalRouterOptions): Router {
  const router = Router();
  const stateStore = new OAuthStateStore(options.prisma);
  const stateCookie = { httpOnly: true, secure: options.config.cookieSecure, sameSite: "lax" as const, path: "/auth/paypal" };
  router.use((_request, response, next) => {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    next();
  });
  const paypalClient = options.paypalClient ?? new FetchPayPalIdentityClient(options.config);

  router.get("/", async (_request, response, next) => {
    const started = Date.now();
    logStep("state_create", "start", started);
    try {
      if (!hasPayPalCredentials(options.config)) {
        response.status(503).send("PayPal sandbox credentials are not configured yet.");
        return;
      }

      const state = await stateStore.createState();
      response.cookie(OAUTH_STATE_COOKIE, state, { ...stateCookie, maxAge: STATE_TTL_MS });
      logStep("state_create", "ok", started);
      response.redirect(buildPayPalAuthorizationUrl(options.config, state).toString());
    } catch (error) {
      logStep("state_create", "failed", started);
      next(error);
    }
  });

  router.get("/callback", async (request, response, next) => {
    const started = Date.now();
    let step: OAuthStep = "state_check";
    const advance = (nextStep: OAuthStep) => {
      logStep(step, "ok", started);
      step = nextStep;
      logStep(step, "start", started);
    };
    logStep(step, "start", started);
    try {
      const state = typeof request.query.state === "string" ? request.query.state : undefined;
      const code = typeof request.query.code === "string" ? request.query.code : undefined;

      const cookieState = readStateCookie(request.headers.cookie);
      if (!state || !cookieState || !equalState(state, cookieState) || !(await stateStore.consumeState(state))) {
        logStep(step, "rejected", started);
        response.status(400).send("Invalid OAuth state.");
        return;
      }

      advance("code_check");
      if (!code) {
        logStep(step, "rejected", started);
        response.status(400).send("Missing PayPal authorization code.");
        return;
      }

      advance("token_exchange");
      const token = await paypalClient.exchangeCodeForToken(code);
      if (!token.access_token) {
        throw new Error("PayPal token response did not include an access token.");
      }

      advance("userinfo");
      const identity = await paypalClient.fetchUserInfo(token.access_token);
      const paypalUserId = identity.user_id ?? identity.sub;
      if (!paypalUserId) {
        throw new Error("PayPal identity response did not include a user identifier.");
      }

      advance("beta_access");
      if (!allowsBetaEmail(identity.email, options.config.betaAllowlist)) {
        logStep(step, "rejected", started);
        response.status(403).set("Cache-Control", "no-store")
          .sendFile(path.join(process.cwd(), "public", "beta.html"));
        return;
      }

      advance("player_save");
      const now = new Date();
      const displayName = identity.name ?? "PayPal player";
      const player = await options.prisma.player.upsert({
        where: { paypalUserId },
        create: {
          paypalUserId,
          displayName,
          email: identity.email,
          paypalVerified: identity.verified_account ?? null,
          lastSeenAt: now
        },
        update: {
          displayName,
          email: identity.email,
          paypalVerified: identity.verified_account ?? null,
          lastSeenAt: now
        }
      });

      advance("session_create");
      await options.sessions.createSession(player.id, response);
      response.clearCookie(OAUTH_STATE_COOKIE, stateCookie);
      advance("redirect");
      response.redirect("/app");
      logStep(step, "ok", started);
    } catch (error) {
      logStep(step, "failed", started);
      next(error);
    }
  });

  return router;
}

export function buildPayPalAuthorizationUrl(config: AppConfig, state: string): URL {
  const url = new URL(config.paypalAuthUrl);
  url.searchParams.set("flowEntry", "static");
  url.searchParams.set("client_id", config.paypalClientId ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.paypalScope);
  url.searchParams.set("redirect_uri", config.paypalRedirectUri);
  url.searchParams.set("state", state);
  return url;
}

class OAuthStateStore {
  constructor(private readonly prisma: PrismaClient) {}

  async createState(): Promise<string> {
    const state = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);

    await this.prisma.oauthState.create({
      data: {
        state,
        expiresAt
      }
    });

    return state;
  }

  async consumeState(state: string): Promise<boolean> {
    const result = await this.prisma.oauthState.deleteMany({
      where: {
        state,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    return result.count === 1;
  }
}

function hasPayPalCredentials(config: AppConfig): boolean {
  return Boolean(config.paypalClientId && config.paypalClientSecret);
}

function assertPayPalCredentials(config: AppConfig): asserts config is AppConfig & {
  paypalClientId: string;
  paypalClientSecret: string;
} {
  if (!hasPayPalCredentials(config)) {
    throw new Error("PayPal sandbox credentials are not configured.");
  }
}

function readStateCookie(header = ""): string | undefined {
  const values = header.split(";").map(value => value.trim()).filter(value => value.startsWith(`${OAUTH_STATE_COOKIE}=`));
  if (values.length !== 1) return undefined;
  const value = values[0].slice(OAUTH_STATE_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

function equalState(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
