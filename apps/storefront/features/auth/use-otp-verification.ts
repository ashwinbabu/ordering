import { useId, useRef, useState } from "react";
import { toMsg91Identifier, type PhoneNumber } from "../../domain/phone";
import { CustomerAuthError, exchangeMsg91AccessToken } from "./api/customer-auth-api";
import { useCustomerSession } from "./customer-session";
import { classifyMsg91VerifyFailure, msg91FailureMessage, type Msg91VerifyFailureReason } from "./msg91/msg91-errors";
import { defaultMsg91WidgetConfig, getMsg91WidgetConfig, initializeMsg91Widget, missingMsg91Config, otpMode, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from "./msg91/msg91-widget";

export class OtpVerifyError extends Error {
  reason: Msg91VerifyFailureReason;

  constructor(reason: Msg91VerifyFailureReason, message: string) {
    super(message);
    this.name = "OtpVerifyError";
    this.reason = reason;
  }
}

const demoOtp = { expired: "000000", rateLimited: "999999", valid: "123456" } as const;

function wait(durationMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, durationMs));
}

function customerAuthErrorToReason(error: CustomerAuthError): Msg91VerifyFailureReason {
  if (error.code === "expired_code") return "expired";
  if (error.code === "rate_limited" || error.code === "replayed_token") return "rate-limited";
  return "incorrect";
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

  async function verifyOtp(phone: PhoneNumber, otp: string) {
    assertConfigured();
    if (!isLiveVerification) {
      await wait(480);
      if (otp === demoOtp.valid) {
        // No real MSG91/Supabase session exists in demo mode - without this,
        // the account screen would wait forever for a customer that never arrives.
        completeDemoSignIn(phone);
        return;
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

    try {
      await exchangeMsg91AccessToken(accessToken);
    } catch (error) {
      if (error instanceof CustomerAuthError) throw new OtpVerifyError(customerAuthErrorToReason(error), error.message);
      throw new OtpVerifyError("incorrect", "Something went wrong. Please try again.");
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
