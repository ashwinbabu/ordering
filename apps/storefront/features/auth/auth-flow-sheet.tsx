import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  defaultCountryCode,
  defaultCountryIso2,
  isValidPhoneNumber,
  maskPhoneNumber,
  type PhoneNumber,
} from "../../domain/phone";
import { InternationalPhoneField } from "./international-phone-field";
import { OtpInput } from "./otp-input";
import { OtpResendTimer } from "./otp-resend-timer";
import { OtpVerifyError, useOtpVerification } from "./use-otp-verification";

export type AuthContext = "account" | "addresses" | "checkout" | "orders";
type AuthStep = "otp" | "phone";
type AuthRequestState = "idle" | "request-failed" | "sending";
type VerificationState =
  | "auth-incomplete"
  | "expired"
  | "idle"
  | "incorrect"
  | "provider-error"
  | "rate-limited"
  | "verifying";

export interface AuthFlowCopy {
  phoneDescription?: string;
  phoneTitle?: string;
  otpDescription?: string;
  otpTitle?: string;
  verifyLabel?: string;
}

interface AuthFlowBase {
  context: AuthContext;
  copy?: AuthFlowCopy;
  locationPhone?: string | null;
  onCancel?: () => void;
  onSuccess: (phone: PhoneNumber, customerId?: string) => void;
}

export interface PhoneAuthRequest extends AuthFlowBase {
  initialStep?: "phone";
  phone?: PhoneNumber;
}

export interface DirectOtpAuthRequest extends AuthFlowBase {
  initialStep: "otp";
  phone: PhoneNumber;
}

export type AuthFlowRequest = DirectOtpAuthRequest | PhoneAuthRequest;

function defaultCopy(context: AuthContext, otpLength: number): Required<AuthFlowCopy> {
  return {
    phoneDescription:
      context === "account" || context === "orders" || context === "addresses"
        ? "Enter your phone number to view your orders and saved details."
        : "Enter your phone number to continue.",
    phoneTitle: "Welcome",
    otpDescription: `We sent a ${otpLength}-digit code to`,
    otpTitle: context === "checkout" ? "One last step" : "Verify your phone",
    verifyLabel: "Verify & continue",
  };
}

