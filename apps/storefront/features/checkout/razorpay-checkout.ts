// Thin wrapper around Razorpay's Standard Checkout widget (checkout.js). The
// script is loaded lazily and only once; everything else is a promise-based
// adaptation of the widget's callback API so use-checkout-flow.ts can await
// a single outcome instead of juggling handler/ondismiss/on('payment.failed')
// callbacks itself.
//
// This module only ever sees the PUBLIC checkout key (never a private
// credential) and the provider order id -- both already safe to hand to the
// browser by the time start-online-payment returns them.

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  order_id: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureEvent {
  error?: { description?: string; reason?: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: RazorpayFailureEvent) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payment checkout requires a browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // A failed load must not be cached -- the next attempt (e.g. after the
      // customer's connection recovers) should try loading it again.
      scriptPromise = null;
      reject(new Error("Could not load the payment provider."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type RazorpayCheckoutOutcome =
  | { outcome: "success"; razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }
  | { outcome: "dismissed" }
  | { outcome: "failed"; description?: string };

export interface OpenRazorpayCheckoutArgs {
  checkoutKey: string;
  providerOrderId: string;
  /** Smallest currency sub-unit (paise for INR), as returned by start-online-payment. */
  amount: number;
  currency: string;
  displayName: string;
  customerName?: string;
  customerPhone?: string;
}

/**
 * Opens the Razorpay modal and resolves once the customer reaches an
 * outcome: a signed success payload, an explicit payment failure the widget
 * itself reports, or the modal being dismissed without either. Never
 * rejects for those cases -- only for the checkout.js script itself failing
 * to load, since that is the one outcome the caller cannot recover from by
 * inspecting the resolved value.
 */
export async function openRazorpayCheckout(args: OpenRazorpayCheckoutArgs): Promise<RazorpayCheckoutOutcome> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error("Payment provider script failed to load.");

  return new Promise<RazorpayCheckoutOutcome>((resolve) => {
    let settled = false;
    const settle = (result: RazorpayCheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new window.Razorpay!({
      key: args.checkoutKey,
      amount: args.amount,
      currency: args.currency,
      name: args.displayName,
      order_id: args.providerOrderId,
      prefill: { name: args.customerName, contact: args.customerPhone },
      handler: (response) => {
        settle({
          outcome: "success",
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => settle({ outcome: "dismissed" }),
      },
    });

    instance.on("payment.failed", (response) => {
      settle({ outcome: "failed", description: response.error?.description ?? response.error?.reason });
    });

    instance.open();
  });
}
