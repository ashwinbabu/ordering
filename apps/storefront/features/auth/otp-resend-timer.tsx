interface OtpResendTimerProps {
  disabled: boolean;
  isResending: boolean;
  remainingSeconds: number;
  onResend: () => void;
}

export function OtpResendTimer({ disabled, isResending, onResend, remainingSeconds }: OtpResendTimerProps) {
  if (remainingSeconds > 0) {
    return <p className="auth-resend-status" aria-live="polite">Didn&apos;t get the code? Resend in {remainingSeconds}s</p>;
  }

  return <p className="auth-resend-status">Didn&apos;t get the code? <button className="text-button" disabled={disabled || isResending} onClick={onResend} type="button">{isResending ? "Resending…" : "Resend code"}</button></p>;
}
