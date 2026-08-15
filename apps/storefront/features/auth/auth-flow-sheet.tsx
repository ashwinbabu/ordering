import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { defaultCountryCode, formatPhoneForInput, isValidPhoneNumber, maskPhoneNumber, normalizePhoneInput, type PhoneNumber } from "../../domain/phone";
import { OtpInput } from "./otp-input";
import { OtpResendTimer } from "./otp-resend-timer";
import { OtpVerifyError, resendOtp as resendOtpRequest, sendOtp as sendOtpRequest, verifyOtp as verifyOtpRequest } from "./otp-verification";

export type AuthContext = "account" | "addresses" | "checkout" | "orders";
type AuthStep = "otp" | "phone";
type AuthRequestState = "idle" | "request-failed" | "sending";
type VerificationState = "expired" | "idle" | "incorrect" | "rate-limited" | "verifying";

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
  onSuccess: (phone: PhoneNumber) => void;
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

const resendDelaySeconds = 24;

function defaultCopy(context: AuthContext): Required<AuthFlowCopy> {
  return {
    phoneDescription: context === "account" || context === "orders" || context === "addresses"
      ? "Enter your phone number to view your orders and saved details."
      : "Enter your phone number to continue.",
    phoneTitle: "Welcome",
    otpDescription: "We sent a 6-digit code to",
    otpTitle: context === "checkout" ? "One last step" : "Verify your phone",
    verifyLabel: "Verify & continue",
  };
}

