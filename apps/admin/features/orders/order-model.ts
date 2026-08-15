export type OrderStatus =
  | "New"
  | "Preparing"
  | "Out for delivery"
  | "Delivered"
  | "Cancelled";

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

/**
 * Whether an ISO timestamp falls on the viewer's current local calendar day.
 * The operator's device is assumed to be in the outlet's own timezone, which
 * holds for restaurant floor staff.
 */
export function isOnLocalDay(value: string | null | undefined, day = new Date()) {
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
