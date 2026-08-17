import { getSupabaseClient } from "../../../lib/supabase/client";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";
import { readArray, readNullableNumber, readNullableString, readNumber, readRecord, readString } from "../../../lib/supabase/json-parsing";
import type { DeliveryAddress, OrderLineItem, OrderPaymentStatus, OrderStatus, StorefrontOrder } from "../../../domain/storefront";

// ordering.list_customer_orders returns the raw database vocabulary. The
// mapping to the storefront's own enums lives here so the database stays the
// single source of truth and the approved UI keeps the exact status set it
// was designed around.
//
// Two of these are approximations, because the database models states the UI
// has no label for:
//   ready_for_pickup -> "preparing"  (still an active order; the UI has no
//                                     "ready to collect" state)
//   needs_attention  -> "placed"     (still active and awaiting the
//                                     restaurant; surfacing it as an error
//                                     state would need new UI)
const orderStatusByDatabaseValue: Record<string, OrderStatus> = {
  placed: "placed",
  accepted: "accepted",
  ready_for_pickup: "preparing",
  out_for_delivery: "out-for-delivery",
  delivered: "delivered",
  needs_attention: "placed",
  cancelled: "cancelled",
};

// "not_required" is a cash/pay-on-collection order: nothing was captured
// online, so it reads as outstanding until the order completes.
const paymentStatusByDatabaseValue: Record<string, OrderPaymentStatus> = {
  pending: "pending",
  paid: "paid",
  failed: "pending",
  partially_refunded: "refunded",
  refunded: "refunded",
  not_required: "pending",
};

function parseDeliveryAddress(value: unknown): DeliveryAddress | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const snapshot = value as Record<string, unknown>;
  const text = (key: string) => typeof snapshot[key] === "string" ? snapshot[key] as string : "";

  return {
    id: text("id") || "order-address",
    label: "Other",
    customLabel: text("label") || undefined,
    recipientName: text("recipient_name"),
    recipientPhone: text("recipient_phone"),
    line1: text("address_line_1"),
    line2: text("address_line_2"),
    locality: text("locality"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    landmark: text("landmark"),
    instructions: text("delivery_instructions"),
    isDefault: false,
  };
}

function parseItem(value: unknown): OrderLineItem {
  const item = readRecord(value as never, "An order item");
  const options = readArray(item.options as never, "An order item's options").map((option) => {
    const record = readRecord(option as never, "An order item option");
    return readString(record.optionName, "An order item option name");
  });

  return {
    id: readString(item.id, "An order item ID"),
    productId: readNullableString(item.productId, "An order item product ID") ?? undefined,
    name: readString(item.productName, "An order item name"),
    quantity: readNumber(item.quantity, "An order item quantity"),
    unitPrice: readNumber(item.finalUnitPrice, "An order item unit price"),
    selectedOptions: options.length ? options : undefined,
    note: readNullableString(item.customerNote, "An order item note") ?? undefined,
  };
}

function parseOrder(value: unknown, businessKey: string): StorefrontOrder {
  const order = readRecord(value as never, "An order");
  const databaseStatus = readString(order.status, "An order status");
  const databasePaymentStatus = readString(order.paymentStatus, "An order payment status");
  const fulfillment = readString(order.fulfillmentType, "An order fulfilment type");
  const estimatedMinutes = readNullableNumber(order.estimatedDeliveryMinutes, "An order delivery estimate");

  return {
    // The UI prints this as "Order #{id}" and routes /orders/:id with it, so
    // it carries the human-readable order number rather than the row UUID.
    id: readString(order.orderNumber, "An order number"),
    restaurantId: businessKey,
    placedAt: readNullableString(order.placedAt, "An order placed timestamp") ?? new Date().toISOString(),
    status: orderStatusByDatabaseValue[databaseStatus] ?? "placed",
    paymentStatus: paymentStatusByDatabaseValue[databasePaymentStatus] ?? "pending",
    fulfilment: fulfillment === "pickup" ? "pickup" : "delivery",
    items: readArray(order.items as never, "An order's items").map(parseItem),
    subtotal: readNumber(order.foodSubtotal, "An order subtotal"),
    discount: readNumber(order.discountTotal, "An order discount"),
    deliveryFee: readNumber(order.deliveryFee, "An order delivery fee"),
    taxes: readNumber(order.taxTotal, "An order tax total"),
    total: readNumber(order.grandTotal, "An order total"),
    couponCode: readNullableString(order.couponCode, "An order coupon code") ?? undefined,
    deliveryAddress: parseDeliveryAddress(order.deliveryAddress),
    orderNote: readNullableString(order.customerNote, "An order note") ?? undefined,
    estimatedFulfilment: estimatedMinutes ? `About ${estimatedMinutes} min` : undefined,
    completedAt: readNullableString(order.deliveredAt, "An order delivered timestamp") ?? undefined,
    cancellationReason: readNullableString(order.cancelReason, "An order cancellation reason") ?? undefined,
    timeline: buildTimeline(order),
  };
}

function buildTimeline(order: Record<string, unknown>) {
  const entries: { label: string; occurredAt: string }[] = [];
  const push = (label: string, key: string) => {
    const value = order[key];
    if (typeof value === "string") entries.push({ label, occurredAt: value });
  };

  push("Order placed", "placedAt");
  push("Accepted by the restaurant", "acceptedAt");
  push("Out for delivery", "outForDeliveryAt");
  push("Delivered", "deliveredAt");
  push("Cancelled", "cancelledAt");
  return entries.length ? entries : undefined;
}

/**
 * Reads the signed-in customer's own order history for the current business
 * *and* location -- matching the hostname -> single-location architecture, so
 * a customer who has ordered from a sibling location of the same business
 * does not see those orders mixed into this storefront's history. Requires a
 * real auth session -- the RPC is granted to `authenticated` only, so this
 * must not be called for an anonymous browser.
 */
export async function listCustomerOrders(businessId: string, locationId: string, businessKey: string): Promise<StorefrontOrder[]> {
  const result = await callUntypedRpc(getSupabaseClient().schema("ordering"), "list_customer_orders", {
    p_business_id: businessId,
    p_location_id: locationId,
  });
  if (result.error) throw result.error;

  const payload = readRecord(result.data as never, "The order history response");
  if (readNumber(payload.schemaVersion, "The order history schema version") !== 1) {
    throw new Error("The order history schema version is unsupported.");
  }

  return readArray(payload.orders as never, "The order history list").map((order) => parseOrder(order, businessKey));
}

export { orderStatusByDatabaseValue, paymentStatusByDatabaseValue };
