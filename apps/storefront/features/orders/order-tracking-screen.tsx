import {
  ArrowLeft,
  Check,
  CircleCheck,
  Clock3,
  MapPin,
  ReceiptText,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatRupees,
  type OrderStatus,
  type PaymentPendingOrder,
  type Venue,
} from "../../domain/storefront";

// Position of each in-progress status along the 4-step timeline below.
// "delivered"/"completed" land past the last step so every step reads as
// done; "cancelled"/"refunded" never reach this screen (see the early
// return above) but resolve to -1 (nothing active) rather than crash.
const timelineStepIndex: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 2,
  "out-for-delivery": 3,
  delivered: 4,
  completed: 4,
  cancelled: -1,
  refunded: -1,
};

interface OrderTrackingScreenProps {
  order: PaymentPendingOrder;
  venue: Venue;
  onBackToRestaurant: () => void;
  onCancel: () => void;
  cancelling: boolean;
  cancelError?: string;
}

const cancelWindowSeconds = 90;
const timerCircumference = 113;

export function OrderTrackingScreen({
  order,
  venue,
  onBackToRestaurant,
  onCancel,
  cancelling,
  cancelError,
}: OrderTrackingScreenProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(
      0,
      cancelWindowSeconds -
        Math.floor((Date.now() - Date.parse(order.createdAt)) / 1000),
    ),
  );
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setRemainingSeconds(
          Math.max(
            0,
            cancelWindowSeconds -
              Math.floor((Date.now() - Date.parse(order.createdAt)) / 1000),
          ),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [order.createdAt]);
  const isDelivery = order.fulfilment === "delivery";
  const address = order.trackingOrder.deliveryAddress;
  const isCashOnDelivery =
    order.trackingOrder.paymentMethod === "Cash on delivery";
  const currentStepIndex = timelineStepIndex[order.trackingOrder.status];

  // Driven by the server's own status, not a local click -- the cancel button
  // below only requests a transition; this only shows once ordering.orders
  // actually says 'cancelled' (see use-checkout-flow.ts's cancelOrder).
  if (order.trackingOrder.status === "cancelled") {
    return (
      <main className="tracking-page">
        <header className="tracking-header">
          <button
            className="icon-button"
            type="button"
            onClick={onBackToRestaurant}
            aria-label="Back to restaurant"
          >
            <ArrowLeft aria-hidden="true" size={23} />
          </button>
          <div
            className="brand-mark brand-mark--mini"
            aria-label={`${venue.displayName} logo`}
          >
            {venue.displayName}
          </div>
          <div>
            <strong>{venue.displayName}</strong>
            <small>Order #{order.orderNumber}</small>
          </div>
        </header>
        <section className="order-cancelled-page">
          <span className="cancelled-icon">
            <ReceiptText aria-hidden="true" size={32} />
          </span>
          <h1>Your order was cancelled</h1>
          <p>
            We’ve let the restaurant know. If you were charged, the amount will
            be refunded.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={onBackToRestaurant}
          >
            Back to restaurant
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="tracking-page">
      <header className="tracking-header">
        <button
          className="icon-button"
          type="button"
          onClick={onBackToRestaurant}
          aria-label="Back to restaurant"
        >
          <ArrowLeft aria-hidden="true" size={23} />
        </button>
        <div
          className="brand-mark brand-mark--mini"
          aria-label={`${venue.displayName} logo`}
        >
          {venue.displayName}
        </div>
        <div>
          <strong>{venue.displayName}</strong>
          <small>Order #{order.orderNumber}</small>
        </div>
      </header>
      <div className="tracking-content">
        <section className="tracking-hero">
          <span className="tracking-hero__icon">
            <ReceiptText aria-hidden="true" size={36} />
          </span>
          <p className="section-kicker">
            {isDelivery ? "Delivery order" : "Pickup order"}
          </p>
          <h1>Your order is in</h1>
          <p>
            {isDelivery
              ? "Estimated arrival in 30–40 minutes."
              : "Your order will be ready for collection in 20–25 minutes."}
          </p>
          <div className="order-meta">
            <span>
              <small>Total</small>
              <strong>{formatRupees(order.amount)}</strong>
            </span>
            <span>
              <small>Items</small>
              <strong>{order.itemCount}</strong>
            </span>
            <span>
              <small>Mode</small>
              <strong>{isDelivery ? "Delivery" : "Pickup"}</strong>
            </span>
          </div>
        </section>

        {remainingSeconds > 0 ? (
          <section className="cancel-window">
            <div className="cancel-window__timer">
              <svg
                viewBox="0 0 40 40"
                width="54"
                height="54"
                aria-hidden="true"
              >
                <circle cx="20" cy="20" r="18" />
                <circle
                  className="timer-progress"
                  cx="20"
                  cy="20"
                  r="18"
                  strokeDasharray={timerCircumference}
                  strokeDashoffset={
                    timerCircumference *
                    (1 - remainingSeconds / cancelWindowSeconds)
                  }
                />
              </svg>
              <strong>{remainingSeconds}</strong>
            </div>
            <div>
              <strong>Need to cancel?</strong>
              <p>You can cancel only while this countdown is active.</p>
              {cancelError ? (
                <p role="alert" className="cancel-window__error">
                  {cancelError}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onCancel} disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Cancel order"}
            </button>
          </section>
        ) : null}

        {isDelivery && address ? (
          <div className="delivery-destination">
            <span className="address-card-icon">
              <MapPin aria-hidden="true" size={18} />
            </span>
            <div>
              <strong>{address.line1}</strong>
              <p>
                {address.locality}, {address.city}
              </p>
            </div>
          </div>
        ) : null}

        <section
          className="order-status-timeline"
          aria-labelledby="order-status-title"
        >
          <div className="order-status-timeline__heading">
            <h2 id="order-status-title">Order status</h2>
            <span className="live-pill">
              <i aria-hidden="true" />
              Live
            </span>
          </div>
          <ol>
            <StatusStep
              active={currentStepIndex === 0}
              complete={currentStepIndex > 0}
              icon={<Check size={15} />}
              title="Order received"
              body={
                isCashOnDelivery
                  ? `Sent to ${venue.displayName}. Pay cash when it arrives.`
                  : `Payment confirmed and sent to ${venue.displayName}.`
              }
            />
            <StatusStep
              active={currentStepIndex === 1}
              complete={currentStepIndex > 1}
              icon={<CircleCheck size={15} />}
              title="Accepted"
              body="The kitchen has accepted your order."
            />
            <StatusStep
              active={currentStepIndex === 2}
              complete={currentStepIndex > 2}
              icon={<Clock3 size={15} />}
              title="Preparing"
              body="Your food is being made fresh."
            />
            {isDelivery ? (
              <StatusStep
                active={currentStepIndex === 3}
                complete={currentStepIndex > 3}
                icon={<Truck size={15} />}
                title="Out for delivery"
                body="Your order is on its way."
              />
            ) : (
              <StatusStep
                active={currentStepIndex === 3}
                complete={currentStepIndex > 3}
                icon={<Check size={15} />}
                title="Ready for pickup"
                body="Collect your order from the outlet."
              />
            )}
          </ol>
        </section>
      </div>
    </main>
  );
}

function StatusStep({
  active = false,
  complete = false,
  body,
  icon,
  title,
}: {
  active?: boolean;
  complete?: boolean;
  body: string;
  icon: React.ReactNode;
  title: string;
}) {
  const className = active ? "is-active" : complete ? "is-complete" : undefined;
  return (
    <li className={className}>
      <span className="timeline-marker">
        {complete ? <Check size={15} /> : icon}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </li>
  );
}
