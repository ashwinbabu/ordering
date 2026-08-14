import { useEffect, useRef } from "react";

interface OtpInputProps {
  describedBy?: string;
  disabled?: boolean;
  hasError?: boolean;
  onChange: (value: string) => void;
  value: string;
}

const otpLength = 6;

function digitsFrom(value: string) {
  return value.replace(/\D/g, "").slice(0, otpLength);
}

export function OtpInput({ describedBy, disabled = false, hasError = false, onChange, value }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const hasInitialFocusRef = useRef(false);
  const digits = digitsFrom(value);

  useEffect(() => {
    if (hasInitialFocusRef.current) return;
    hasInitialFocusRef.current = true;
    const firstEmptyIndex = Math.min(digits.length, otpLength - 1);
    inputRefs.current[firstEmptyIndex]?.focus();
  }, [digits.length]);

  function focusInput(index: number) {
    requestAnimationFrame(() => inputRefs.current[Math.max(0, Math.min(index, otpLength - 1))]?.focus());
  }

  function replaceFrom(index: number, incomingValue: string) {
    const incomingDigits = digitsFrom(incomingValue);
    if (!incomingDigits) return;

    const nextValue = `${digits.slice(0, index)}${incomingDigits}${digits.slice(index + incomingDigits.length)}`.slice(0, otpLength);
    onChange(nextValue);
    focusInput(Math.min(index + incomingDigits.length, otpLength - 1));
  }

  function clearAt(index: number) {
    onChange(`${digits.slice(0, index)}${digits.slice(index + 1)}`);
  }

  return <div className="otp-input" role="group" aria-label="Six digit verification code" data-error={hasError || undefined}>
    {Array.from({ length: otpLength }, (_, index) => <input
      aria-describedby={describedBy}
      aria-invalid={hasError || undefined}
      aria-label={`Verification code digit ${index + 1} of ${otpLength}`}
      autoComplete={index === 0 ? "one-time-code" : "off"}
      disabled={disabled}
      inputMode="numeric"
      key={index}
      maxLength={otpLength}
      onChange={(event) => replaceFrom(index, event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Backspace") {
          event.preventDefault();
          if (digits[index]) {
            clearAt(index);
          } else if (index > 0) {
            clearAt(index - 1);
            focusInput(index - 1);
          }
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          focusInput(index - 1);
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          focusInput(index + 1);
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        replaceFrom(index, event.clipboardData.getData("text"));
      }}
      pattern="[0-9]*"
      ref={(element) => { inputRefs.current[index] = element; }}
      type="text"
      value={digits[index] ?? ""}
    />)}
  </div>;
}
