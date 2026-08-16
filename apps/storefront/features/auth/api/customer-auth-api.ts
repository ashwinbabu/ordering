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

/**
 * Mirrors what customer-auth-msg91 actually returns: it performs the
 * Supabase session exchange server-side and hands back the resulting
 * session, rather than a single-use token for the browser to redeem.
 */
interface EdgeFunctionSuccessBody {
  access_token: string;
  refresh_token: string;
  customer: { id: string; phone_e164: string; auth_user_id: string | null };
}

/** The function reports failures as a plain string, not a coded object. */
interface EdgeFunctionErrorBody {
  error?: string;
}

/** Derives a UI-facing reason from the HTTP status, since the function reports errors as prose. */
function codeFromStatus(status: number | undefined): CustomerAuthErrorCode {
  if (status === 409) return "replayed_token";
  if (status === 429) return "rate_limited";
  if (status === 401) return "incorrect_code";
  if (status === 400) return "invalid_request";
  if (status === 502 || status === 503) return "provider_unreachable";
  if (status && status >= 500) return "server_error";
  return "network_error";
}

/**
 * Sends an MSG91 access token to customer-auth-msg91, which verifies it
 * against MSG91 server-side and returns a Supabase session. Adopting that
 * session into this browser's client is what actually signs the customer in.
 */
export async function exchangeMsg91AccessToken(accessToken: string): Promise<VerifiedCustomer> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke<EdgeFunctionSuccessBody>("customer-auth-msg91", {
    body: { accessToken },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    const status = context instanceof Response ? context.status : undefined;
    let message = "Something went wrong. Please try again.";

    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as EdgeFunctionErrorBody;
        if (typeof body.error === "string" && body.error) message = body.error;
      } catch {
        // Non-JSON error body - keep the generic message.
      }
    }

    throw new CustomerAuthError(codeFromStatus(status), message);
  }

  if (!data?.access_token || !data.refresh_token) {
    throw new CustomerAuthError("server_error", "Something went wrong. Please try again.");
  }

  const { error: sessionError } = await client.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError) throw new CustomerAuthError("server_error", "Could not complete sign-in. Please try again.");

  return { customerId: data.customer.id, phoneE164: data.customer.phone_e164 };
}
