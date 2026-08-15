import { getSupabaseClient } from "../../../lib/supabase/client";

export type CustomerAuthErrorCode =
  | "expired_code"
  | "identifier_missing"
  | "incorrect_code"
  | "invalid_request"
  | "network_error"
  | "provider_unreachable"
  | "rate_limited"
  | "replayed_token"
  | "server_error";

export class CustomerAuthError extends Error {
  code: CustomerAuthErrorCode;

  constructor(code: CustomerAuthErrorCode, message: string) {
    super(message);
    this.name = "CustomerAuthError";
    this.code = code;
  }
}

export interface VerifiedCustomer {
  customerId: string;
  phoneE164: string;
}

interface EdgeFunctionSuccessBody {
  tokenHash: string;
  email: string;
  customer: { id: string; phoneE164: string };
}

interface EdgeFunctionErrorBody {
  error?: { code?: string; message?: string };
}

function isKnownCode(code: string | undefined): code is CustomerAuthErrorCode {
  return Boolean(code) && [
    "expired_code", "identifier_missing", "incorrect_code", "invalid_request",
    "network_error", "provider_unreachable", "rate_limited", "replayed_token", "server_error",
  ].includes(code as string);
}

/**
 * Sends an MSG91 access token to customer-auth-msg91 and, on success,
 * completes the exchange into a real Supabase Auth session for this
 * browser's client instance. The Edge Function never hands back a session
 * directly - only a single-use hashed token - so this is the one call site
 * that finishes the handshake.
 */
export async function exchangeMsg91AccessToken(accessToken: string): Promise<VerifiedCustomer> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<EdgeFunctionSuccessBody>("customer-auth-msg91", {
    body: { accessToken },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    let code: CustomerAuthErrorCode = "network_error";
    let message = "Something went wrong. Please try again.";

    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as EdgeFunctionErrorBody;
        if (isKnownCode(body.error?.code)) code = body.error!.code as CustomerAuthErrorCode;
        if (body.error?.message) message = body.error.message;
      } catch {
        // Non-JSON error body - keep the generic network_error.
      }
    }

    throw new CustomerAuthError(code, message);
  }

  if (!data) throw new CustomerAuthError("server_error", "Something went wrong. Please try again.");

  const { error: verifyError } = await client.auth.verifyOtp({ token_hash: data.tokenHash, type: "magiclink" });
  if (verifyError) throw new CustomerAuthError("server_error", "Could not complete sign-in. Please try again.");

  return { customerId: data.customer.id, phoneE164: data.customer.phoneE164 };
}
