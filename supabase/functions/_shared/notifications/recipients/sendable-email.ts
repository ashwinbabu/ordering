// Single canonical guard for "is this actually an email we should send to".
// The system is phone-first: customers may have a real email, no email, or
// the synthetic `<digits>@auth.invalid` address customer-auth-msg91 writes
// into Supabase Auth during OTP signup. Every recipient resolver must funnel
// through this -- never re-implement the @auth.invalid check inline.

const SYNTHETIC_EMAIL_SUFFIX = "@auth.invalid";

export type SkipReason = "no_email" | "synthetic_email";

export type EmailGuardResult =
  | { sendable: true; address: string }
  | { sendable: false; reason: SkipReason };

export function guardSendableEmail(rawEmail: string | null | undefined): EmailGuardResult {
  const trimmed = rawEmail?.trim();
  if (!trimmed) {
    return { sendable: false, reason: "no_email" };
  }
  if (trimmed.toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    return { sendable: false, reason: "synthetic_email" };
  }
  return { sendable: true, address: trimmed };
}
