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

