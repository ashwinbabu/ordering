import { AlertCircle, CheckCircle2, CircleDollarSign, Clock3, LoaderCircle, RefreshCw, Store } from "lucide-react";
import { useEffect } from "react";
import { formatRupees, type PaymentPendingOrder, type PaymentStatus, type Venue } from "../../domain/storefront";
import type { CheckoutPhase } from "./use-checkout-flow";

interface PaymentFlowScreenProps {
  onAcceptQuote: () => void;
  onBackToRestaurant: () => void;
  onConfirmed: () => void;
  onProviderReturn: (status: PaymentStatus) => void;
  onRetry: () => void;
  onVerify: () => void;
  order: PaymentPendingOrder | null;
  phase: CheckoutPhase;
  updatedAmount: number | null;
  venue: Venue;
}

export function PaymentFlowScreen(props: PaymentFlowScreenProps) {
  const { onConfirmed, order, phase } = props;
  useEffect(() => {
    if (phase !== "confirmed") return;
    const timer = window.setTimeout(onConfirmed, 750);
    return () => window.clearTimeout(timer);
  }, [onConfirmed, phase]);

  if (phase === "quote_changed") return <PaymentState icon={<CircleDollarSign />} title="Your total has changed" body={`The final total is ${formatRupees(props.updatedAmount ?? 0)}. This can happen when delivery fees, availability or offers change.`} venue={props.venue} actions={<><button className="primary-button" type="button" onClick={props.onAcceptQuote}>Continue with {formatRupees(props.updatedAmount ?? 0)}</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Review cart</button></>} />;
  if (phase === "creating_order" || phase === "preparing_payment" || phase === "quoting") return <PaymentState busy icon={<LoaderCircle />} title="Preparing payment" body="We're getting your payment ready." venue={props.venue} />;
  if (phase === "awaiting_provider") return <ProviderAwaitingState onReturn={props.onProviderReturn} venue={props.venue} />;
  if (phase === "confirmed") return <PaymentState icon={<CheckCircle2 />} title="Payment confirmed" body="Your order is being opened." venue={props.venue} success />;
  if (phase === "pending") return <PaymentState icon={<Clock3 />} title="We're confirming your payment" body={<>This is taking a little longer than usual.<br /><br />Don't make another payment yet. We'll keep checking this payment.</>} venue={props.venue} actions={<><button className="primary-button" type="button" onClick={props.onVerify}>Check payment status</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Back to restaurant</button></>} />;
  if (phase === "failed") return <PaymentState icon={<AlertCircle />} title="Payment wasn't completed" body="Your payment was not successful." venue={props.venue} actions={<button className="primary-button" type="button" onClick={props.onRetry}>Try payment again</button>} />;
  if (phase === "cancelled") return <PaymentState icon={<AlertCircle />} title="Payment cancelled" body="Your order hasn't been paid yet." venue={props.venue} actions={<><button className="primary-button" type="button" onClick={props.onRetry}>Try payment again</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Not now</button></>} />;
  if (phase === "verification_error") return <PaymentState icon={<AlertCircle />} title="Unable to confirm payment" body={<>We couldn't check your payment status right now.<br /><br />If you already completed the payment, don't pay again yet.</>} venue={props.venue} actions={<><button className="primary-button" type="button" onClick={props.onVerify}>Check again</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Back to restaurant</button></>} />;
  return <PaymentState icon={<RefreshCw />} title="We couldn't start your payment" body={order ? "Your order details are safe. Please try again." : "Please try again."} venue={props.venue} actions={<button className="primary-button" type="button" onClick={props.onRetry}>Try again</button>} />;
}

function PaymentState({ actions, body, busy = false, icon, success = false, title, venue }: { actions?: React.ReactNode; body: React.ReactNode; busy?: boolean; icon: React.ReactNode; success?: boolean; title: string; venue: Venue }) {
  return <main className="payment-page"><header className="payment-page__header"><span className="brand-mark" aria-label={`${venue.displayName} logo`}>{venue.displayName}</span><div><strong>{venue.displayName}</strong><small>{venue.locationName}</small></div></header><section className="payment-state" aria-live="polite" aria-busy={busy}><span className={`payment-state__icon${success ? " payment-state__icon--success" : ""}`}>{busy ? <LoaderCircle className="spinner" aria-hidden="true" /> : icon}</span><p className="section-kicker">Secure payment</p><h1>{title}</h1><p>{body}</p>{actions ? <div className="payment-state__actions">{actions}</div> : null}</section></main>;
}

function ProviderAwaitingState({ onReturn, venue }: { onReturn: (status: PaymentStatus) => void; venue: Venue }) {
  return <PaymentState busy icon={<LoaderCircle />} title="Payment in progress" body="Complete the payment in your payment app. When you return, we'll check the status before confirming your order." venue={venue} actions={import.meta.env.DEV ? <details className="demo-payment-controls"><summary>Demo payment controls</summary><p>These controls simulate a gateway return; they do not process payment.</p><div><button type="button" onClick={() => onReturn("confirmed")}>Return: confirmed</button><button type="button" onClick={() => onReturn("failed")}>Return: failed</button><button type="button" onClick={() => onReturn("cancelled")}>Return: cancelled</button><button type="button" onClick={() => onReturn("pending")}>Return: pending</button><button type="button" onClick={() => onReturn("verification_error")}>Return: unavailable</button></div></details> : undefined} />;
}
