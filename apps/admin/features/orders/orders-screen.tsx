"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Clock3,
  Copy,
  LoaderCircle,
  MapPin,
  Phone,
  Printer,
  Search,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { formatMoney, nextOrderAction, type Order, type OrderStatus } from "./order-model";

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

function OrderCard({
  order,
  busy,
  onProgress,
  onOpen,
  onCopy,
  onKOT,
  onCancel,
}: {
  order: Order;
  busy: boolean;
  onProgress: () => void;
  onOpen: () => void;
  onCopy: () => void;
  onKOT: () => void;
  onCancel: () => void;
}) {
  const action = nextOrderAction(order.status);
  const cancellable = !["Delivered", "Cancelled"].includes(order.status);

  return (
    <article className={`order-card ${order.status === "New" ? "new-order" : ""}`}>
      <section className="order-zone order-context-zone">
        <div className="order-zone-head">
          <span className="fulfilment-label">Delivery</span>
          <StatusBadge status={order.status} />
        </div>
        <button className="order-title-button" onClick={onOpen} aria-label={`Open order ${order.id}`}>
          <strong>Order #{order.id}</strong>
          <ChevronRight size={17} />
        </button>
        <div className="order-time-row">
          <span>Received {order.received}</span>
          <strong>{order.age}</strong>
        </div>
        <div className="customer-block">
          <strong>{order.customer}</strong>
          <a href={`tel:${order.phone.replaceAll(" ", "")}`} onClick={(event) => event.stopPropagation()}>
            <Phone size={15} /> Call
          </a>
          <span>{order.phone}</span>
          <p><MapPin size={15} />{order.shortAddress}</p>
        </div>
        <div className="quiet-actions">
          <button onClick={onCopy}><Clipboard size={15} />Copy order</button>
          <button onClick={onKOT}><Printer size={15} />KOT</button>
        </div>
      </section>

      <section className="order-zone order-items-zone">
        <div className="item-list">
          {order.items.map((item) => (
            <div className="order-item" key={item.name}>
              <strong>{item.qty} × {item.name}</strong>
              {item.variants?.map((variant) => <span key={variant}>{variant}</span>)}
              {item.instructions && <em>“{item.instructions}”</em>}
            </div>
          ))}
        </div>
        {order.instructions && (
          <div className="instruction-note">
            <CircleAlert size={15} />
            <span><strong>Order instruction</strong>{order.instructions}</span>
          </div>
        )}
        <div className="bill-row">
          <span>Total <small className={order.paid ? "paid" : "cod"}>{order.paid ? "Paid" : "Cash on delivery"}</small></span>
          <strong>{formatMoney(order.total)}</strong>
        </div>
        {action ? (
          <button className="primary-button order-main-action" onClick={onProgress} disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}
            {action}
          </button>
        ) : (
          <div className="completed-action"><Check size={17} />No action required</div>
        )}
      </section>

      <section className="order-zone delivery-zone">
        <div className="zone-title-row">
          <span>Delivery details</span>
          <button onClick={() => navigator.clipboard?.writeText(order.fullAddress)} aria-label="Copy delivery address">
            <Copy size={15} /> Copy address
          </button>
        </div>
        <p className="full-address">{order.fullAddress}</p>
        <div className="delivery-instruction">
          <strong>Delivery instruction</strong>
          <span>{order.deliveryInstructions}</span>
        </div>
        <div className="order-operational-status">
          <Clock3 size={16} />
          <span>
            <strong>{order.status === "New" ? "Waiting for acceptance" : order.status}</strong>
            {order.status === "Preparing" ? "Accepted at 3:34 PM" : `Received ${order.received}`}
          </span>
        </div>
        <div className="delivery-actions">
          <button className="secondary-button" onClick={onOpen}>View details</button>
          {cancellable && <button className="destructive-link" onClick={onCancel}>Cancel order</button>}
        </div>
      </section>
    </article>
  );
}

