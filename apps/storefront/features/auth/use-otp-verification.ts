import { useId, useRef, useState } from "react";
import { toMsg91Identifier, type PhoneNumber } from "../../domain/phone";
import { CustomerAuthError, installSupabaseSession, requestMsg91Exchange } from "./api/customer-auth-api";
import { useCustomerSession } from "./customer-session";
import { classifyMsg91VerifyFailure, msg91FailureMessage, type Msg91VerifyFailureReason } from "./msg91/msg91-errors";
import { defaultMsg91WidgetConfig, getMsg91WidgetConfig, initializeMsg91Widget, missingMsg91Config, otpMode, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from "./msg91/msg91-widget";

/**
 * Msg91VerifyFailureReason (from msg91-errors.ts) covers what MSG91's own
 * verifyOtp call can report. "auth-incomplete" is added here because it can
 * only happen *after* MSG91 has already succeeded - the token exchange or
 * Supabase session install failed, not the code itself.
 */
export type AuthFailureReason = Msg91VerifyFailureReason | "auth-incomplete";

export class OtpVerifyError extends Error {
  reason: AuthFailureReason;

  constructor(reason: AuthFailureReason, message: string) {
    super(message);
    this.name = "OtpVerifyError";
    this.reason = reason;
  }
}

const demoOtp = { expired: "000000", rateLimited: "999999", valid: "123456" } as const;

function wait(durationMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
}

/**
 * By the time exchangeMsg91Otp/installSupabaseSession run, MSG91 has already
 * accepted the code - none of these failures mean the digits were wrong, so
 * "incorrect" is deliberately not the default here (contrast
 * classifyMsg91VerifyFailure, which still defaults to "incorrect" because it
 * runs before MSG91 has said anything). "replayed_token" reaches this path
 * when the Edge Function's own replay guard rejects a second exchange for
 * the same MSG91 access token - functionally the same "this reqId is
 * already spent" situation as MSG91's own 703.
 */
function customerAuthErrorToReason(error: CustomerAuthError): AuthFailureReason {
  if (error.code === "expired_code") return "expired";
  if (error.code === "rate_limited") return "rate-limited";
  if (error.code === "replayed_token") return "already-verified";
  if (error.code === "incorrect_code") return "incorrect";
  if (error.code === "network_error" || error.code === "provider_unreachable") return "provider-error";
  return "auth-incomplete";
}

/**
 * The real send/verify/resend state machine behind AuthFlowSheet.
 *
 * Demo mode (magic codes 123456 valid, 000000 expired, 999999 rate-limited)
 * requires VITE_MSG91_DEMO_MODE=true explicitly. Missing MSG91 credentials
 * is an error, not a fallback - quietly pretending to send an SMS makes a
 * broken environment indistinguishable from a working one.
 */
export function useOtpVerification() {
  const captchaContainerId = useId().replace(/[^a-zA-Z0-9_-]/g, "") + "-msg91-captcha";
  const mode = otpMode();
  const isLiveVerification = mode === "live";
  const widgetInitializedRef = useRef(false);
  const { completeDemoSignIn } = useCustomerSession();
  // Dashboard-configured OTP length / resend rules - unknown until the
  // widget has actually loaded, so this starts at the same defaults the
  // app always used and is refreshed once initialization completes.
  const [widgetConfig, setWidgetConfig] = useState(defaultMsg91WidgetConfig);

  function assertConfigured() {
    if (mode !== "unconfigured") return;
    const missing = missingMsg91Config().join(", ");
    console.error(
      `MSG91 is not configured: ${missing} missing from apps/storefront/.env.local. ` +
      "No OTP can be sent. Set VITE_MSG91_DEMO_MODE=true to use offline magic codes instead.",
    );
    throw new OtpVerifyError("incorrect", "Verification is unavailable right now.");
  }

  async function ensureWidgetInitialized() {
    if (widgetInitializedRef.current) return;
    await initializeMsg91Widget({ captchaRenderId: captchaContainerId });
    widgetInitializedRef.current = true;
    setWidgetConfig(getMsg91WidgetConfig());
  }

  async function sendOtp(phone: PhoneNumber) {
    assertConfigured();
    if (!isLiveVerification) {
      await wait(420);
      return;
    }

    await ensureWidgetInitialized();
    await sendMsg91Otp(toMsg91Identifier(phone));
    // getWidgetData() doesn't reliably report the real otpLength/retryTime
    // right when sendOtp first becomes callable - re-reading it now (cheap,
    // no network call) catches the config once MSG91 has actually populated
    // it, instead of leaving the code-entry screen stuck on the defaults.
    setWidgetConfig(getMsg91WidgetConfig());
  }

  async function resendOtp(phone: PhoneNumber) {
    assertConfigured();
    if (!isLiveVerification) {
      await wait(420);
      return;
    }

    await ensureWidgetInitialized();
    await retryMsg91Otp();
    setWidgetConfig(getMsg91WidgetConfig());
    void phone; // resend targets whatever identifier the widget was last configured with
  }

  /**
   * Returns the real core.customers id once the exchange resolves - the
   * edge function already creates/links that row and sets the Supabase
   * session before returning, so this id is immediately usable for
   * customer-scoped writes (e.g. resolveCustomerBusinessId) without waiting
   * on customer-session.tsx's own async reload. Demo mode never mints a
   * real session, so it returns undefined.
   */
  async function verifyOtp(phone: PhoneNumber, otp: string): Promise<string | undefined> {
    assertConfigured();
    if (!isLiveVerification) {
      await wait(480);
      if (otp === demoOtp.valid) {
        // No real MSG91/Supabase session exists in demo mode - without this,
        // the account screen would wait forever for a customer that never arrives.
        completeDemoSignIn(phone);
        return undefined;
      }
      const reason = otp === demoOtp.expired ? "expired" : otp === demoOtp.rateLimited ? "rate-limited" : "incorrect";
      throw new OtpVerifyError(reason, "Demo mode - use 123456, 000000 or 999999.");
    }

    let accessToken: string;
    try {
      accessToken = (await verifyMsg91Otp(otp)).accessToken;
    } catch (error) {
      throw new OtpVerifyError(classifyMsg91VerifyFailure(error), msg91FailureMessage(error));
    }

    // MSG91 has now consumed this reqId. accessToken must never be sent to
    // requestMsg91Exchange more than once (the Edge Function's replay guard
    // burns it on the first accepted call - see the replay-semantics trace).
    let exchanged;
    try {
      exchanged = await requestMsg91Exchange(accessToken);
    } catch (error) {
      if (error instanceof CustomerAuthError) throw new OtpVerifyError(customerAuthErrorToReason(error), error.message);
      throw new OtpVerifyError("auth-incomplete", "Something went wrong finishing sign-in. Please try again.");
    }

    // Unlike the exchange above, installSupabaseSession only adopts tokens
    // we already hold locally - it never re-contacts MSG91 or the Edge
    // Function, so retrying it once with the same `exchanged` result on a
    // transient failure is safe.
    try {
      return (await installSupabaseSession(exchanged)).customerId;
    } catch {
      try {
        return (await installSupabaseSession(exchanged)).customerId;
      } catch (error) {
        if (error instanceof CustomerAuthError) throw new OtpVerifyError(customerAuthErrorToReason(error), error.message);
        throw new OtpVerifyError("auth-incomplete", "Something went wrong finishing sign-in. Please try again.");
      }
    }
  }

  return {
    captchaContainerId,
    isLiveVerification,
    maxResendAttempts: widgetConfig.maxResendAttempts,
    otpLength: widgetConfig.otpLength,
    resendDelaySeconds: widgetConfig.resendDelaySeconds,
    resendOtp,
    sendOtp,
    verifyOtp,
  };
}
