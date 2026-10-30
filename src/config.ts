import { parseBetaAllowlist } from "./auth/beta.js";

export const PAYPAL_AUTH_URL = "https://www.sandbox.paypal.com/connect";
export const PAYPAL_API_BASE_URL = "https://api-m.sandbox.paypal.com";
export const PAYPAL_USERINFO_PATH = "/v1/identity/openidconnect/userinfo";
export const PAYPAL_SCOPE = "openid profile email https://uri.paypal.com/services/paypalattributes";

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  sessionSecret: string;
  sessionTtlDays: number;
  cookieSecure: boolean;
  publicBaseUrl: string;
  paypalClientId?: string;
  paypalClientSecret?: string;
  paypalRedirectUri: string;
  paypalAuthUrl: string;
  paypalApiBaseUrl: string;
  paypalScope: string;
  payoutsEnabled?: boolean;
  paypalWebhookId?: string;
  betaAllowlist?: ReadonlySet<string>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  const port = parseInteger(env.PORT, 3000);
  const appBase = blankToUndefined(env.APP_BASE_URL), publicBase = blankToUndefined(env.PUBLIC_BASE_URL);
  if (appBase && publicBase && appBase !== publicBase)
    throw new Error("APP_BASE_URL and PUBLIC_BASE_URL must agree.");
  const publicBaseUrl = appBase ?? publicBase ?? `http://localhost:${port}`;
  let origin: URL;
  try { origin = new URL(publicBaseUrl); }
  catch { throw new Error("App base URL must be an absolute HTTP(S) origin."); }
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/" ||
      (nodeEnv === "production" && origin.protocol !== "https:")) {
    throw new Error("App base URL must be an HTTP(S) origin, with HTTPS in production.");
  }
  const canonicalBaseUrl = origin.origin;
  const paypalRedirectUri = blankToUndefined(env.PAYPAL_REDIRECT_URI) ?? `${canonicalBaseUrl}/auth/paypal/callback`;
  if (paypalRedirectUri !== `${canonicalBaseUrl}/auth/paypal/callback`) {
    throw new Error("PAYPAL_REDIRECT_URI must exactly match the app origin plus /auth/paypal/callback.");
  }
  const paypalEnvironment = env.PAYPAL_ENVIRONMENT ?? "sandbox";
  const paypalAuthUrl = env.PAYPAL_AUTH_URL ?? PAYPAL_AUTH_URL;
  const paypalApiBaseUrl = env.PAYPAL_API_BASE_URL ?? PAYPAL_API_BASE_URL;
  const sessionSecret = env.SESSION_SECRET;

  if (paypalEnvironment !== "sandbox") {
    throw new Error("Only PayPal sandbox is supported for this milestone.");
  }

  if (paypalAuthUrl !== PAYPAL_AUTH_URL || paypalApiBaseUrl !== PAYPAL_API_BASE_URL) {
    throw new Error("PayPal endpoints must remain pointed at the sandbox environment.");
  }

  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }

  if (nodeEnv === "production" && env.PAYOUTS_ENABLED === "true") throw new Error("Payouts may only be enabled locally.");

  if (env.GOOGLE_SHEETS_ENABLED === "true") throw new Error("Google Sheets integration is not enabled; use file exports.");
  return {
    betaAllowlist: parseBetaAllowlist(env.BETA_ALLOWLIST),
    payoutsEnabled: env.PAYOUTS_ENABLED === "true",
    paypalWebhookId: blankToUndefined(env.PAYPAL_WEBHOOK_ID),
    nodeEnv,
    port,
    databaseUrl: env.DATABASE_URL,
    sessionSecret,
    sessionTtlDays: parseInteger(env.SESSION_TTL_DAYS, 14),
    cookieSecure: parseBoolean(env.COOKIE_SECURE, nodeEnv === "production"),
    publicBaseUrl: canonicalBaseUrl,
    paypalClientId: blankToUndefined(env.PAYPAL_CLIENT_ID),
    paypalClientSecret: blankToUndefined(env.PAYPAL_CLIENT_SECRET),
    paypalRedirectUri,
    paypalAuthUrl,
    paypalApiBaseUrl,
    paypalScope: env.PAYPAL_SCOPE ?? PAYPAL_SCOPE
  };
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  return value;
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
