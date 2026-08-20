import { ChevronRight, Clock3, PackageOpen } from "lucide-react";
import type {
  ResourceState,
  StorefrontOrder,
  Venue,
} from "../../domain/storefront";
import { formatRupees } from "../../domain/storefront";
import { CustomerPageHeader } from "../venue/customer-page-header";

interface OrdersScreenProps {
  currentOrders: StorefrontOrder[];
  onBack: () => void;
  onBrowseMenu: () => void;
  onOpenOrder: (order: StorefrontOrder) => void;
  pastOrders: StorefrontOrder[];
  state?: ResourceState;
  venue: Venue;
}

export function OrdersScreen({
  currentOrders,
  onBack,
  onBrowseMenu,
  onOpenOrder,
  pastOrders,
  state = "ready",
  venue,
}: OrdersScreenProps) {
  return (
    <main className="ordering-app customer-page orders-page">
      <CustomerPageHeader title="Your orders" venue={venue} onBack={onBack} />
      <div className="customer-page-shell orders-page__shell">
        {state === "loading" ? (
          <section className="customer-empty-state">
            <h2>Loading your orders</h2>
            <p>We’re finding your orders from {venue.displayName}.</p>
          </section>
        ) : null}
        {state === "error" ? (
          <section className="customer-empty-state">
            <h2>Couldn’t load your orders</h2>
            <p>
              Please try again. This only affects orders from{" "}
              {venue.displayName}.
            </p>
            <button className="primary-button" type="button">
              Try again
            </button>
          </section>
        ) : null}
        {state === "ready" && !currentOrders.length && !pastOrders.length ? (
          <section className="customer-empty-state">
            <PackageOpen aria-hidden="true" size={31} />
            <h2>No orders yet</h2>
            <p>
              When you place an order from this restaurant, you’ll find it here.
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={onBrowseMenu}
            >
              Browse menu
            </button>
          </section>
        ) : null}
        {state === "ready" && currentOrders.length ? (
          <section
            className="orders-section"
            aria-labelledby="current-orders-title"
          >
            <p className="section-kicker" id="current-orders-title">
              Current order{currentOrders.length > 1 ? "s" : ""}
            </p>
            <div className="orders-stack">
              {currentOrders.map((order) => (
                <CurrentOrderCard
                  key={order.id}
                  order={order}
                  onOpen={() => onOpenOrder(order)}
                />
              ))}
            </div>
          </section>
        ) : null}
        {state === "ready" && pastOrders.length ? (
          <section
            className="orders-section"
            aria-labelledby="past-orders-title"
          >
            <p className="section-kicker" id="past-orders-title">
              Past orders
            </p>
            <div className="orders-stack">
              {pastOrders.map((order) => (
                <PastOrderCard
                  key={order.id}
                  order={order}
                  onOpen={() => onOpenOrder(order)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CurrentOrderCard({
  order,
  onOpen,
}: {
  order: StorefrontOrder;
  onOpen: () => void;
}) {
  return (
    <button className="current-order-card" type="button" onClick={onOpen}>
      <span className="order-status-pill" data-status={order.status}>
        {displayStatus(order.status)}
      </span>
      <strong>Order #{order.id}</strong>
      <span>
        {itemCount(order)} · {formatRupees(order.total)}
      </span>
      {order.estimatedFulfilment ? (
        <small>
          <Clock3 aria-hidden="true" size={15} />
          {order.estimatedFulfilment}
        </small>
      ) : null}
      <b>
        Track order <ChevronRight aria-hidden="true" size={17} />
      </b>
    </button>
  );
}

function PastOrderCard({
  order,
  onOpen,
}: {
  order: StorefrontOrder;
  onOpen: () => void;
}) {
  return (
    <button className="past-order-card" type="button" onClick={onOpen}>
      <div>
        <time dateTime={order.placedAt}>{formatOrderDate(order.placedAt)}</time>
        <span className="order-status-pill" data-status={order.status}>
          {displayStatus(order.status)}
        </span>
      </div>
      <strong>Order #{order.id}</strong>
      <p>{productSummary(order)}</p>
      <small>
        {itemCount(order)} · {formatRupees(order.total)} ·{" "}
        {order.fulfilment === "pickup" ? "Pickup" : "Delivery"}
      </small>
      <b>
        View order <ChevronRight aria-hidden="true" size={17} />
      </b>
    </button>
  );
}

export function displayStatus(status: StorefrontOrder["status"]) {
  return {
    placed: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    "out-for-delivery": "Out for delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  }[status];
}

export function formatOrderDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function itemCount(order: StorefrontOrder) {
  const count = order.items.reduce((total, item) => total + item.quantity, 0);
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function productSummary(order: StorefrontOrder) {
  const [first, ...remaining] = order.items;
  return first
    ? `${first.name}${remaining.length ? ` + ${remaining.length} more` : ""}`
    : "Order details";
}
