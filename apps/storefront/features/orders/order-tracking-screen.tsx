import { ArrowLeft, MapPin, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatRupees,
  type PaymentPendingOrder,
  type Venue,
} from "../../domain/storefront";
import { OrderStatusTimeline } from "./order-status-timeline";

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
    order.trackingOrder.paymentMethod === "cash";

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

        <OrderStatusTimeline
          status={order.trackingOrder.status}
          fulfilment={order.fulfilment}
          venueName={venue.displayName}
          isCashOnDelivery={isCashOnDelivery}
        />
      </div>
    </main>
  );
}
