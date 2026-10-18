/*  (o) OneDime | src/paypal/client.ts
 *  ----------------------------------------------------------
 *  Fixed sandbox endpoints for payouts and signature verification.
 */
import { z } from "zod";
import { PAYPAL_API_BASE_URL, type AppConfig } from "../config.js";
import type { PayoutClient, PayoutRequest } from "./payouts.js";
const batchSchema = z.object({
  batch_header: z.object({
    payout_batch_id: z.string().min(1).max(120),
    batch_status: z.enum(["PENDING", "PROCESSING", "SUCCESS", "DENIED", "CANCELED"]),
    sender_batch_header: z.object({ sender_batch_id: z.string() }).optional()
  })
});
export function sandboxClient(config: AppConfig, transport: typeof fetch = fetch): PayoutClient {
  if (config.paypalApiBaseUrl !== PAYPAL_API_BASE_URL)
    throw new Error("Sandbox endpoints required.");
  async function token() {
    if (!config.paypalClientId || !config.paypalClientSecret)
      throw new Error("Sandbox credentials are missing.");
    const response = await transport(`${PAYPAL_API_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.paypalClientId}:${config.paypalClientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000),
      redirect: "error"
    });
    if (!response.ok) throw new Error("Sandbox authentication failed.");
    return z.object({ access_token: z.string().min(1) }).parse(await response.json()).access_token;
  }
  async function post(path: string, body: unknown, requestId?: string) {
    return transport(`${PAYPAL_API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error"
    });
  }
  function duplicateLink(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;
    for (const [key, value] of Object.entries(data)) {
      if (
        key === "href" &&
        typeof value === "string" &&
        /^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/payments\/payouts\/[A-Z0-9]+$/i.test(value)
      )
        return value;
      if (typeof value === "object") {
        const link = duplicateLink(value);
        if (link) return link;
      }
    }
    return null;
  }
  return {
    async create(body: PayoutRequest) {
      const response = await post(
        "/v1/payments/payouts",
        body,
        body.sender_batch_header.sender_batch_id
      );
      let data = await response.json();
      if (!response.ok) {
        const duplicate = JSON.stringify(data).includes("DUPLICATE_BATCH_ID")
          ? duplicateLink(data)
          : null;
        if (!duplicate) throw new Error("Sandbox payout failed.");
        const original = await transport(duplicate, {
          headers: { Authorization: `Bearer ${await token()}` },
          signal: AbortSignal.timeout(15000),
          redirect: "error"
        });
        if (!original.ok) throw new Error("Sandbox payout reconciliation failed.");
        data = await original.json();
      }
      const batch = batchSchema.parse(data).batch_header;
      if (
        batch.sender_batch_header?.sender_batch_id &&
        batch.sender_batch_header.sender_batch_id !== body.sender_batch_header.sender_batch_id
      )
        throw new Error("Payout batch mismatch.");
      return { id: batch.payout_batch_id, status: batch.batch_status };
    },
    async verify(headers, event) {
      if (!config.paypalWebhookId) return false;
      const names = [
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time"
      ];
      if (names.some((name) => !headers[name] || headers[name].length > 2000)) return false;
      const response = await post("/v1/notifications/verify-webhook-signature", {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: config.paypalWebhookId,
        webhook_event: event
      });
      if (!response.ok) return false;
      return (
        z
          .object({ verification_status: z.enum(["SUCCESS", "FAILURE"]) })
          .parse(await response.json()).verification_status === "SUCCESS"
      );
    }
  };
}
