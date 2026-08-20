"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { isAuthApiError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type ScreenStatus = "checking" | "ready" | "invalid" | "success";

function describeResetError(error: unknown): string {
  if (isAuthApiError(error)) {
    if (error.code === "weak_password") {
      // Surfaced verbatim: this message already reflects the Supabase
      // project's configured password policy.
      return error.message;
    }
    if (error.code === "same_password") {
      return "Your new password must be different from your current password.";
    }
    if (error.code === "session_not_found" || error.code === "session_expired") {
      return "This reset link is invalid or has expired. Request a new one.";
    }
  }
  return "Unable to reset your password. Please try again.";
}

export function ResetPasswordScreen() {
  const [status, setStatus] = useState<ScreenStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setStatus(!sessionError && data.session ? "ready" : "invalid");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === "SIGNED_OUT") return;
      setStatus((current) => {
        if (current === "success") return current;
        return session ? "ready" : "invalid";
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setStatus("success");
      await supabase.auth.signOut();
      window.setTimeout(() => {
        window.location.assign("/");
      }, 1800);
    } catch (err) {
      if (
        isAuthApiError(err) &&
        (err.code === "session_not_found" || err.code === "session_expired")
      ) {
        setStatus("invalid");
      } else {
        setError(describeResetError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return <main className="login-page" aria-label="Checking your reset link" />;
  }

  if (status === "invalid") {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="reset-title">
          <div className="brand-lockup login-brand">
            <span className="brand-mark">A2</span>
            <span>A2</span>
          </div>
          <div className="login-heading">
            <h1 id="reset-title">Reset link invalid</h1>
            <p>This password reset link is invalid or has expired.</p>
          </div>
          <p className="neutral-message" role="status">
            Request a new reset link from the sign-in screen.
          </p>
          <button
            type="button"
            className="primary-button auth-submit"
            onClick={() => window.location.assign("/")}
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="login-page">
        <section className="login-card" aria-labelledby="reset-title">
          <div className="brand-lockup login-brand">
            <span className="brand-mark">A2</span>
            <span>A2</span>
          </div>
          <div className="login-heading">
            <h1 id="reset-title">Password updated</h1>
            <p>Sign in again with your new password.</p>
          </div>
          <p className="neutral-message" role="status">
            Redirecting you to sign in…
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="reset-title">
        <div className="brand-lockup login-brand">
          <span className="brand-mark">A2</span>
          <span>A2</span>
        </div>
        <div className="login-heading">
          <h1 id="reset-title">Set a new password</h1>
          <p>Choose a new password for your account.</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field-label">
            New password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Enter a new password"
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className="field-label">
            Confirm password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter the new password"
              aria-invalid={Boolean(error)}
            />
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}
            Update password
          </button>
        </form>
      </section>
    </main>
  );
}