export function AuthFlowSheet({ request }: { request: AuthFlowRequest }) {
  const copy = { ...defaultCopy(request.context), ...request.copy };
  const isDirectOtp = request.initialStep === "otp";
  const [step, setStep] = useState<AuthStep>(isDirectOtp ? "otp" : "phone");
  const [phone, setPhone] = useState<PhoneNumber>(() => request.phone ?? { countryCode: defaultCountryCode, phone: "" });
  const [phoneError, setPhoneError] = useState<string>();
  const [requestState, setRequestState] = useState<AuthRequestState>(isDirectOtp ? "sending" : "idle");
  const [otp, setOtp] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState>("idle");
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(resendDelaySeconds);
  const [isResending, setIsResending] = useState(false);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const priorFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const previousAutoSubmittedOtpRef = useRef<string | undefined>(undefined);
  const initialSendCancelledRef = useRef(false);

  const isSending = requestState === "sending";
  const isVerifying = verificationState === "verifying";
  const otpError = verificationState === "incorrect" ? "That code isn't right. Try again." : verificationState === "expired" ? "This code has expired. Request a new code to continue." : verificationState === "rate-limited" ? "Too many attempts. Please try again shortly." : undefined;

  useEffect(() => {
    if (step !== "otp" || resendRemainingSeconds <= 0) return;
    const timer = window.setInterval(() => setResendRemainingSeconds((remaining) => Math.max(0, remaining - 1)), 1000);
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
    sendOtpRequest(request.phone).then(() => {
      if (initialSendCancelledRef.current) return;
      setRequestState("idle");
      setResendRemainingSeconds(resendDelaySeconds);
    }).catch(() => {
      if (initialSendCancelledRef.current) return;
      setRequestState("request-failed");
    });
    return () => { initialSendCancelledRef.current = true; };
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
      await sendOtpRequest(phone);
      setOtp("");
      previousAutoSubmittedOtpRef.current = undefined;
      setVerificationState("idle");
      setResendRemainingSeconds(resendDelaySeconds);
      setRequestState("idle");
      setStep("otp");
    } catch {
      setRequestState("request-failed");
    }
  }

  const verifyOtp = useCallback(async (value: string) => {
    if (value.length !== 6 || isVerifying) return;

    setVerificationState("verifying");
    try {
      await verifyOtpRequest(phone, value);
      request.onSuccess(phone);
    } catch (error) {
      const reason = error instanceof OtpVerifyError ? error.reason : "incorrect";
      setVerificationState(reason === "expired" ? "expired" : reason === "rate-limited" ? "rate-limited" : "incorrect");
    }
  }, [isVerifying, phone, request]);

  useEffect(() => {
    if (step !== "otp" || otp.length !== 6 || isVerifying || previousAutoSubmittedOtpRef.current === otp) return;
    previousAutoSubmittedOtpRef.current = otp;
    verifyOtp(otp);
  }, [isVerifying, otp, step, verifyOtp]);

  async function resendOtp() {
    if (resendRemainingSeconds > 0 || isResending) return;
    setIsResending(true);
    try {
      await resendOtpRequest(phone);
      setOtp("");
      previousAutoSubmittedOtpRef.current = undefined;
      setVerificationState("idle");
      setResendRemainingSeconds(resendDelaySeconds);
    } finally {
      setIsResending(false);
    }
  }

  function returnToPhone() {
    initialSendCancelledRef.current = true;
    setOtp("");
    previousAutoSubmittedOtpRef.current = undefined;
    setVerificationState("idle");
    setRequestState("idle");
    setStep("phone");
  }

  const isInitialSend = isDirectOtp && step === "otp" && isSending;

  return <div className="sheet-layer auth-sheet-layer" onMouseDown={dismiss} role="presentation">
    <button aria-label="Close verification" className="sheet-scrim" onClick={dismiss} type="button" />
    <section aria-describedby={dialogDescriptionId} aria-labelledby={dialogTitleId} aria-modal="true" className="bottom-sheet auth-sheet" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <div className="auth-sheet__header">
        {step === "otp" ? <button aria-label="Back to phone number" className="icon-button sheet-close" disabled={isVerifying} onClick={returnToPhone} type="button"><ArrowLeft aria-hidden="true" size={20} /></button> : <span aria-hidden="true" className="auth-sheet__header-spacer" />}
        <button aria-label="Close verification" className="icon-button sheet-close" disabled={isSending || isVerifying || isResending} onClick={dismiss} type="button"><X aria-hidden="true" size={20} /></button>
      </div>

      {step === "phone" ? <form className="auth-sheet__body" noValidate onSubmit={submitPhone}>
        <div className="auth-sheet__intro"><p className="section-kicker">{request.context === "checkout" ? "Checkout" : "Your details"}</p><h2 id={dialogTitleId}>{copy.phoneTitle}</h2><p id={dialogDescriptionId}>{copy.phoneDescription}</p></div>
        <label className="form-field" htmlFor="auth-phone"><span>Phone number</span><div className="phone-input" data-error={phoneError ? "true" : undefined}><span>{phone.countryCode}</span><input aria-describedby={phoneError ? "auth-phone-error" : undefined} aria-invalid={Boolean(phoneError)} autoComplete="tel" id="auth-phone" inputMode="numeric" onChange={(event) => { setPhone((current) => ({ ...current, phone: normalizePhoneInput(event.target.value, current.countryCode) })); setPhoneError(undefined); }} placeholder="98765 43210" value={formatPhoneForInput(phone.phone)} /></div></label>
        {phoneError ? <p className="auth-error" id="auth-phone-error" role="alert">{phoneError}</p> : requestState === "request-failed" ? <p className="auth-error" role="alert">Unable to send a code right now. Please try again.</p> : null}
        <button className="primary-button auth-sheet__primary" disabled={isSending} type="submit">{isSending ? "Sending code…" : "Continue"}</button>
      </form> : <div className="auth-sheet__body">
        <div className="auth-sheet__intro"><p className="section-kicker">{request.context === "checkout" ? "Checkout" : "Your details"}</p><h2 id={dialogTitleId}>{copy.otpTitle}</h2><p id={dialogDescriptionId}>{isInitialSend ? "Sending a 6-digit code to " : copy.otpDescription}<strong>{maskPhoneNumber(phone)}</strong></p></div>
        {isInitialSend ? null : <>
          <OtpInput describedBy={otpError ? "auth-otp-error" : undefined} disabled={isVerifying} hasError={Boolean(otpError)} onChange={(nextOtp) => { if (nextOtp !== otp) previousAutoSubmittedOtpRef.current = undefined; setOtp(nextOtp); if (verificationState !== "idle") setVerificationState("idle"); }} value={otp} />
          {otpError ? <p className="auth-error" id="auth-otp-error" role="alert">{otpError}</p> : requestState === "request-failed" ? <p className="auth-error" role="alert">Unable to send a code right now. Please try again.</p> : null}
          <OtpResendTimer disabled={isVerifying} isResending={isResending} onResend={resendOtp} remainingSeconds={resendRemainingSeconds} />
          <button className="primary-button auth-sheet__primary" disabled={otp.length !== 6 || isVerifying} onClick={() => verifyOtp(otp)} type="button">{isVerifying ? "Verifying…" : copy.verifyLabel}</button>
        </>}
        <button className="text-button auth-sheet__change-phone" disabled={isVerifying || isResending} onClick={returnToPhone} type="button">Change phone number</button>
      </div>}
    </section>
  </div>;
}
