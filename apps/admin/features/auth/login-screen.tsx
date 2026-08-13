"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function LoginScreen() {
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phoneStep, setPhoneStep] = useState<"number" | "otp">("number");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(28);

  useEffect(() => {
    if (phoneStep !== "otp" || resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [phoneStep, resendSeconds]);

  function phoneE164() {
    return `+91${phone.replace(/\D/g, "")}`;
  }

  async function sendPhoneOtp() {
    const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164() });
    if (error) throw error;
    setPhoneStep("otp");
    setResendSeconds(28);
  }

  async function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    if (phoneStep === "number") {
      if (phone.replace(/\D/g, "").length < 10) {
        setError("Enter a valid 10-digit mobile number.");
        return;
      }
    }
    if (phoneStep === "otp" && !/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (phoneStep === "number") await sendPhoneOtp();
      else {
        const { error } = await supabase.auth.verifyOtp({ phone: phoneE164(), token: otp, type: "sms" });
        if (error) throw error;
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 4) {
      setError("Check your email and password, then try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendPhoneOtp() {
    setBusy(true);
    setError("");
    try {
      await sendPhoneOtp();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send a new code.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!email.includes("@")) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setError("If this account exists, reset instructions have been sent.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to send reset instructions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-lockup login-brand">
          <span className="brand-mark">A2</span>
          <span>A2</span>
        </div>
        <div className="login-heading">
          <h1 id="login-title">Sign in to A2</h1>
          <p>Manage orders and your menu.</p>
        </div>

        <div className="segmented" role="tablist" aria-label="Sign in method">
          <button
            className={method === "phone" ? "active" : ""}
            onClick={() => {
              setMethod("phone");
              setError("");
            }}
            role="tab"
            aria-selected={method === "phone"}
          >
            Phone & OTP
          </button>
          <button
            className={method === "email" ? "active" : ""}
            onClick={() => {
              setMethod("email");
              setError("");
            }}
            role="tab"
            aria-selected={method === "email"}
          >
            Email & password
          </button>
        </div>

        {method === "phone" ? (
          <form onSubmit={submitPhone} className="auth-form">
            {phoneStep === "number" ? (
              <label className="field-label">
                Mobile number
                <span className="phone-input">
                  <span>+91</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(error)}
                  />
                </span>
              </label>
            ) : (
              <>
                <div className="otp-sent-row">
                  <span>Code sent to +91 {phone}</span>
                  <button type="button" className="text-button" onClick={() => setPhoneStep("number")}>
                    Edit
                  </button>
                </div>
                <label className="field-label">
                  6-digit code
                  <input
                    className="otp-input"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="• • • • • •"
                    aria-invalid={Boolean(error)}
                  />
                </label>
                <button
                  type="button"
                  className="resend-button"
                  disabled={resendSeconds > 0 || busy}
                  onClick={() => { void resendPhoneOtp(); }}
                >
                  {resendSeconds > 0 ? `Resend in 00:${String(resendSeconds).padStart(2, "0")}` : "Resend code"}
                </button>
              </>
            )}
            {error && <p className="field-error" role="alert">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {phoneStep === "number" ? "Send code" : "Verify & sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitEmail} className="auth-form">
            <label className="field-label">
              Email address
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
            </label>
            <label className="field-label">
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
            </label>
            <button type="button" className="text-button forgot-button" disabled={busy} onClick={() => { void sendPasswordReset(); }}>
              Forgot password?
            </button>
            {error && <p className="neutral-message" role="status">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              Sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