export function OrdersPage({
  orders,
  orderingOpen,
  onOrderingToggle,
  statusFilter,
  setStatusFilter,
  busyOrderId,
  onProgress,
  onOpen,
  onCopy,
  onKOT,
  onCancel,
}: {
  orders: Order[];
  orderingOpen: boolean;
  onOrderingToggle: () => void;
  statusFilter: "All" | OrderStatus;
  setStatusFilter: (status: "All" | OrderStatus) => void;
  busyOrderId: string;
  onProgress: (order: Order) => void;
  onOpen: (order: Order) => void;
  onCopy: (order: Order) => void;
  onKOT: (order: Order) => void;
  onCancel: (order: Order) => void;
}) {
  const [cartsOpen, setCartsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const tabs: ("All" | OrderStatus)[] = ["All", "New", "Preparing", "Out for delivery", "Delivered", "Cancelled"];
  const visible = orders.filter((order) => {
    const filterMatch = statusFilter === "All" || order.status === statusFilter;
    const searchMatch = !search || order.id.includes(search) || order.customer.toLowerCase().includes(search.toLowerCase());
    return filterMatch && searchMatch;
  });
  const newCount = orders.filter((order) => order.status === "New").length;
  const activeCount = orders.filter((order) => ["New", "Preparing", "Out for delivery"].includes(order.status)).length;
  const delivered = orders.filter((order) => order.status === "Delivered");

  return (
    <div className="page orders-page">
      <div className="orders-command-row">
        <div className="date-control"><CalendarDays size={17} />11–12 Aug 2026<ChevronDown size={15} /></div>
        <div className={`ordering-control ${orderingOpen ? "open" : "paused"}`}>
          <span className="ordering-control-status"><Store size={16} />{orderingOpen ? "Accepting orders" : "Orders paused"}</span>
          <div className="ordering-toggle-wrap">
            <span>{orderingOpen ? "On" : "Off"}</span>
            <Toggle checked={orderingOpen} onChange={onOrderingToggle} label="Toggle restaurant ordering" />
          </div>
        </div>
      </div>

      <section className="snapshot-strip" aria-label="Today’s snapshot">
        <div><span>New</span><strong>{newCount}</strong></div>
        <div><span>Open orders</span><strong>{activeCount}</strong></div>
        <div><span>Completed today</span><strong>{delivered.length}</strong></div>
        <div><span>Today’s sales</span><strong>{formatMoney(orders.filter((order) => order.status !== "Cancelled").reduce((sum, order) => sum + order.total, 0))}</strong></div>
      </section>

      <div className="queue-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Order status">
          {tabs.map((tab) => {
            const count = orders.filter((order) => tab === "All" || order.status === tab).length;
            return (
              <button key={tab} role="tab" aria-selected={statusFilter === tab} className={statusFilter === tab ? "active" : ""} onClick={() => setStatusFilter(tab)}>
                {tab}{(tab === "New" || tab === "Preparing") && count > 0 ? <span>{count}</span> : null}
              </button>
            );
          })}
        </div>
        <label className="search-field order-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order or customer" />
        </label>
      </div>

      <div className="order-list">
        {visible.length ? visible.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            busy={busyOrderId === order.id}
            onProgress={() => onProgress(order)}
            onOpen={() => onOpen(order)}
            onCopy={() => onCopy(order)}
            onKOT={() => onKOT(order)}
            onCancel={() => onCancel(order)}
          />
        )) : (
          <div className="empty-state compact-empty">
            <ShoppingBag size={28} />
            <h3>No matching orders</h3>
            <p>Try another status or search.</p>
          </div>
        )}
      </div>

      <section className="active-carts">
        <button className="active-carts-head" onClick={() => setCartsOpen((open) => !open)} aria-expanded={cartsOpen}>
          <span><ShoppingBag size={17} /><strong>Active carts</strong><small>2 carts · last activity 3 min ago</small></span>
          <ChevronDown size={18} className={cartsOpen ? "rotate" : ""} />
        </button>
        {cartsOpen && (
          <div className="cart-awareness-list">
            <div><strong>Guest · ending 2084</strong><span>2 items · {formatMoney(420)}</span><small>Last active 3 min ago</small></div>
            <div><strong>Meera S.</strong><span>1 item · {formatMoney(280)}</span><small>Last active 8 min ago</small></div>
          </div>
        )}
      </section>
    </div>
  );
}

