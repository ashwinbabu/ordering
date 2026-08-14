import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { Order, OrderStatus, TimelineItem } from "@/features/orders/order-model";

interface OrderScope {
  businessId: string;
  locationId: string;
}

type JsonObject = { [key: string]: Json | undefined };

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

function asObject(value: Json, message: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function asArray(value: Json | undefined, message: string): Json[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function stringValue(row: JsonObject, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`The order response has an invalid ${key} value.`);
  return value;
}

function nullableStringValue(row: JsonObject, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`The order response has an invalid ${key} value.`);
  return value;
}

function numberValue(row: JsonObject, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`The order response has an invalid ${key} value.`);
  return value;
}

function backendStatusToDisplay(status: string): OrderStatus {
  if (status === "placed" || status === "needs_attention") return "New";
  if (status === "accepted" || status === "ready_for_pickup") return "Preparing";
  if (status === "out_for_delivery") return "Out for delivery";
  if (status === "delivered") return "Delivered";
  if (status === "cancelled") return "Cancelled";
  throw new Error("The order response has an unsupported status.");
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAge(value: string | null, status: OrderStatus) {
  if (!value) return "Just now";
  if (status === "Delivered") return `Delivered ${formatTime(value)}`;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1 ? "Just now" : `${minutes} min`;
}

function addressText(value: Json | undefined) {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "Address unavailable";
  const address = value as JsonObject;
  const parts = ["address_line_1", "address_line_2", "locality", "city", "state", "postal_code"]
    .map((key) => address[key])
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
  return parts.join(", ") || "Address unavailable";
}

function timelineFor(row: JsonObject, status: OrderStatus): TimelineItem[] {
  const labels = new Map<string, string>([
    ["order_created", "Order received"],
    ["order_placed", "Order received"],
    ["order_accepted", "Accepted"],
    ["order_ready_for_pickup", "Preparing"],
    ["order_out_for_delivery", "Out for delivery"],
    ["order_delivered", "Delivered"],
    ["order_cancelled", "Cancelled"],
  ]);
  const events = asArray(row.events, "The order response is missing events.");
  const completed = new Map<string, string>();
  for (const event of events) {
    const item = asObject(event, "The order response has an invalid event.");
    const label = labels.get(stringValue(item, "event_type"));
    if (label) completed.set(label, formatTime(nullableStringValue(item, "created_at")));
  }
  const stages = status === "Cancelled"
    ? ["Order received", "Accepted", "Cancelled"]
    : ["Order received", "Accepted", "Out for delivery", "Delivered"];
  return stages.map((label) => ({
    label,
    time: completed.get(label) ?? "—",
    complete: completed.has(label),
  }));
}

function parseOrder(value: Json): Order {
  const row = asObject(value, "The order response has an invalid order.");
  const backendStatus = stringValue(row, "status");
  const status = backendStatusToDisplay(backendStatus);
  const fullAddress = addressText(row.delivery_address);
  const items = asArray(row.items, "The order response is missing items.").map((item) => {
    const parsed = asObject(item, "The order response has an invalid item.");
    return {
      name: stringValue(parsed, "product_name"),
      qty: numberValue(parsed, "quantity"),
      variants: asArray(parsed.options, "The order response is missing item options.").map((option) => {
        const value = asObject(option, "The order response has an invalid item option.");
        const quantity = numberValue(value, "quantity");
        const name = stringValue(value, "option_name");
        return quantity > 1 ? `${quantity} × ${name}` : name;
      }),
      instructions: nullableStringValue(parsed, "customer_note") ?? undefined,
    };
  });
  const placedAt = nullableStringValue(row, "placed_at") ?? nullableStringValue(row, "created_at");
  const note = nullableStringValue(row, "customer_note");

  return {
    recordId: stringValue(row, "id"),
    backendStatus,
    id: stringValue(row, "order_number"),
    status,
    customer: stringValue(row, "customer_name"),
    phone: stringValue(row, "customer_phone"),
    shortAddress: fullAddress.split(",").slice(0, 2).join(","),
    fullAddress,
    deliveryInstructions: note ?? "No delivery instructions.",
    received: formatTime(placedAt),
    age: formatAge(placedAt, status),
    subtotal: numberValue(row, "food_subtotal"),
    discount: numberValue(row, "discount_total"),
    deliveryFee: numberValue(row, "delivery_fee"),
    tax: numberValue(row, "tax_total"),
    rounding: 0,
    total: numberValue(row, "grand_total"),
    paid: stringValue(row, "payment_status") === "paid",
    items,
    instructions: note ?? undefined,
    timeline: timelineFor(row, status),
    cancellationReason: nullableStringValue(row, "cancel_reason") ?? undefined,
  };
}

export async function getOrdersForLocation(scope: OrderScope): Promise<Order[]> {
  const { data, error } = await supabase.schema("ordering").rpc("list_orders_for_location", {
    p_business_id: scope.businessId,
    p_location_id: scope.locationId,
  });
  throwIfError(error);
  if (!Array.isArray(data)) throw new Error("The order response is invalid.");
  return data.map(parseOrder);
}

export async function transitionOrderAtLocation(input: OrderScope & {
  orderId: string;
  expectedStatus: string;
  newStatus: string;
  cancelReason?: string | null;
}) {
  const { error } = await supabase.schema("ordering").rpc("transition_order_at_location", {
    p_business_id: input.businessId,
    p_location_id: input.locationId,
    p_order_id: input.orderId,
    p_expected_status: input.expectedStatus,
    p_new_status: input.newStatus,
    p_cancel_reason: input.cancelReason ?? undefined,
  });
  throwIfError(error);
}
