/**
 * MSG91's widget failure callback shape isn't documented beyond "handle
 * error" (the integration plan's "Unknown 3"). This maps whatever comes
 * back onto the reasons auth-flow-sheet.tsx has copy for.
 *
 * "already-verified" is distinct from "incorrect": MSG91 code 703 means this
 * reqId was already successfully verified (most often by a near-simultaneous
 * duplicate submit) - the digits the customer typed may well be correct, so
 * telling them the code is wrong is misleading. "provider-error" covers
 * failures to reach MSG91 at all (timeout/network), as opposed to MSG91
 * actively rejecting the code. "incorrect" stays the fallback for anything
 * that doesn't match a more specific signal.
 */
export type Msg91VerifyFailureReason = "already-verified" | "expired" | "incorrect" | "provider-error" | "rate-limited";

function messageFrom(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.type === "string") return record.type;
  }
  return "";
}

/** MSG91's numeric error code, when the failure payload carries one (e.g. `{ code: 703 }`). */
function codeFrom(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.code === "number") return record.code;
  if (typeof record.code === "string" && /^\d+$/.test(record.code)) return Number(record.code);
  return undefined;
}

// MSG91 703: "otp already verifed" (their typo) - this reqId was already consumed.
const alreadyVerifiedCodes = new Set([703]);

export function classifyMsg91VerifyFailure(error: unknown): Msg91VerifyFailureReason {
  const code = codeFrom(error);
  if (code !== undefined && alreadyVerifiedCodes.has(code)) return "already-verified";

  const text = messageFrom(error).toLowerCase();
  if (text.includes("already") && (text.includes("verif") || text.includes("used"))) return "already-verified";
  if (text.includes("expire")) return "expired";
  if (text.includes("limit") || text.includes("attempt") || text.includes("many")) return "rate-limited";
  // MSG91's own failure payloads are plain objects with a message/type/code
  // shape (matched above). A genuine JS Error here means the request never
  // got a real MSG91 response - e.g. withTimeout()'s timeout, or a network
  // failure - not MSG91 rejecting the code.
  if (error instanceof Error) return "provider-error";
  return "incorrect";
}

export function msg91FailureMessage(error: unknown): string {
  const message = messageFrom(error);
  return message || "Something went wrong. Please try again.";
}