export function OrderDetails({
  order,
  busy,
  onBack,
  onProgress,
  onCopy,
  onKOT,
  onCancel,
}: {
  order: Order;
  busy: boolean;
  onBack: () => void;
  onProgress: () => void;
  onCopy: () => void;
  onKOT: () => void;
  onCancel: () => void;
}) {
  const action = nextOrderAction(order.status);
  return (
    <div className="page order-details-page">
      <button className="back-button" onClick={onBack}><ArrowLeft size={18} />Back to orders</button>
      <header className="order-detail-header">
        <div>
          <div className="detail-title-line"><h1>Order #{order.id}</h1><StatusBadge status={order.status} /></div>
          <p>Received {order.received} · {order.age} · <strong>{order.paid ? "Paid" : "Cash on delivery"} {formatMoney(order.total)}</strong></p>
        </div>
        <div className="detail-actions">
          <button className="secondary-button" onClick={onCopy}><Clipboard size={16} />Copy</button>
          <button className="secondary-button" onClick={onKOT}><Printer size={16} />Print KOT</button>
          {action && <button className="primary-button" onClick={onProgress} disabled={busy}>{busy && <LoaderCircle className="spin" size={16} />}{action}</button>}
          {!['Delivered', 'Cancelled'].includes(order.status) && <button className="destructive-link" onClick={onCancel}>Cancel</button>}
        </div>
      </header>

      <div className="order-detail-grid">
        <div className="detail-main-column">
          <section className="detail-section">
            <div className="detail-section-heading"><h2>Kitchen</h2><span>{order.items.reduce((sum, item) => sum + item.qty, 0)} items</span></div>
            <div className="detail-item-list">
              {order.items.map((item) => (
                <div key={item.name} className="detail-item-row">
                  <strong>{item.qty}</strong>
                  <span><b>{item.name}</b>{item.variants?.map((variant) => <small key={variant}>{variant}</small>)}{item.instructions && <em>Item note: {item.instructions}</em>}</span>
                </div>
              ))}
            </div>
            {order.instructions && <div className="prominent-instruction"><CircleAlert size={18} /><span><strong>Order instruction</strong>{order.instructions}</span></div>}
          </section>

          <section className="detail-section">
            <div className="detail-section-heading"><h2>Customer & delivery</h2></div>
            <div className="customer-detail-grid">
              <div><span>Customer</span><strong>{order.customer}</strong><small>{order.phone}</small><div className="inline-actions"><a href={`tel:${order.phone.replaceAll(" ", "")}`}><Phone size={15} />Call</a><button onClick={() => navigator.clipboard?.writeText(order.phone)}><Copy size={15} />Copy phone</button></div></div>
              <div><span>Address</span><strong>{order.fullAddress}</strong><small>{order.deliveryInstructions}</small><div className="inline-actions"><button onClick={() => navigator.clipboard?.writeText(order.fullAddress)}><Copy size={15} />Copy address</button></div></div>
            </div>
          </section>

          <section className="detail-section bill-section">
            <div className="detail-section-heading"><h2>Bill</h2><span>{order.paid ? "Payment received" : "Collect on delivery"}</span></div>
            <dl>
              <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
              {order.discount > 0 && <div className="discount-line"><dt>Coupon discount</dt><dd>−{formatMoney(order.discount)}</dd></div>}
              <div><dt>Delivery fee</dt><dd>{formatMoney(order.deliveryFee)}</dd></div>
              <div><dt>Tax</dt><dd>{formatMoney(order.tax)}</dd></div>
              {order.rounding !== 0 && <div><dt>Rounding</dt><dd>{order.rounding > 0 ? "+" : "−"}{formatMoney(Math.abs(order.rounding))}</dd></div>}
              <div className="bill-total"><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
            </dl>
          </section>
        </div>

        <aside className="detail-side-column">
          <section className="detail-section timeline-section">
            <div className="detail-section-heading"><h2>Timeline</h2></div>
            <ol>
              {order.timeline.map((item) => (
                <li key={item.label} className={item.complete ? "complete" : ""}>
                  <span className="timeline-dot">{item.complete && <Check size={11} />}</span>
                  <div><strong>{item.label}</strong><small>{item.time}</small></div>
                </li>
              ))}
            </ol>
            {order.cancellationReason && <div className="cancelled-reason"><strong>Cancellation reason</strong><span>{order.cancellationReason}</span><small>Manual refund responsibility recorded.</small></div>}
          </section>
        </aside>
      </div>
    </div>
  );
}

export function KotView({ order, onBack }: { order: Order; onBack: () => void }) {
  return (
    <main className="kot-page">
      <div className="kot-actions no-print">
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} />Back</button>
        <button className="primary-button" onClick={() => window.print()}><Printer size={16} />Print KOT</button>
      </div>
      <section className="kot-ticket">
        <header><span>A2 · MANDREM</span><h1>KOT #{order.id}</h1><p>{order.received} · DELIVERY</p></header>
        <div className="kot-meta"><span>Customer</span><strong>{order.customer}</strong></div>
        <div className="kot-items">
          {order.items.map((item) => (
            <div key={item.name}>
              <b>{item.qty}</b>
              <span><strong>{item.name}</strong>{item.variants?.map((variant) => <small key={variant}>+ {variant}</small>)}{item.instructions && <em>NOTE: {item.instructions}</em>}</span>
            </div>
          ))}
        </div>
        {order.instructions && <div className="kot-note"><strong>ORDER NOTE</strong><span>{order.instructions}</span></div>}
        <footer>Printed {new Date().toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "2-digit", month: "short" })}</footer>
      </section>
    </main>
  );
}

