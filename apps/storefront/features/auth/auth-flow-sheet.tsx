import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  defaultCountryCode,
  formatPhoneForInput,
  isValidPhoneNumber,
  maskPhoneNumber,
  normalizePhoneInput,
  type PhoneNumber,
} from "../../domain/phone";
import { OtpInput } from "./otp-input";
import { OtpResendTimer } from "./otp-resend-timer";
import { OtpVerifyError, useOtpVerification } from "./use-otp-verification";

export type AuthContext = "account" | "addresses" | "checkout" | "orders";
type AuthStep = "otp" | "phone";
type AuthRequestState = "idle" | "request-failed" | "sending";
type VerificationState =
  | "already-verified"
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
  onCancel?: () => void;
  /** customerId is the real core.customers id once a live session exists - undefined in demo mode. */
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

function defaultCopy(
  context: AuthContext,
  otpLength: number,
): Required<AuthFlowCopy> {
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
  // Called first: its returned otpLength/resendDelaySeconds seed several of
  // the useState calls below.
  const otpVerification = useOtpVerification();
  const copy = {
    ...defaultCopy(request.context, otpVerification.otpLength),
    ...request.copy,
  };
  const isDirectOtp = request.initialStep === "otp";
  const [step, setStep] = useState<AuthStep>(isDirectOtp ? "otp" : "phone");
  const [phone, setPhone] = useState<PhoneNumber>(
    () => request.phone ?? { countryCode: defaultCountryCode, phone: "" },
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
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const previousAutoSubmittedOtpRef = useRef<string | undefined>(undefined);
  const initialSendCancelledRef = useRef(false);
  // Set when MSG91 already succeeded but a later stage (token exchange)
  // failed - the current reqId is spent, and re-verifying it (whether via
  // auto-submit or the button) would only replay the same failure or a 703
  // from MSG91. While true, the OTP step is locked: no digits can be typed
  // and "Verify & continue" cannot be pressed. Only a fresh reqId (Resend,
  // or a new phone number) clears it - see resendOtp/returnToPhone below.
  const [requestConsumed, setRequestConsumed] = useState(false);
  // Synchronous mutual-exclusion guard for the shared verify entry point
  // below. Holds the OTP value of the currently in-flight verification
  // pipeline (MSG91 verifyOtp -> token exchange -> Supabase session
  // install), or null when none is active. Checked and set before the first
  // await, so - unlike `isVerifying` React state, which only reflects
  // reality once a render commits - a second trigger (the auto-submit
  // effect and a manual click both landing on the same OTP entry) can never
  // slip through the gap between "6th digit committed" and "verifying state
  // rendered". Cleared in `finally` so it can never outlive one attempt.
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
          : verificationState === "already-verified"
            ? 'This code has already been used. Tap "Resend code" to get a new one.'
            : verificationState === "provider-error"
              ? "Couldn't reach the verification service. Check your connection and try again."
              : verificationState === "auth-incomplete"
                ? "Something went wrong finishing sign-in. Request a new code to continue."
                : undefined;
  const resendLimitReached =
    resendAttempts >= otpVerification.maxResendAttempts;

  useEffect(() => {
    if (step !== "otp" || resendRemainingSeconds <= 0) return;
    const timer = window.setInterval(
      () =>
        setResendRemainingSeconds((remaining) => Math.max(0, remaining - 1)),
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

  // Checkout opens straight on the code step - nothing has been sent yet, so send it now.
  useEffect(() => {
    if (!isDirectOtp) return;
    // Reset (not just set) on every invocation: StrictMode double-invokes this
    // effect (mount -> cleanup -> mount), and without resetting here, the
    // first invocation's cleanup would permanently poison the ref before the
    // second, real invocation's promise ever resolves.
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
        if (initialSendCancelledRef.current) return;
        setRequestState("request-failed");
      });
    return () => {
      initialSendCancelledRef.current = true;
    };
    // Runs once for the initial send this sheet was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    if (isSending || isVerifying || isResending) return;
    request.onCancel?.();
  }

  async function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidPhoneNumber(phone)) {
      setPhoneError("Enter a valid 10-digit mobile number");
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
      // A fresh send just minted a new reqId - any earlier lock is stale.
      setRequestConsumed(false);
      setStep("otp");
    } catch {
      setRequestState("request-failed");
    }
  }

  const verifyOtp = useCallback(
    async (value: string) => {
      if (value.length !== otpVerification.otpLength) return;
      // MSG91 already succeeded and burned this reqId once (see the
      // auth-incomplete branch below) - refuse to verify again no matter what
      // called this, not just via the disabled button/input. The UI disabling
      // is a courtesy; this is the actual guarantee.
      if (requestConsumed) return;
      // One MSG91 reqId may have at most one active verification pipeline.
      // This check-and-set is synchronous, so it closes the window (between
      // the 6th digit committing and `verifying` state actually rendering)
      // where both the auto-submit effect and a manual click could otherwise
      // both pass this guard and each call MSG91 verifyOtp for the same code.
      if (verifyLockRef.current !== null) return;
      verifyLockRef.current = value;

      setVerificationState("verifying");
      try {
        const customerId = await otpVerification.verifyOtp(phone, value);
        request.onSuccess(phone, customerId);
      } catch (error) {
        const reason =
          error instanceof OtpVerifyError ? error.reason : "incorrect";
        setVerificationState(reason);
        if (reason === "already-verified") {
          // This reqId is already spent - re-submitting the same digits would
          // just hit MSG91 again and get the same rejection. Clear the stale
          // code and unblock "Resend code" immediately (instead of leaving it
          // on the normal cooldown) so the customer's next action is getting a
          // fresh reqId, not retrying the consumed one.
          setOtp("");
          previousAutoSubmittedOtpRef.current = undefined;
          setResendRemainingSeconds(0);
        } else if (reason === "auth-incomplete") {
          // MSG91 already succeeded for this reqId before the exchange failed
          // downstream - MSG91 verification must not become the retry
          // mechanism for that failure. Unlike "already-verified" above,
          // clearing the digits isn't enough on its own (the customer could
          // just retype them and auto-submit would fire again against the
          // same reqId), so this hard-locks the step: no typing, no Verify,
          // until requestConsumed is cleared by a fresh reqId.
          setOtp("");
          previousAutoSubmittedOtpRef.current = undefined;
          setResendRemainingSeconds(0);
          setRequestConsumed(true);
        }
      } finally {
        // Only clear if this call still owns the lock - a stale finally from
        // an attempt that already lost the lock (shouldn't happen given the
        // guard above, but keeps this robust) must not clear a newer one.
        if (verifyLockRef.current === value) verifyLockRef.current = null;
      }
    },
    [otpVerification, phone, request, requestConsumed],
  );

  useEffect(() => {
    if (
      step !== "otp" ||
      otp.length !== otpVerification.otpLength ||
      isVerifying ||
      requestConsumed ||
      previousAutoSubmittedOtpRef.current === otp
    )
      return;
    previousAutoSubmittedOtpRef.current = otp;
    verifyOtp(otp);
  }, [
    isVerifying,
    otp,
    otpVerification.otpLength,
    requestConsumed,
    step,
    verifyOtp,
  ]);

  async function resendOtp() {
    if (resendRemainingSeconds > 0 || isResending || resendLimitReached) return;
    // A fresh reqId is about to replace whatever the lock was tracking (the
    // resend button is disabled while isVerifying anyway, so this is
    // defensive, not load-bearing).
    verifyLockRef.current = null;
    setIsResending(true);
    // Started unconditionally, before we know the outcome: a resend that
    // keeps failing (e.g. a transport/config error) must not let the
    // customer hammer the button in a retry storm.
    setResendRemainingSeconds(otpVerification.resendDelaySeconds);
    setResendAttempts((count) => count + 1);
    try {
      await otpVerification.resendOtp(phone);
      setOtp("");
      previousAutoSubmittedOtpRef.current = undefined;
      setVerificationState("idle");
      setRequestState("idle");
      // Only now is there actually a new reqId to verify against - a failed
      // resend leaves whatever reqId MSG91 already had, so requestConsumed
      // must not clear until the resend itself has succeeded.
      setRequestConsumed(false);
    } catch (error) {
      console.error("Resend failed", error);
      setRequestState("request-failed");
    } finally {
      setIsResending(false);
    }
  }

  function returnToPhone() {
    initialSendCancelledRef.current = true;
    setOtp("");
    previousAutoSubmittedOtpRef.current = undefined;
    // Defensive, like resendOtp's reset above: "Change phone number" is also
    // disabled while isVerifying, but a new phone number means any locked
    // reqId no longer applies.
    verifyLockRef.current = null;
    setRequestConsumed(false);
    setVerificationState("idle");
    setRequestState("idle");
    setStep("phone");
  }

  const isInitialSend = isDirectOtp && step === "otp" && isSending;

  return (
    <div
      className="sheet-layer auth-sheet-layer"
      onMouseDown={dismiss}
      role="presentation"
    >
      <button
        aria-label="Close verification"
        className="sheet-scrim"
        onClick={dismiss}
        type="button"
      />
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
            <button
              aria-label="Back to phone number"
              className="icon-button sheet-close"
              disabled={isVerifying}
              onClick={returnToPhone}
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={20} />
            </button>
          ) : (
            <span aria-hidden="true" className="auth-sheet__header-spacer" />
          )}
          <button
            aria-label="Close verification"
            className="icon-button sheet-close"
            disabled={isSending || isVerifying || isResending}
            onClick={dismiss}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {/* Stable across phone/otp step switches so MSG91 never renders captcha into a node that then unmounts. */}
        <div
          id={otpVerification.captchaContainerId}
          aria-label="Verification challenge"
        />

        {step === "phone" ? (
          <form className="auth-sheet__body" noValidate onSubmit={submitPhone}>
            <div className="auth-sheet__intro">
              <p className="section-kicker">
                {request.context === "checkout" ? "Checkout" : "Your details"}
              </p>
              <h2 id={dialogTitleId}>{copy.phoneTitle}</h2>
              <p id={dialogDescriptionId}>{copy.phoneDescription}</p>
            </div>
            <label className="form-field" htmlFor="auth-phone">
              <span>Phone number</span>
              <div
                className="phone-input"
                data-error={phoneError ? "true" : undefined}
              >
                <span>{phone.countryCode}</span>
                <input
                  aria-describedby={phoneError ? "auth-phone-error" : undefined}
                  aria-invalid={Boolean(phoneError)}
                  autoComplete="tel"
                  id="auth-phone"
                  inputMode="numeric"
                  onChange={(event) => {
                    setPhone((current) => ({
                      ...current,
                      phone: normalizePhoneInput(
                        event.target.value,
                        current.countryCode,
                      ),
                    }));
                    setPhoneError(undefined);
                  }}
                  placeholder="98765 43210"
                  value={formatPhoneForInput(phone.phone)}
                />
              </div>
            </label>
            {phoneError ? (
              <p className="auth-error" id="auth-phone-error" role="alert">
                {phoneError}
              </p>
            ) : requestState === "request-failed" ? (
              <p className="auth-error" role="alert">
                Unable to send a code right now. Please try again.
              </p>
            ) : null}
            <button
              className="primary-button auth-sheet__primary"
              disabled={isSending}
              type="submit"
            >
              {isSending ? "Sending code…" : "Continue"}
            </button>
          </form>
        ) : (
          <div className="auth-sheet__body">
            <div className="auth-sheet__intro">
              <p className="section-kicker">
                {request.context === "checkout" ? "Checkout" : "Your details"}
              </p>
              <h2 id={dialogTitleId}>{copy.otpTitle}</h2>
              <p id={dialogDescriptionId}>
                {isInitialSend
                  ? `Sending a ${otpVerification.otpLength}-digit code to `
                  : copy.otpDescription}
                <strong>{maskPhoneNumber(phone)}</strong>
              </p>
            </div>
            {isInitialSend ? null : (
              <>
                <OtpInput
                  describedBy={otpError ? "auth-otp-error" : undefined}
                  disabled={isVerifying || requestConsumed}
                  hasError={Boolean(otpError)}
                  length={otpVerification.otpLength}
                  onChange={(nextOtp) => {
                    if (nextOtp !== otp)
                      previousAutoSubmittedOtpRef.current = undefined;
                    setOtp(nextOtp);
                    if (verificationState !== "idle")
                      setVerificationState("idle");
                  }}
                  value={otp}
                />
                {otpError ? (
                  <p className="auth-error" id="auth-otp-error" role="alert">
                    {otpError}
                  </p>
                ) : requestState === "request-failed" ? (
                  <p className="auth-error" role="alert">
                    Unable to send a code right now. Please try again.
                  </p>
                ) : null}
                <OtpResendTimer
                  disabled={isVerifying}
                  isResending={isResending}
                  limitReached={resendLimitReached}
                  onResend={resendOtp}
                  remainingSeconds={resendRemainingSeconds}
                />
                <button
                  className="primary-button auth-sheet__primary"
                  disabled={
                    requestConsumed ||
                    otp.length !== otpVerification.otpLength ||
                    isVerifying
                  }
                  onClick={() => verifyOtp(otp)}
                  type="button"
                >
                  {isVerifying ? "Verifying…" : copy.verifyLabel}
                </button>
              </>
            )}
            <button
              className="text-button auth-sheet__change-phone"
              disabled={isVerifying || isResending}
              onClick={returnToPhone}
              type="button"
            >
              Change phone number
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
