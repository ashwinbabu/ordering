import { ArrowLeft, Check, CircleCheck, Clock3, ReceiptText, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRupees, type PaymentPendingOrder, type Venue } from "../../domain/storefront";

interface OrderTrackingScreenProps { order: PaymentPendingOrder; venue: Venue; onBackToRestaurant: () => void; }

export function OrderTrackingScreen({ order, venue, onBackToRestaurant }: OrderTrackingScreenProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, 90 - Math.floor((Date.now() - Date.parse(order.createdAt)) / 1000)));
  const [cancelled, setCancelled] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setRemainingSeconds(Math.max(0, 90 - Math.floor((Date.now() - Date.parse(order.createdAt)) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [order.createdAt]);
  const isDelivery = order.fulfilment === "delivery";

  return <main className="tracking-page">
    <header className="tracking-header"><button className="icon-button" type="button" onClick={onBackToRestaurant} aria-label="Back to restaurant"><ArrowLeft aria-hidden="true" size={23} /></button><span className="brand-mark" aria-label={`${venue.displayName} logo`}>{venue.displayName}</span><div><strong>{venue.displayName}</strong><small>Order #{order.id}</small></div><span className="tracking-live"><i />Live</span></header>
    <div className="tracking-shell">
      <section className="order-hero"><span className="order-hero__icon"><ReceiptText aria-hidden="true" size={44} /></span><p className="section-kicker">{isDelivery ? "Delivery order" : "Pickup order"}</p><h1>{cancelled ? "Your order was cancelled" : "Your order is in"}</h1><p>{cancelled ? "We’ve let the restaurant know." : isDelivery ? "Estimated arrival in 30–40 minutes." : "Your order will be ready for collection in 20–25 minutes."}</p>{!cancelled ? <dl><div><dt>Total</dt><dd>{formatRupees(order.amount)}</dd></div><div><dt>Items</dt><dd>{order.itemCount}</dd></div><div><dt>Mode</dt><dd>{isDelivery ? "Delivery" : "Pickup"}</dd></div></dl> : null}</section>
      {!cancelled && remainingSeconds > 0 ? <section className="cancellation-window"><span>{remainingSeconds}</span><div><h2>Need to cancel?</h2><p>You can cancel only while this countdown is active.</p><button type="button" onClick={() => setCancelled(true)}>Cancel order</button></div></section> : null}
      {!cancelled ? <section className="order-timeline" aria-labelledby="order-status-title"><div className="cart-section__heading"><h2 id="order-status-title">Order status</h2><span>Updates automatically</span></div><StatusStep active icon={<Check size={17} />} title="Order received" body={`Payment confirmed and sent to ${venue.displayName}.`} tag="Now" /><StatusStep icon={<CircleCheck size={17} />} title="Accepted" body="The kitchen has accepted your order." /><StatusStep icon={<Clock3 size={17} />} title="Preparing" body="Your food is being made fresh." />{isDelivery ? <StatusStep icon={<Truck size={17} />} title="Out for delivery" body="Your order is on its way." /> : <StatusStep icon={<Check size={17} />} title="Ready for pickup" body="Collect your order from the outlet." />}</section> : null}
    </div>
  </main>;
}

function StatusStep({ active = false, body, icon, tag, title }: { active?: boolean; body: string; icon: React.ReactNode; tag?: string; title: string }) {
  return <article className="status-step" data-active={active}><span className="status-step__marker">{icon}</span><div><div><h3>{title}</h3>{tag ? <small>{tag}</small> : null}</div><p>{body}</p></div></article>;
}
