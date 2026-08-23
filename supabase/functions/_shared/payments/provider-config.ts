// Maps the jsonb shapes returned by ordering.get_payment_provider_for_order
// and ordering.get_payment_provider_webhook_config onto the adapter-facing
// ProviderCredentials type, so the two RPC response shapes only get parsed
// in one place.
import type {
  PaymentAuthMode,
  PaymentEnvironment,
  ProviderCredentials,
} from "./types.ts";

function asAuthMode(value: unknown): PaymentAuthMode {
  return value === "oauth" ? "oauth" : "api_key";
}

function asEnvironment(value: unknown): PaymentEnvironment {
  return value === "live" ? "live" : "test";
}

/** From ordering.get_payment_provider_for_order's jsonb result. */
export function credentialsFromProviderResolution(
  result: Record<string, unknown>,
): ProviderCredentials {
  return {
    authMode: asAuthMode(result.authMode),
    environment: asEnvironment(result.environment),
    providerAccountId:
      typeof result.providerAccountId === "string"
        ? result.providerAccountId
        : null,
    publicConfig: (result.publicConfig as Record<string, unknown>) ?? {},
    privateKey:
      typeof result.credentialsSecret === "string"
        ? result.credentialsSecret
        : "",
  };
}

export interface WebhookProviderContext {
  providerConfigurationId: string;
  locationId: string;
  provider: string;
  environment: PaymentEnvironment;
  authMode: PaymentAuthMode;
  providerAccountId: string | null;
  webhookSecret: string;
}

/** From ordering.get_payment_provider_webhook_config's jsonb result. */
export function webhookContextFromResolution(
  result: Record<string, unknown>,
): WebhookProviderContext {
  return {
    providerConfigurationId: String(result.providerConfigurationId ?? ""),
    locationId: String(result.locationId ?? ""),
    provider: String(result.provider ?? ""),
    environment: asEnvironment(result.environment),
    authMode: asAuthMode(result.authMode),
    providerAccountId:
      typeof result.providerAccountId === "string"
        ? result.providerAccountId
        : null,
    webhookSecret:
      typeof result.webhookSecret === "string" ? result.webhookSecret : "",
  };
}
