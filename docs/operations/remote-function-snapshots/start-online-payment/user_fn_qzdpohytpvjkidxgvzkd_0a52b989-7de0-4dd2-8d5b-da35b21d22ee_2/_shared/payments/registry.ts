// Adds a provider here once it has an adapter; every Edge Function looks the
// adapter up by the `provider` string the DB already carries, so wiring in a
// second provider never touches the functions themselves.
import type { PaymentProviderAdapter } from "./types.ts";
import { razorpayAdapter } from "./razorpay.ts";

const adaptersByProvider: Record<string, PaymentProviderAdapter> = {
  razorpay: razorpayAdapter,
};

export function getPaymentAdapter(provider: string): PaymentProviderAdapter {
  const adapter = adaptersByProvider[provider];
  if (!adapter) {
    throw new Error(`no payment provider adapter registered for '${provider}'`);
  }
  return adapter;
}