export function AuthFlowSheet({ request }: { request: AuthFlowRequest }) {
  const otpVerification = useOtpVerification();
  const copy = {
    ...defaultCopy(request.context, otpVerification.otpLength),
    ...request.copy,
  };
  const isDirectOtp = request.initialStep === "otp";
  const [step, setStep] = useState<AuthStep>(isDirectOtp ? "otp" : "phone");
  const [phone, setPhone] = useState<PhoneNumber>(
    () =>
      request.phone ?? {
        countryIso2: defaultCountryIso2,
        countryCode: defaultCountryCode,
        phone: "",
      },
  );
  const [phoneError, setPhoneError] = useState<string>();
  const [requestState, setRequestState] = useState<AuthRequestState>(
    isDirectOtp ? "sending" : "idle",
  );
  const [otp, setOtp] = useState("");
  const [verificationState, setVerificationState] =
    useState<VerificationState>("idle");
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(
    otpVerification.resendDelaySeconds,
  );
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const priorFocusRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const previousAutoSubmittedOtpRef = useRef<string | undefined>(undefined);
  const initialSendCancelledRef = useRef(false);
  const verifyLockRef = useRef<string | null>(null);

  const isSending = requestState === "sending";
  const isVerifying = verificationState === "verifying";
  const otpError =
    verificationState === "incorrect"
      ? "That code isn't right. Try again."
      : verificationState === "expired"
        ? "This code has expired. Request a new code to continue."
        : verificationState === "rate-limited"
          ? "Too many attempts. Please try again shortly."
          : verificationState === "provider-error"
            ? "Couldn't reach the verification service. Check your connection and try again."
            : verificationState === "auth-incomplete"
              ? "Something went wrong finishing sign-in. Request a new code to continue."
              : undefined;
  const resendLimitReached = resendAttempts >= otpVerification.maxResendAttempts;

  useEffect(() => {
    if (step !== "otp" || resendRemainingSeconds <= 0) return;
    const timer = window.setInterval(
      () => setResendRemainingSeconds((remaining) => Math.max(0, remaining - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendRemainingSeconds, step]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });

  useEffect(() => () => priorFocusRef.current?.focus(), []);

  useEffect(() => {
    if (!isDirectOtp) return;
    initialSendCancelledRef.current = false;
    otpVerification
      .sendOtp(request.phone)
      .then(() => {
        if (initialSendCancelledRef.current) return;
        setRequestState("idle");
        setResendRemainingSeconds(otpVerification.resendDelaySeconds);
        setResendAttempts(0);
      })
      .catch(() => {
        if (!initialSendCancelledRef.current) setRequestState("request-failed");
      });
    return () => {
      initialSendCancelledRef.current = true;
    };
    // The direct request is intentionally sent once when this sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (isSending || isVerifying || isResending) return;
    request.onCancel?.();
  }

  async function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidPhoneNumber(phone)) {
      setPhoneError("Enter a valid mobile number");
      return;
    }
    setPhoneError(undefined);
    setRequestState("sending");
    try {
      await otpVerification.sendOtp(phone);
      setOtp("");
      previousAutoSubmittedOtpRef.current = undefined;
      setVerificationState("idle");
      setResendRemainingSeconds(otpVerification.resendDelaySeconds);
      setResendAttempts(0);
      setRequestState("idle");
      setStep("otp");
    } catch {
      setRequestState("request-failed");
    }
  }

  const verifyOtp = useCallback(
    async (value: string) => {
      if (value.length !== otpVerification.otpLength || verifyLockRef.current) return;
      verifyLockRef.current = value;
      setVerificationState("verifying");
      try {
        const customerId = await otpVerification.verifyOtp(phone, value);
        request.onSuccess(phone, customerId);
      } catch (error) {
        const reason = error instanceof OtpVerifyError ? error.reason : "incorrect";
        setVerificationState(reason);
        setOtp("");
        previousAutoSubmittedOtpRef.current = undefined;
        if (reason === "auth-incomplete") setResendRemainingSeconds(0);
      } finally {
        verifyLockRef.current = null;
      }
    },
    [otpVerification, phone, request],
  );

  useEffect(() => {
    if (
      step !== "otp" ||
      otp.length !== otpVerification.otpLength ||
      isVerifying ||
      previousAutoSubmittedOtpRef.current === otp
    )
      return;
    previousAutoSubmittedOtpRef.current = otp;
    void verifyOtp(otp);
  }, [isVerifying, otp, otpVerification.otpLength, step, verifyOtp]);

  async function resendOtp() {
    if (resendRemainingSeconds > 0 || isResending || resendLimitReached) return;
    setIsResending(true);
    setResendRemainingSeconds(otpVerification.resendDelaySeconds);
    setResendAttempts((count) => count + 1);
    try {
      await otpVerification.resendOtp(phone);
      setOtp("");
      previousAutoSubmittedOtpRef.current = undefined;
      setVerificationState("idle");
      setRequestState("idle");
    } catch {
      setRequestState("request-failed");
    } finally {
      setIsResending(false);
    }
  }

  function returnToPhone() {
    setOtp("");
    previousAutoSubmittedOtpRef.current = undefined;
    verifyLockRef.current = null;
    setVerificationState("idle");
    setRequestState("idle");
    setStep("phone");
  }

  const isInitialSend = isDirectOtp && step === "otp" && isSending;

  return (
    <div className="sheet-layer auth-sheet-layer" onMouseDown={dismiss} role="presentation">
      <button aria-label="Close verification" className="sheet-scrim" onClick={dismiss} type="button" />
      <section
        aria-describedby={dialogDescriptionId}
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="bottom-sheet auth-sheet"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="auth-sheet__header">
          {step === "otp" ? (
            <button aria-label="Back to phone number" className="icon-button sheet-close" disabled={isVerifying} onClick={returnToPhone} type="button">
              <ArrowLeft aria-hidden="true" size={20} />
            </button>
          ) : <span aria-hidden="true" className="auth-sheet__header-spacer" />}
          <button aria-label="Close verification" className="icon-button sheet-close" disabled={isSending || isVerifying || isResending} onClick={dismiss} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {step === "phone" ? (
          <form className="auth-sheet__body" noValidate onSubmit={submitPhone}>
            <div className="auth-sheet__intro">
              <p className="section-kicker">{request.context === "checkout" ? "Checkout" : "Your details"}</p>
              <h2 id={dialogTitleId}>{copy.phoneTitle}</h2>
              <p id={dialogDescriptionId}>{copy.phoneDescription}</p>
            </div>
            <InternationalPhoneField
              error={phoneError}
              id="auth-phone"
              onChange={(nextPhone) => {
                setPhone(nextPhone);
                setPhoneError(undefined);
              }}
              value={phone}
            />
            {phoneError ? <p className="auth-error" id="auth-phone-error" role="alert">{phoneError}</p> : requestState === "request-failed" ? <p className="auth-error" role="alert">Unable to send a code right now. Please try again.</p> : null}
            <button className="primary-button auth-sheet__primary" disabled={isSending} type="submit">{isSending ? "Sending code…" : "Continue"}</button>
          </form>
        ) : (
          <div className="auth-sheet__body">
            <div className="auth-sheet__intro">
              <p className="section-kicker">{request.context === "checkout" ? "Checkout" : "Your details"}</p>
              <h2 id={dialogTitleId}>{copy.otpTitle}</h2>
              <p id={dialogDescriptionId}>{isInitialSend ? `Sending a ${otpVerification.otpLength}-digit code to ` : copy.otpDescription} <strong>{maskPhoneNumber(phone)}</strong></p>
            </div>
            {isInitialSend ? null : <>
              <OtpInput describedBy={otpError ? "auth-otp-error" : undefined} disabled={isVerifying} hasError={Boolean(otpError)} length={otpVerification.otpLength} onChange={(nextOtp) => { setOtp(nextOtp); if (verificationState !== "idle") setVerificationState("idle"); }} value={otp} />
              {otpError ? <p className="auth-error" id="auth-otp-error" role="alert">{otpError}</p> : requestState === "request-failed" ? <p className="auth-error" role="alert">Unable to send a code right now. Please try again.</p> : null}
              <OtpResendTimer disabled={isVerifying} isResending={isResending} limitReached={resendLimitReached} onResend={resendOtp} remainingSeconds={resendRemainingSeconds} />
              {resendAttempts >= 1 && request.locationPhone ? (
                <a className="text-button auth-sheet__change-phone" href={`tel:${request.locationPhone}`}>
                  Call restaurant for help
                </a>
              ) : null}
              <button className="primary-button auth-sheet__primary" disabled={otp.length !== otpVerification.otpLength || isVerifying} onClick={() => void verifyOtp(otp)} type="button">{isVerifying ? "Verifying…" : copy.verifyLabel}</button>
            </>}
            <button className="text-button auth-sheet__change-phone" disabled={isVerifying || isResending} onClick={returnToPhone} type="button">Change phone number</button>
          </div>
        )}
      </section>
    </div>
  );
}
