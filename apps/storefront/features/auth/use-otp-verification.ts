import { useId, useRef } from "react";
import { toMsg91Identifier, type PhoneNumber } from "../../domain/phone";
import { CustomerAuthError, exchangeMsg91AccessToken } from "./api/customer-auth-api";
import { useCustomerSession } from "./customer-session";
import { classifyMsg91VerifyFailure, msg91FailureMessage, type Msg91VerifyFailureReason } from "./msg91/msg91-errors";
import { initializeMsg91Widget, isMsg91Configured, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from "./msg91/msg91-widget";

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
 * The real send/verify/resend state machine behind AuthFlowSheet. Falls back
 * to the original demo timers and magic codes (123456 valid, 000000
 * expired, 999999 rate-limited) whenever VITE_MSG91_WIDGET_ID /
 * VITE_MSG91_TOKEN_AUTH aren't set, so `npm run dev` keeps working for
 * anyone without live MSG91 credentials.
 */
export function useOtpVerification() {
  const captchaContainerId = useId().replace(/[^a-zA-Z0-9_-]/g, "") + "-msg91-captcha";
  const isLiveVerification = isMsg91Configured();
  const widgetInitializedRef = useRef(false);
  const { completeDemoSignIn } = useCustomerSession();

  async function ensureWidgetInitialized() {
    if (widgetInitializedRef.current) return;
    await initializeMsg91Widget({ captchaRenderId: captchaContainerId });
    widgetInitializedRef.current = true;
  }

  async function sendOtp(phone: PhoneNumber) {
    if (!isLiveVerification) {
      await wait(420);
      return;
    }

    await ensureWidgetInitialized();
    await sendMsg91Otp(toMsg91Identifier(phone));
  }

  async function resendOtp(phone: PhoneNumber) {
    if (!isLiveVerification) {
      await wait(420);
      return;
    }

    await ensureWidgetInitialized();
    await retryMsg91Otp();
    void phone; // resend targets whatever identifier the widget was last configured with
  }

  async function verifyOtp(phone: PhoneNumber, otp: string) {
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

  return { captchaContainerId, isLiveVerification, resendOtp, sendOtp, verifyOtp };
}
