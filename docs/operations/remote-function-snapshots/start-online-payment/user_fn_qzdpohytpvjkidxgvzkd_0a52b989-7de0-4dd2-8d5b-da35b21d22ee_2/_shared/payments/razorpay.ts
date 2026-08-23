// Razorpay adapter. Supports auth_mode = 'api_key' only for now; an 'oauth'
// branch (A2 becoming a Razorpay Technology Partner) can be added later by
// extending authHeader()/keyId() without touching any Edge Function, since
// callers only ever see the PaymentProviderAdapter interface.
import { hmacSha256Hex, timingSafeEqual } from "./signature.ts";
import type {
  CheckoutSignatureParams,
  CreateOrderParams,
  CreateOrderResult,
  FetchedPayment,
  PaymentProviderAdapter,
  ProviderCredentials,
  WebhookSignatureParams,
} from "./types.ts";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function checkoutKeyId(credentials: ProviderCredentials): string {
  const value = credentials.publicConfig?.checkoutKey;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("razorpay adapter: publicConfig.checkoutKey (Key ID) is missing");
  }
  return value;
}

function authHeader(credentials: ProviderCredentials): string {
  if (credentials.authMode !== "api_key") {
    throw new Error(`razorpay adapter: auth_mode '${credentials.authMode}' is not supported yet`);
  }
  return `Basic ${btoa(`${checkoutKeyId(credentials)}:${credentials.privateKey}`)}`;
}

async function razorpayRequest(
  credentials: ProviderCredentials,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: authHeader(credentials),
      "Content-Type": "application/json",
    },
  });

  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const description = body && typeof body.error === "object" ? JSON.stringify(body.error) : `HTTP ${response.status}`;
    throw new Error(`razorpay API error: ${description}`);
  }
  return body ?? {};
}

function toFetchedPayment(body: Record<string, unknown>): FetchedPayment {
  const status = typeof body.status === "string" ? body.status : "unknown";
  return {
    providerPaymentId: String(body.id ?? ""),
    providerOrderId: typeof body.order_id === "string" ? body.order_id : null,
    status,
    method: typeof body.method === "string" ? body.method : null,
    amountMinorUnits: typeof body.amount === "number" ? body.amount : Number(body.amount ?? 0),
    currency: typeof body.currency === "string" ? body.currency : "",
    captured: status === "captured",
    raw: body,
  };
}

export const razorpayAdapter: PaymentProviderAdapter = {
  async createOrder(credentials, params: CreateOrderParams): Promise<CreateOrderResult> {
    const body = await razorpayRequest(credentials, "/orders", {
      method: "POST",
      body: JSON.stringify({
        // Receipt is capped at 40 chars and must be ASCII-only per Razorpay's
        // Orders API; callers pass our own payment id (a uuid, 36 chars) so
        // this never truncates in practice.
        amount: params.amountMinorUnits,
        currency: params.currency,
        receipt: params.receipt.slice(0, 40),
        notes: params.notes ?? {},
        // Auto-capture on success so a paid order never gets stuck in
        // Razorpay's "authorized" state waiting on a separate capture call.
        payment_capture: 1,
      }),
    });

    const providerOrderId = body.id;
    if (typeof providerOrderId !== "string" || providerOrderId.length === 0) {
      throw new Error("razorpay adapter: order creation response did not include an id");
    }
    return { providerOrderId, raw: body };
  },

  async fetchPayment(credentials, providerPaymentId: string): Promise<FetchedPayment> {
    const body = await razorpayRequest(credentials, `/payments/${encodeURIComponent(providerPaymentId)}`);
    return toFetchedPayment(body);
  },

  async verifyCheckoutSignature(credentials, params: CheckoutSignatureParams): Promise<boolean> {
    // Documented Standard Checkout formula: hmac_sha256(order_id + "|" +
    // payment_id, key_secret) must equal razorpay_signature.
    const expected = await hmacSha256Hex(
      credentials.privateKey,
      `${params.providerOrderId}|${params.providerPaymentId}`,
    );
    return timingSafeEqual(expected, params.signature);
  },

  async verifyWebhookSignature(params: WebhookSignatureParams): Promise<boolean> {
    // Must be computed over the untouched raw body -- never a re-serialized
    // parse of it, which is not guaranteed to be byte-identical.
    const expected = await hmacSha256Hex(params.webhookSecret, params.rawBody);
    return timingSafeEqual(expected, params.signature);
  },
};

/** Exposed for callers that need order.paid confirmation directly from Razorpay. */
export async function fetchRazorpayOrder(
  credentials: ProviderCredentials,
  providerOrderId: string,
): Promise<Record<string, unknown>> {
  return razorpayRequest(credentials, `/orders/${encodeURIComponent(providerOrderId)}`);
}
