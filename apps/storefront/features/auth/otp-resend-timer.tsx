interface OtpResendTimerProps {
  disabled: boolean;
  isResending: boolean;
  limitReached: boolean;
  remainingSeconds: number;
  onResend: () => void;
}

export function OtpResendTimer({ disabled, isResending, limitReached, onResend, remainingSeconds }: OtpResendTimerProps) {
  if (limitReached) {
    return <p className="auth-resend-status" role="alert">You&apos;ve reached the maximum number of resend attempts. Please close this and try again shortly.</p>;
  }

  if (remainingSeconds > 0) {
    return <p className="auth-resend-status" aria-live="polite">Didn&apos;t get the code? Resend in {remainingSeconds}s</p>;
  }

  return <p className="auth-resend-status">Didn&apos;t get the code? <button className="text-button" disabled={disabled || isResending} onClick={onResend} type="button">{isResending ? "Resending…" : "Resend code"}</button></p>;
}
