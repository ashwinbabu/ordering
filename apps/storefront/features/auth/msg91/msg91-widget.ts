// Thin wrapper around MSG91's OTP widget script. The widget forces global
// state onto `window` (sendOtp/verifyOtp/retryOtp/initSendOTP) - this module
// is the one place that touches it, so the rest of the app only sees typed
// promises.
const widgetScriptUrl = "https://verify.msg91.com/otp-provider.js";

const widgetId = import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined;
const tokenAuth = import.meta.env.VITE_MSG91_TOKEN_AUTH as string | undefined;
const demoModeRequested = String(import.meta.env.VITE_MSG91_DEMO_MODE ?? "").toLowerCase() === "true";

/**
 * "live" sends real SMS through MSG91. "demo" is the offline fallback with
 * magic codes, and must be asked for explicitly - it is never what you get
 * by accident. "unconfigured" is a hard error: silently degrading to demo
 * on missing config made a real misconfiguration look like a working send,
 * which is exactly how a broken env went unnoticed.
 */
export type OtpMode = "demo" | "live" | "unconfigured";

export function otpMode(): OtpMode {
  if (widgetId && tokenAuth) return "live";
  if (demoModeRequested) return "demo";
  return "unconfigured";
}

/** Names the specific missing variables so a misconfiguration is self-diagnosing. */
export function missingMsg91Config(): string[] {
  const missing: string[] = [];
  if (!widgetId) missing.push("VITE_MSG91_WIDGET_ID");
  if (!tokenAuth) missing.push("VITE_MSG91_TOKEN_AUTH");
  return missing;
}

interface Msg91Configuration {
  widgetId: string;
  tokenAuth: string;
  identifier?: string;
  exposeMethods: boolean;
  captchaRenderId: string;
  success: (data: unknown) => void;
  failure: (error: unknown) => void;
}

declare global {
  interface Window {
    initSendOTP?: (configuration: Msg91Configuration) => void;
    sendOtp?: (identifier: string, onSuccess?: (data: unknown) => void, onFailure?: (error: unknown) => void) => void;
    verifyOtp?: (otp: string | number, onSuccess?: (data: unknown) => void, onFailure?: (error: unknown) => void, reqId?: string) => void;
    retryOtp?: (channel: string | null, onSuccess?: (data: unknown) => void, onFailure?: (error: unknown) => void, reqId?: string) => void;
    getWidgetData?: () => unknown;
    isCaptchaVerified?: () => boolean;
  }
}

export interface Msg91WidgetConfig {
  /** Digits in the OTP MSG91 actually sends. Dashboard-configurable - do not assume 6. */
  otpLength: number;
  /** Seconds the customer must wait before "Resend" is enabled. */
  resendDelaySeconds: number;
  /** How many times MSG91 will resend before refusing further retries. Infinity when unknown (nothing to cap against). */
  maxResendAttempts: number;
}

/** Used until the widget has loaded (or in demo mode) - matches the app's previous hardcoded behaviour. */
export const defaultMsg91WidgetConfig: Msg91WidgetConfig = {
  otpLength: 6,
  resendDelaySeconds: 24,
  maxResendAttempts: Infinity,
};

/**
 * Reads the widget's dashboard-configured OTP length and resend rules via
 * getWidgetData(). There is no documented schema for this return value, so
 * every field is read defensively and falls back to the previous hardcoded
 * defaults rather than propagating a bad shape into the UI.
 */
export function getMsg91WidgetConfig(): Msg91WidgetConfig {
  if (typeof window.getWidgetData !== "function") return defaultMsg91WidgetConfig;

  try {
    const data = window.getWidgetData() as Record<string, unknown> | undefined;
    if (!data) return defaultMsg91WidgetConfig;

    const otpLength = typeof data.otpLength === "number" && data.otpLength > 0
      ? data.otpLength
      : defaultMsg91WidgetConfig.otpLength;
    const resendDelaySeconds = typeof data.retryTime === "number" && data.retryTime > 0
      ? data.retryTime
      : defaultMsg91WidgetConfig.resendDelaySeconds;
    const maxResendAttempts = typeof data.retryCount === "number" && data.retryCount >= 0
      ? data.retryCount
      : defaultMsg91WidgetConfig.maxResendAttempts;

    return { otpLength, resendDelaySeconds, maxResendAttempts };
  } catch {
    return defaultMsg91WidgetConfig;
  }
}

