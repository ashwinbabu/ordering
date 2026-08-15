import type { AuthError } from "@supabase/supabase-js";
import { toE164, type PhoneNumber } from "../../../domain/phone";
import { getSupabaseClient } from "../../../lib/supabase/client";

/**
 * The single boundary between the storefront and Supabase's phone-OTP auth.
 * Supabase is the sole authority here - it generates the OTP, delivers it
 * through the Send SMS Auth Hook (MSG91 is invoked server-side, from inside
 * that hook, never from the browser), verifies it, and mints the session.
 * Nothing in this file talks to MSG91.
 */

export type PhoneAuthErrorCode =
  | "delivery_failed"
  | "expired_code"
  | "incorrect_code"
  | "invalid_phone"
  | "rate_limited"
  | "unknown";

export class PhoneAuthError extends Error {
  code: PhoneAuthErrorCode;

  constructor(code: PhoneAuthErrorCode, message: string) {
    super(message);
    this.name = "PhoneAuthError";
    this.code = code;
  }
}

function mapAuthError(error: AuthError, stage: "send" | "verify"): PhoneAuthError {
  switch (error.code) {
    case "over_sms_send_rate_limit":
    case "over_request_rate_limit":
      return new PhoneAuthError("rate_limited", "Too many attempts. Please try again shortly.");
    case "validation_failed":
      return new PhoneAuthError("invalid_phone", "Enter a valid phone number.");
    // The Send SMS Hook (and therefore MSG91) failed to deliver - not a
    // problem with what the customer entered.
    case "phone_provider_disabled":
    case "sms_send_failed":
    case "hook_timeout":
    case "hook_timeout_after_retry":
    case "hook_payload_over_size_limit":
    case "hook_payload_invalid_content_type":
      return new PhoneAuthError("delivery_failed", "Could not send a code right now. Please try again.");
    case "otp_expired":
      return new PhoneAuthError("expired_code", "This code has expired. Request a new code to continue.");
    default:
      return stage === "send"
        ? new PhoneAuthError("unknown", "Unable to send a code right now. Please try again.")
        : new PhoneAuthError("incorrect_code", "That code isn't right. Try again.");
  }
}

export async function sendPhoneOtp(phone: PhoneNumber): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw mapAuthError(error, "send");
}

export async function verifyPhoneOtp(phone: PhoneNumber, otp: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.verifyOtp({ phone: toE164(phone), token: otp, type: "sms" });
  if (error) throw mapAuthError(error, "verify");
}
