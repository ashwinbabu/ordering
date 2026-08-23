import { Check, MapPin, RotateCcw, Store } from "lucide-react";
import type { StorefrontOrder, Venue } from "../../domain/storefront";
import { formatRupees } from "../../domain/storefront";
import { CustomerPageHeader } from "../venue/customer-page-header";
import { OrderStatusTimeline } from "./order-status-timeline";
import { displayStatus, formatOrderDate } from "./orders-screen";

interface OrderDetailsScreenProps {
  onBack: () => void;
  onOrderAgain: (order: StorefrontOrder) => void;
  order: StorefrontOrder;
  venue: Venue;
}

export function OrderDetailsScreen({
  onBack,
  onOrderAgain,
  order,
  venue,
}: OrderDetailsScreenProps) {
  const isCurrent = [
    "placed",
    "accepted",
    "preparing",
    "out-for-delivery",
  ].includes(order.status);
  const finalOrder = ["delivered", "completed"].includes(order.status);
  const isCashOnDelivery = order.paymentMethod === "cash";
  return (
    <main className="ordering-app customer-page order-details-page">
      <CustomerPageHeader
        title={`Order #${order.id}`}
        subtitle={`${displayStatus(order.status)} · ${formatOrderDate(order.placedAt)}`}
        venue={venue}
        onBack={onBack}
      />
      <div className="customer-page-shell order-details-page__shell">
        <section className="order-details-status">
          <span className="order-status-pill" data-status={order.status}>
            {displayStatus(order.status)}
          </span>
          <h2>
            {isCurrent
              ? (order.estimatedFulfilment ?? "We’re working on your order")
              : finalOrder
                ? "Order completed"
                : "Order update"}
          </h2>
          <p>
            {formatOrderDate(order.placedAt)} ·{" "}
            {order.fulfilment === "delivery" ? "Delivery" : "Pickup"}
          </p>
        </section>
        {isCurrent ? (
          <OrderStatusTimeline
            status={order.status}
            fulfilment={order.fulfilment}
            venueName={venue.displayName}
            isCashOnDelivery={isCashOnDelivery}
          />
        ) : null}
        {order.status === "cancelled" && order.cancellationReason ? (
          <section className="order-detail-section cancellation-details">
            <h2>Cancelled</h2>
            <p>
              {formatOrderDate(
                order.timeline?.at(-1)?.occurredAt ?? order.placedAt,
              )}
            </p>
            <h3>Reason</h3>
            <p>{order.cancellationReason}</p>
          </section>
        ) : null}
        <section
          className="order-detail-section"
          aria-labelledby="order-items-title"
        >
          <h2 id="order-items-title">Your order</h2>
          <div className="order-items">
            {order.items.map((item) => (
              <article className="order-item-row" key={item.id}>
                <div>
                  <h3>
                    {item.quantity} × {item.name}
                  </h3>
                  {item.selectedOptions?.length ? (
                    <p>{item.selectedOptions.join(" · ")}</p>
                  ) : null}
                  {item.note ? <p>{item.note}</p> : null}
                </div>
                <strong>{formatRupees(item.unitPrice * item.quantity)}</strong>
              </article>
            ))}
          </div>
        </section>
        <section
          className="order-detail-section bill-details"
          aria-labelledby="bill-details-title"
        >
          <h2 id="bill-details-title">Bill details</h2>
          <dl>
            <div>
              <dt>Item total</dt>
              <dd>{formatRupees(order.subtotal)}</dd>
            </div>
            {order.discount ? (
              <div>
                <dt>
                  {order.couponCode ? `Coupon ${order.couponCode}` : "Discount"}
                </dt>
                <dd>-{formatRupees(order.discount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Delivery fee</dt>
              <dd>{formatRupees(order.deliveryFee)}</dd>
            </div>
            <div>
              <dt>GST / taxes</dt>
              <dd>{formatRupees(order.taxes)}</dd>
            </div>
            <div className="bill-details__total">
              <dt>Total paid</dt>
              <dd>{formatRupees(order.total)}</dd>
            </div>
          </dl>
          {order.paymentStatus === "paid" ? (
            <p>
              <Check aria-hidden="true" size={15} />
              Paid online
              {order.paymentMethod === "online" ? " · Online payment" : ""}
            </p>
          ) : order.paymentStatus === "refunded" ? (
            <p>Payment refunded</p>
          ) : (
            <p>Payment pending</p>
          )}
        </section>
        {order.fulfilment === "delivery" && order.deliveryAddress ? (
          <section className="order-detail-section fulfilment-details">
            <p className="section-kicker">Delivered to</p>
            <h2>
              {order.deliveryAddress.customLabel || order.deliveryAddress.label}
            </h2>
            <p>
              {order.deliveryAddress.line1}
              {order.deliveryAddress.line2
                ? `, ${order.deliveryAddress.line2}`
                : ""}
            </p>
            <p>
              {order.deliveryAddress.locality}, {order.deliveryAddress.city}
            </p>
            {order.deliveryAddress.instructions ? (
              <small>{order.deliveryAddress.instructions}</small>
            ) : null}
          </section>
        ) : (
          <section className="order-detail-section fulfilment-details">
            <p className="section-kicker">Pickup from</p>
            <h2>{venue.businessName}</h2>
            <p>{venue.locationName}</p>
            <p>{venue.address}</p>
          </section>
        )}
        {order.orderNote ? (
          <section className="order-detail-section order-note">
            <p className="section-kicker">Order instructions</p>
            <p>{order.orderNote}</p>
          </section>
        ) : null}
        {finalOrder ? (
          <OrderStatusTimeline
            status={order.status}
            fulfilment={order.fulfilment}
            venueName={venue.displayName}
            isCashOnDelivery={isCashOnDelivery}
          />
        ) : null}
        {finalOrder ? (
          <button
            className="primary-button order-again-button"
            type="button"
            onClick={() => onOrderAgain(order)}
          >
            <RotateCcw aria-hidden="true" size={18} />
            Order again
          </button>
        ) : null}
      </div>
    </main>
  );
}
