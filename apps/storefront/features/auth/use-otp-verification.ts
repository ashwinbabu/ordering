import { useCustomerSession } from "./customer-session";
import { useState } from "react";
import { toE164, type PhoneNumber } from "../../domain/phone";
import { getSupabaseClient } from "../../lib/supabase/client";

export type AuthFailureReason =
  | "expired"
  | "incorrect"
  | "provider-error"
  | "rate-limited"
  | "auth-incomplete";

export class OtpVerifyError extends Error {
  reason: AuthFailureReason;

  constructor(reason: AuthFailureReason, message: string) {
    super(message);
    this.name = "OtpVerifyError";
    this.reason = reason;
  }
}

function classifyAuthError(error: unknown): AuthFailureReason {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("expired")) return "expired";
  if (message.includes("limit") || message.includes("too many"))
    return "rate-limited";
  if (message.includes("invalid") || message.includes("token"))
    return "incorrect";
  return "provider-error";
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function currentCustomerId() {
  const client = getSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return undefined;
  const { data } = await client
    .schema("core")
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return data?.id;
}

export function useOtpVerification() {
  const { completeDemoSignIn } = useCustomerSession();
  const [isDemoMode] = useState(
    () => String(import.meta.env.VITE_MSG91_DEMO_MODE ?? "").toLowerCase() === "true",
  );
  const otpLength = 6;
  const resendDelaySeconds = 20;
  const maxResendAttempts = 4;

  async function sendOtp(phone: PhoneNumber) {
    const phoneE164 = toE164(phone);
    if (!phoneE164) {
      throw new OtpVerifyError("incorrect", "Enter a valid mobile number.");
    }
    if (isDemoMode) return;

    const { error } = await getSupabaseClient().auth.signInWithOtp({
      phone: phoneE164,
    });
    if (error)
      throw new OtpVerifyError(
        classifyAuthError(error),
        "Unable to send a code right now. Please try again.",
      );
  }

  async function resendOtp(phone: PhoneNumber) {
    return sendOtp(phone);
  }

  async function verifyOtp(phone: PhoneNumber, otp: string) {
    const phoneE164 = toE164(phone);
    if (!phoneE164)
      throw new OtpVerifyError("incorrect", "Enter a valid mobile number.");

    if (isDemoMode) {
      if (otp === "123456") {
        completeDemoSignIn(phone);
        return undefined;
      }
      throw new OtpVerifyError(
        otp === "000000" ? "expired" : "incorrect",
        "That code isn't right. Try again.",
      );
    }

    const { error } = await getSupabaseClient().auth.verifyOtp({
      phone: phoneE164,
      token: otp,
      type: "sms",
    });
    if (error)
      throw new OtpVerifyError(
        classifyAuthError(error),
        messageFor(error, "That code isn't right. Try again."),
      );

    try {
      return await currentCustomerId();
    } catch {
      throw new OtpVerifyError(
        "auth-incomplete",
        "Something went wrong finishing sign-in. Please try again.",
      );
    }
  }

  return {
    maxResendAttempts,
    otpLength,
    resendDelaySeconds,
    resendOtp,
    sendOtp,
    verifyOtp,
  };
}
