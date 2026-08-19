import { readJson, removeJson, writeJson } from "../../lib/storefront/safe-json-storage";
import type { StorefrontContext } from "../../lib/storefront/storefront-context";

// What persists across a refresh, a browser restart, or a lost response is the
// order's identifier -- never its status. ordering.checkout_cart takes the
// order id from the client and is idempotent on it: replaying the same id
// returns the order that was already created, while a *different* id against
// an already-converted cart raises 'cart is already converted'. So the id has
// to be written before the call goes out, not derived from its response.
//
// Namespaced by business+location for the same reason as the cart pointer: a
// checkout attempt belongs to one outlet and must never surface under another.
interface CheckoutAttempt {
  orderId: string;
  createdAt: string;
  /**
   * Mirrors orderId's own idempotency reasoning, for start-online-payment:
   * ordering.create_payment_attempt/mark_payment_pending are idempotent on
   * this id, so reusing it across a retry or reload reuses the same Razorpay
   * order instead of minting a second one. Absent until the first online
   * payment attempt actually starts (cash orders never set it).
   */
  paymentAttemptId?: string;
}

function isCheckoutAttempt(value: unknown): value is CheckoutAttempt {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { orderId?: unknown; createdAt?: unknown; paymentAttemptId?: unknown };
  if (typeof candidate.orderId !== "string" || typeof candidate.createdAt !== "string") return false;
  return candidate.paymentAttemptId === undefined || typeof candidate.paymentAttemptId === "string";
}

function storageKey(context: StorefrontContext) {
  return `a2-storefront-checkout:${context.businessId}:${context.locationId}`;
}

export function readCheckoutAttempt(context: StorefrontContext): CheckoutAttempt | null {
  return readJson(storageKey(context), isCheckoutAttempt);
}

/**
 * Returns the in-flight attempt's order id, minting and persisting one if this
 * is a fresh checkout. Reusing the stored id is what makes a retry safe.
 */
export function beginCheckoutAttempt(context: StorefrontContext): string {
  const existing = readCheckoutAttempt(context);
  if (existing) return existing.orderId;

  const attempt: CheckoutAttempt = { orderId: window.crypto.randomUUID(), createdAt: new Date().toISOString() };
  writeJson(storageKey(context), attempt);
  return attempt.orderId;
}

/** Called once an order reaches a terminal state, so the next checkout starts a new attempt. */
export function clearCheckoutAttempt(context: StorefrontContext) {
  removeJson(storageKey(context));
}

/**
 * Returns the in-flight attempt's payment attempt id, minting and persisting
 * one on first use. Requires an order attempt to already exist (checkout_cart
 * must have run first) -- falls back to minting one if it somehow doesn't,
 * so this never throws, but that path should be unreachable in practice.
 */
export function beginPaymentAttempt(context: StorefrontContext): string {
  const existing = readCheckoutAttempt(context);
  if (existing?.paymentAttemptId) return existing.paymentAttemptId;

  const paymentAttemptId = window.crypto.randomUUID();
  const attempt: CheckoutAttempt = {
    orderId: existing?.orderId ?? window.crypto.randomUUID(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    paymentAttemptId,
  };
  writeJson(storageKey(context), attempt);
  return paymentAttemptId;
}
