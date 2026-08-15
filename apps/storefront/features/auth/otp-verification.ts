import type { PhoneNumber } from "../../domain/phone";
import { PhoneAuthError, sendPhoneOtp, verifyPhoneOtp } from "./api/phone-auth-api";

/**
 * Translates Supabase's phone-auth errors into the three reasons
 * auth-flow-sheet.tsx already has copy for. This is UI-facing vocabulary,
 * not a second auth authority - the actual decision (expired/incorrect/
 * rate-limited) always comes from Supabase via phone-auth-api.ts.
 */
export type OtpVerifyReason = "expired" | "incorrect" | "rate-limited";

export class OtpVerifyError extends Error {
  reason: OtpVerifyReason;

  constructor(reason: OtpVerifyReason, message: string) {
    super(message);
    this.name = "OtpVerifyError";
    this.reason = reason;
  }
}

function toVerifyReason(error: PhoneAuthError): OtpVerifyReason {
  if (error.code === "expired_code") return "expired";
  if (error.code === "rate_limited") return "rate-limited";
  return "incorrect";
}

export async function sendOtp(phone: PhoneNumber): Promise<void> {
  await sendPhoneOtp(phone);
}

/** Same call as sendOtp - Supabase's own resend/rate-limit is authoritative, there is no separate "retry" endpoint to call. */
export async function resendOtp(phone: PhoneNumber): Promise<void> {
  await sendPhoneOtp(phone);
}

export async function verifyOtp(phone: PhoneNumber, otp: string): Promise<void> {
  try {
    await verifyPhoneOtp(phone, otp);
  } catch (error) {
    if (error instanceof PhoneAuthError) throw new OtpVerifyError(toVerifyReason(error), error.message);
    throw new OtpVerifyError("incorrect", "Something went wrong. Please try again.");
  }
}