// Send/verify/retry calls only settle via MSG91's own success/failure
// callbacks - if the widget never calls either (e.g. blocked on an
// unsolved captcha, or a stalled network request) the returned promise
// hangs forever with no way for the UI to recover. This bounds every call.
const requestTimeoutMs = 20000;

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(timeoutMessage)), requestTimeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export class Msg91NotConfiguredError extends Error {
  constructor() {
    super("MSG91 widget is not configured (VITE_MSG91_WIDGET_ID / VITE_MSG91_TOKEN_AUTH missing).");
    this.name = "Msg91NotConfiguredError";
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadWidgetScriptOnce(): Promise<void> {
  if (window.initSendOTP) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = widgetScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Could not load the verification script."));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

// initSendOTP() is fire-and-forget - it kicks off MSG91's own async setup
// (including a third-party fingerprinting script) and returns before
// sendOtp/verifyOtp/retryOtp actually exist on window. There is no
// documented "ready" callback, so this polls for sendOtp to appear rather
// than assuming initSendOTP finishing means the widget is usable.
function waitForWidgetReady(timeoutMs = 8000, intervalMs = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (typeof window.sendOtp === "function") {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("The verification widget did not finish loading. Please try again."));
        return;
      }
      window.setTimeout(check, intervalMs);
    };
    check();
  });
}

/**
 * (Re)configures the widget against a specific captcha container. Call this
 * every time a bottom sheet mounts a fresh captcha element - the previous
 * one may have been unmounted, and the widget renders captcha into it
 * synchronously as part of this call.
 */
export async function initializeMsg91Widget(options: { captchaRenderId: string; identifier?: string }): Promise<void> {
  if (!widgetId || !tokenAuth) throw new Msg91NotConfiguredError();

  await loadWidgetScriptOnce();

  window.initSendOTP!({
    widgetId,
    tokenAuth,
    identifier: options.identifier,
    exposeMethods: true,
    captchaRenderId: options.captchaRenderId,
    // Listening to verifyOtp's own success/failure below instead - MSG91's
    // docs warn that also handling these produces duplicate events.
    success: () => {},
    failure: () => {},
  });

  await waitForWidgetReady();
}

// StrictMode-safe: an effect that calls sendMsg91Otp on mount fires twice in
// dev. This collapses an immediate repeat for the same identifier into one
// real send rather than two SMS.
let lastSendIdentifier: string | null = null;
let lastSendAt = 0;
const sendDedupeWindowMs = 2000;

export function sendMsg91Otp(identifier: string): Promise<void> {
  const now = Date.now();
  if (lastSendIdentifier === identifier && now - lastSendAt < sendDedupeWindowMs) {
    return Promise.resolve();
  }
  lastSendIdentifier = identifier;
  lastSendAt = now;

  return withTimeout(
    new Promise((resolve, reject) => {
      window.sendOtp!(identifier, () => resolve(), (error) => reject(error));
    }),
    "Could not send the code. Please try again.",
  );
}

export interface Msg91VerifiedToken {
  accessToken: string;
}

/**
 * Whatever field carries the access token in verifyOtp's success payload is
 * unconfirmed against a real MSG91 account (see the integration plan,
 * "Unknown 2"). This accepts a bare string or the handful of plausible
 * object shapes - tighten it once a real response has been captured.
 */
function extractAccessToken(data: unknown): string | null {
  if (typeof data === "string" && data.length > 0) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["message", "access-token", "accessToken", "token"]) {
      const value = record[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return null;
}

export function verifyMsg91Otp(otp: string): Promise<Msg91VerifiedToken> {
  return withTimeout(
    new Promise((resolve, reject) => {
      window.verifyOtp!(
        otp,
        (data) => {
          const accessToken = extractAccessToken(data);
          if (accessToken) resolve({ accessToken });
          else reject(new Error("MSG91 did not return an access token."));
        },
        (error) => reject(error),
      );
    }),
    "Could not verify the code. Please try again.",
  );
}

// MSG91 retryOtp channel codes: SMS='11', Voice='4', Email='3', WhatsApp='12'.
// `null` is only valid when the widget is left on its default configuration;
// a custom configuration (ours) rejects null with "Channel not provided in
// retryOtp() method." - this integration is SMS-only, so SMS is hardcoded.
const smsRetryChannel = "11";

export function retryMsg91Otp(): Promise<void> {
  return withTimeout(
    new Promise((resolve, reject) => {
      window.retryOtp!(smsRetryChannel, () => resolve(), (error) => reject(error));
    }),
    "Could not resend the code. Please try again.",
  );
}
