export type OrderStatus =
  "New" | "Preparing" | "Out for delivery" | "Delivered" | "Cancelled";

export interface OrderItem {
  name: string;
  qty: number;
  variants?: string[];
  instructions?: string;
}

export interface TimelineItem {
  label: string;
  time: string;
  complete: boolean;
}

export interface Order {
  recordId?: string;
  backendStatus?: string;
  id: string;
  status: OrderStatus;
  /** ISO-8601 instant the order was placed -- the raw value backing `received`/`age`, kept for callers (e.g. the new-order alarm) that need to do arithmetic rather than display a formatted string. Null when the backend didn't supply one; callers must treat that as "never eligible" rather than defaulting to now. */
  placedAt: string | null;
  /**
   * Milestone timestamps, ISO-8601, as stored. The day's figures are derived
   * from these rather than from whichever orders happen to be in the queue,
   * so a delivered order stays visible in the list without being counted
   * against a day it wasn't completed on.
   */
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  customer: string;
  phone: string;
  shortAddress: string;
  fullAddress: string;
  deliveryInstructions: string;
  received: string;
  receivedDateTime: string;
  age: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  rounding: number;
  total: number;
  paid: boolean;
  items: OrderItem[];
  instructions?: string;
  timeline: TimelineItem[];
  cancellationReason?: string;
}

export function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatQueueDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export interface OrdersDateRange {
  from: Date;
  to: Date;
}

export const ORDERS_DATE_RANGE_MAX_DAYS = 7;

function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Previous and current calendar day, in the viewer's local time. */
export function defaultOrdersDateRange(now = new Date()): OrdersDateRange {
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return { from: yesterday, to: today };
}

/** Inclusive day count spanned by a range, e.g. today..today is 1 day. */
export function ordersDateRangeSpanDays(range: OrdersDateRange) {
  const from = startOfLocalDay(range.from);
  const to = startOfLocalDay(range.to);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** [from, to) instant boundaries for the query, covering both calendar days fully. */
export function ordersDateRangeQueryWindow(range: OrdersDateRange) {
  const from = startOfLocalDay(range.from);
  const to = startOfLocalDay(range.to);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function formatOrdersDateRangeLabel(
  range: OrdersDateRange,
  now = new Date(),
) {
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const from = startOfLocalDay(range.from);
  const to = startOfLocalDay(range.to);

  if (
    from.getTime() === yesterday.getTime() &&
    to.getTime() === today.getTime()
  ) {
    return "Yesterday & today";
  }
  if (from.getTime() === today.getTime() && to.getTime() === today.getTime()) {
    return "Today";
  }
  if (from.getTime() === to.getTime()) return formatQueueDate(from);
  return `${formatQueueDate(from)} – ${formatQueueDate(to)}`;
}

/**
 * Whether an ISO timestamp falls on the viewer's current local calendar day.
 * The operator's device is assumed to be in the outlet's own timezone, which
 * holds for restaurant floor staff.
 */
export function isOnLocalDay(
  value: string | null | undefined,
  day = new Date(),
) {
  if (!value) return false;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return false;
  return (
    at.getFullYear() === day.getFullYear() &&
    at.getMonth() === day.getMonth() &&
    at.getDate() === day.getDate()
  );
}

export function nextOrderAction(status: OrderStatus) {
  if (status === "New") return "Accept order";
  if (status === "Preparing") return "Mark out for delivery";
  if (status === "Out for delivery") return "Mark delivered";
  return null;
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  if (status === "New") return "Preparing";
  if (status === "Preparing") return "Out for delivery";
  if (status === "Out for delivery") return "Delivered";
  return null;
}
