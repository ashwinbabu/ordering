import { AlertCircle, CircleDollarSign, Clock3, RefreshCw, ShieldCheck, Store } from "lucide-react";
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
  /**
   * The reason quote_cart/checkout_cart refused, in the server's own wording
   * ("delivery address is unserviceable", "restaurant minimum order value is
   * not met"). Far more actionable than a generic retry prompt.
   */
  startError?: string;
  updatedAmount: number | null;
  venue: Venue;
}

const busyCopy: Partial<Record<CheckoutPhase, { title: string; body: string }>> = {
  quoting: { title: "Checking the latest price", body: "Confirming delivery fees and availability." },
  creating_order: { title: "Placing your order", body: "Setting things up with the kitchen." },
  preparing_payment: { title: "Preparing payment", body: "We're getting your payment ready." },
  confirming: { title: "Confirming your payment", body: "This only takes a moment." },
};

export function PaymentFlowScreen(props: PaymentFlowScreenProps) {
  const { onConfirmed, order, phase, venue } = props;
  useEffect(() => {
    if (phase !== "confirmed") return;
    const timer = window.setTimeout(onConfirmed, 750);
    return () => window.clearTimeout(timer);
  }, [onConfirmed, phase]);

  if (phase === "quote_changed") return <PaymentState icon={<CircleDollarSign />} title="Your total has changed" body={`The final total is ${formatRupees(props.updatedAmount ?? 0)}. This can happen when delivery fees, availability or offers change.`} venue={venue} actions={<><button className="primary-button" type="button" onClick={props.onAcceptQuote}>Continue with {formatRupees(props.updatedAmount ?? 0)}</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Review cart</button></>} />;
  if (busyCopy[phase]) return <PaymentPage venue={venue}><Securing title={busyCopy[phase]!.title} body={busyCopy[phase]!.body} /></PaymentPage>;
  if (phase === "awaiting_provider") return <PaymentPage venue={venue}><GatewaySheet order={order} onReturn={props.onProviderReturn} /></PaymentPage>;
  if (phase === "confirmed") return <PaymentPage venue={venue}><Securing done title="Payment confirmed" body="Your order is being opened." /></PaymentPage>;
  if (phase === "pending") return <PaymentState icon={<Clock3 />} title="We&rsquo;re confirming your payment" body="This is taking a little longer than usual. Don&rsquo;t make another payment yet." venue={venue} actions={<div className="review-status-control"><span>Still checking</span><p>We&rsquo;ll keep checking this payment automatically. You can also check right now.</p><button className="secondary-button" type="button" onClick={props.onVerify}>Check payment status</button></div>} />;
  if (phase === "failed") return <PaymentState icon={<AlertCircle />} title="Payment wasn't completed" body="Your payment was not successful." venue={venue} actions={<button className="primary-button" type="button" onClick={props.onRetry}>Try payment again</button>} />;
  if (phase === "cancelled") return <PaymentState icon={<AlertCircle />} title="Payment cancelled" body="Your order hasn't been paid yet." venue={venue} actions={<><button className="primary-button" type="button" onClick={props.onRetry}>Try payment again</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Not now</button></>} />;
  if (phase === "verification_error") return <PaymentState icon={<AlertCircle />} title="Unable to confirm payment" body="We couldn't check your payment status right now. If you already completed the payment, don't pay again yet." venue={venue} actions={<><button className="primary-button" type="button" onClick={props.onVerify}>Check again</button><button className="secondary-button" type="button" onClick={props.onBackToRestaurant}>Back to restaurant</button></>} />;
  return <PaymentState icon={<RefreshCw />} title="We couldn't start your payment" body={props.startError ?? (order ? "Your order details are safe. Please try again." : "Please try again.")} venue={venue} actions={<button className="primary-button" type="button" onClick={props.onRetry}>Try again</button>} />;
}

function PaymentPage({ children, venue }: { children: React.ReactNode; venue: Venue }) {
  return <main className="payment-page"><header className="payment-page__header"><div className="brand-mark brand-mark--mini" aria-label={`${venue.displayName} logo`}>{venue.displayName}</div><div><strong>{venue.displayName}</strong><small>{venue.locationName}</small></div></header>{children}</main>;
}

function PaymentState({ actions, body, icon, title, venue }: { actions?: React.ReactNode; body: React.ReactNode; icon: React.ReactNode; title: string; venue: Venue }) {
  return <PaymentPage venue={venue}><section className="payment-state" aria-live="polite"><span className="payment-state__icon">{icon}</span><p className="section-kicker">Secure payment</p><h1>{title}</h1><p>{body}</p>{actions ? <div className="payment-state__actions">{actions}</div> : null}</section></PaymentPage>;
}

function Securing({ body, done = false, title }: { body: string; done?: boolean; title: string }) {
  return <section className="securing-page" aria-live="polite" aria-busy={!done}>
    <div className="securing-animation">
      {!done ? <span className="securing-ring" aria-hidden="true" /> : null}
      <span className="securing-check"><ShieldCheck aria-hidden="true" size={26} /></span>
    </div>
    <p className="section-kicker">Secure payment</p>
    <h1>{title}</h1>
    <p>{body}</p>
    {!done ? <small>Don&rsquo;t close or refresh this page.</small> : null}
  </section>;
}

function GatewaySheet({ order, onReturn }: { order: PaymentPendingOrder | null; onReturn: (status: PaymentStatus) => void }) {
  return <section className="gateway-sheet">
    <div className="gateway-illustration">
      <span><Store aria-hidden="true" size={26} /></span>
      <i aria-hidden="true" />
      <span><ShieldCheck aria-hidden="true" size={26} /></span>
    </div>
    <div className="gateway-copy">
      <h1>Payment in progress</h1>
      <p>Complete the payment in your payment app. When you return, we&rsquo;ll check the status before confirming your order.</p>
      {order ? <div><span>Amount</span><strong>{formatRupees(order.amount)}</strong></div> : null}
    </div>
    <div className="review-notice">
      <strong>Before you pay</strong>
      <span>Only pay once. If the payment app doesn&rsquo;t open, come back and try again — we won&rsquo;t charge you twice.</span>
    </div>
    {import.meta.env.DEV ? <details className="demo-payment-controls"><summary>Demo payment controls</summary><p>These controls simulate a gateway return; they do not process payment.</p><div><button type="button" onClick={() => onReturn("confirmed")}>Return: confirmed</button><button type="button" onClick={() => onReturn("failed")}>Return: failed</button><button type="button" onClick={() => onReturn("cancelled")}>Return: cancelled</button><button type="button" onClick={() => onReturn("pending")}>Return: pending</button><button type="button" onClick={() => onReturn("verification_error")}>Return: unavailable</button></div></details> : null}
  </section>;
}
