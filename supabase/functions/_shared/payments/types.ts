// Provider-agnostic contracts for online payments. `auth_mode` is carried on
// every credential bundle so an adapter can support `api_key` today and grow
// an `oauth` branch later (A2 becoming a Razorpay Technology Partner) without
// changing any Edge Function that calls it.

export type PaymentAuthMode = "api_key" | "oauth";
export type PaymentEnvironment = "test" | "live";

/**
 * Everything an adapter needs to talk to the provider on behalf of one
 * location. `privateKey` is the single decrypted secret returned by the
 * service-role-only resolver RPCs -- for Razorpay's api_key mode this is the
 * Key Secret; the Key ID is not secret and lives in `publicConfig` instead,
 * since Standard Checkout needs it in the browser.
 */
export interface ProviderCredentials {
  authMode: PaymentAuthMode;
  environment: PaymentEnvironment;
  providerAccountId: string | null;
  publicConfig: Record<string, unknown>;
  privateKey: string;
}

export interface CreateOrderParams {
  amountMinorUnits: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  providerOrderId: string;
  raw: Record<string, unknown>;
}

export interface CheckoutSignatureParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface WebhookSignatureParams {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}

export interface FetchedPayment {
  providerPaymentId: string;
  providerOrderId: string | null;
  /** Provider-native status string (e.g. razorpay's "captured", "failed"). */
  status: string;
  method: string | null;
  amountMinorUnits: number;
  currency: string;
  captured: boolean;
  raw: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  createOrder(
    credentials: ProviderCredentials,
    params: CreateOrderParams,
  ): Promise<CreateOrderResult>;
  fetchPayment(
    credentials: ProviderCredentials,
    providerPaymentId: string,
  ): Promise<FetchedPayment>;
  verifyCheckoutSignature(
    credentials: ProviderCredentials,
    params: CheckoutSignatureParams,
  ): Promise<boolean>;
  verifyWebhookSignature(params: WebhookSignatureParams): Promise<boolean>;
}
