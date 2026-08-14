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
