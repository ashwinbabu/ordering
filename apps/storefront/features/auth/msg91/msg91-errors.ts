/**
 * MSG91's widget failure callback shape isn't documented beyond "handle
 * error" (the integration plan's "Unknown 3"). This maps whatever comes
 * back onto the reasons auth-flow-sheet.tsx already has copy for, falling
 * back to "incorrect" - the safest default, since it just asks the customer
 * to re-check the code rather than claiming something more specific we
 * can't confirm.
 */
export type Msg91VerifyFailureReason = "expired" | "incorrect" | "rate-limited";

function messageFrom(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.type === "string") return record.type;
  }
  return "";
}

export function classifyMsg91VerifyFailure(error: unknown): Msg91VerifyFailureReason {
  const text = messageFrom(error).toLowerCase();
  if (text.includes("expire")) return "expired";
  if (text.includes("limit") || text.includes("attempt") || text.includes("many")) return "rate-limited";
  return "incorrect";
}

export function msg91FailureMessage(error: unknown): string {
  const message = messageFrom(error);
  return message || "Something went wrong. Please try again.";
}
