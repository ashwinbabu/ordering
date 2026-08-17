import { getSupabaseClient } from "../../../lib/supabase/client";
import { readArray, readNullableNumber, readNullableString, readNumber, readRecord, readString } from "../../../lib/supabase/json-parsing";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";
import { orderStatusByDatabaseValue, paymentStatusByDatabaseValue } from "../../orders/api/customer-orders-api";
import type { DeliveryAddress, FulfilmentType, OrderLineItem, PaymentPendingOrder, PaymentStatus, StorefrontOrder } from "../../../domain/storefront";

/**
 * ordering.checkout_cart requires p_trusted_delivery_minutes >= the cart's
 * highest product prep time for delivery orders, and no public RPC exposes
 * prep times to the browser. 45 clears the current maximum (25, with 25 as the
 * per-location default) with headroom.
 *
 * If a prep time is ever raised past this, calculate_order_quote raises
 * 'trusted delivery estimate must include kitchen preparation time' -- a loud,
 * visible failure rather than a quietly wrong ETA. Pickup ignores the value.
 */
export const trustedDeliveryMinutes = 45;

function checkoutRpc() {
  return getSupabaseClient().schema("ordering");
}

export interface CartQuote {
  fulfilment: FulfilmentType;
  currency: string;
  foodSubtotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee: number;
  grandTotal: number;
  couponCode: string | null;
  estimatedDeliveryMinutes: number | null;
}

/**
 * ordering.get_order and ordering.checkout_cart both return snake_case keys.
 * (ordering.list_customer_orders returns camelCase -- the two RPCs genuinely
 * differ, so they need separate parsers rather than a shared one.)
 */
function parseDeliveryAddressSnapshot(value: unknown): DeliveryAddress | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const snapshot = value as Record<string, unknown>;
  const text = (key: string) => typeof snapshot[key] === "string" ? snapshot[key] as string : "";

  return {
    id: "order-address",
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

function parseOrderItem(value: unknown): OrderLineItem {
  const item = readRecord(value as never, "An order item");
  const options = readArray(item.options as never, "An order item's options").map((option) => {
    const record = readRecord(option as never, "An order item option");
    return readString(record.option_name, "An order item option name");
  });

  return {
    id: readString(item.id, "An order item ID"),
    productId: readNullableString(item.product_id, "An order item product ID") ?? undefined,
    name: readString(item.product_name, "An order item name"),
    quantity: readNumber(item.quantity, "An order item quantity"),
    unitPrice: readNumber(item.final_unit_price, "An order item unit price"),
    selectedOptions: options.length ? options : undefined,
    note: readNullableString(item.customer_note, "An order item note") ?? undefined,
  };
}

/**
 * Collapses the server's order + payment status onto the storefront's payment
 * vocabulary. This is the only place a payment outcome is decided, and it is
 * decided from server state -- never from a locally remembered value.
 */
function paymentStatusFromOrder(status: string, paymentStatus: string): PaymentStatus {
  if (paymentStatus === "paid") return "confirmed";
  if (status === "cancelled") return "cancelled";
  if (paymentStatus === "failed") return "failed";
  return "pending";
}

export interface ServerOrder {
  order: PaymentPendingOrder;
  /** Raw server status, so callers can distinguish payment_pending from a live order. */
  databaseStatus: string;
}

function parseOrder(value: unknown): ServerOrder {
  const order = readRecord(value as never, "The order response");
  const id = readString(order.id, "The order ID");
  const orderNumber = readString(order.order_number, "The order number");
  const databaseStatus = readString(order.status, "The order status");
  const databasePaymentStatus = readString(order.payment_status, "The order payment status");
  const fulfilment: FulfilmentType = readString(order.fulfillment_type, "The order fulfilment type") === "pickup" ? "pickup" : "delivery";
  const items = readArray(order.items as never, "The order items").map(parseOrderItem);
  const grandTotal = readNumber(order.grand_total, "The order total");
  const createdAt = readString(order.created_at, "The order created timestamp");
  const estimatedMinutes = readNullableNumber(order.estimated_delivery_minutes, "The order delivery estimate");

  const trackingOrder: StorefrontOrder = {
    id: orderNumber,
    restaurantId: readString(order.business_id, "The order business ID"),
    placedAt: readNullableString(order.placed_at, "The order placed timestamp") ?? createdAt,
    status: orderStatusByDatabaseValue[databaseStatus] ?? "placed",
    paymentStatus: paymentStatusByDatabaseValue[databasePaymentStatus] ?? "pending",
    fulfilment,
    items,
    subtotal: readNumber(order.food_subtotal, "The order subtotal"),
    discount: readNumber(order.discount_total, "The order discount"),
    deliveryFee: readNumber(order.delivery_fee, "The order delivery fee"),
    taxes: readNumber(order.tax_total, "The order tax total"),
    total: grandTotal,
    couponCode: readNullableString(order.coupon_code, "The order coupon code") ?? undefined,
    deliveryAddress: parseDeliveryAddressSnapshot(order.delivery_address),
    orderNote: readNullableString(order.customer_note, "The order note") ?? undefined,
    estimatedFulfilment: estimatedMinutes ? `About ${estimatedMinutes} min` : undefined,
    completedAt: readNullableString(order.delivered_at, "The order delivered timestamp") ?? undefined,
    cancellationReason: readNullableString(order.cancel_reason, "The order cancellation reason") ?? undefined,
  };

  return {
    databaseStatus,
    order: {
      id,
      orderNumber,
      amount: grandTotal,
      createdAt: readNullableString(order.placed_at, "The order placed timestamp") ?? createdAt,
      fulfilment,
      itemCount: items.reduce((count, item) => count + item.quantity, 0),
      paymentStatus: paymentStatusFromOrder(databaseStatus, databasePaymentStatus),
      trackingOrder,
    },
  };
}

/**
 * Authoritative pricing for the cart as it stands right now. Raises for an
 * unserviceable address, an unmet minimum, a closed restaurant, an unavailable
 * item or an incomplete option group -- all expected outcomes the caller
 * surfaces rather than errors to swallow.
 */
export async function quoteCart(args: {
  cartId: string;
  fulfilment: FulfilmentType;
  customerBusinessAddressId: string | null;
}): Promise<CartQuote> {
  const result = await callUntypedRpc(checkoutRpc(), "quote_cart", {
    p_cart_id: args.cartId,
    p_anonymous_session_id: null,
    p_fulfillment_type: args.fulfilment,
    p_customer_business_address_id: args.customerBusinessAddressId,
    p_trusted_delivery_minutes: args.fulfilment === "delivery" ? trustedDeliveryMinutes : null,
  });
  if (result.error) throw result.error;

  const quote = readRecord(result.data as never, "The cart quote response");
  return {
    fulfilment: readString(quote.fulfillment_type, "The quote fulfilment type") === "pickup" ? "pickup" : "delivery",
    currency: readString(quote.currency, "The quote currency"),
    foodSubtotal: readNumber(quote.food_subtotal, "The quote subtotal"),
    discountTotal: readNumber(quote.discount_total, "The quote discount"),
    taxTotal: readNumber(quote.tax_total, "The quote tax total"),
    deliveryFee: readNumber(quote.delivery_fee, "The quote delivery fee"),
    grandTotal: readNumber(quote.grand_total, "The quote total"),
    couponCode: readNullableString(quote.coupon_code, "The quote coupon code"),
    estimatedDeliveryMinutes: readNullableNumber(quote.estimated_delivery_minutes, "The quote delivery estimate"),
  };
}

/**
 * Converts the cart into an order. Idempotent on `orderId`: replaying the same
 * id after a lost response returns the order that was already created, so the
 * caller must persist the id before the first attempt.
 */
export async function checkoutCart(args: {
  orderId: string;
  cartId: string;
  fulfilment: FulfilmentType;
  customerBusinessAddressId: string | null;
  customerNote: string | null;
  // "cash" makes checkout_cart create the order already 'placed' (there is no
  // provider hand-off to wait for), which is what puts it in front of the
  // restaurant. "online" keeps the payment_pending -> placed flow.
  paymentMethod: "cash" | "online";
}): Promise<ServerOrder> {
  const result = await callUntypedRpc(checkoutRpc(), "checkout_cart", {
    p_order_id: args.orderId,
    p_cart_id: args.cartId,
    p_fulfillment_type: args.fulfilment,
    p_customer_business_address_id: args.customerBusinessAddressId,
    p_customer_note: args.customerNote,
    p_trusted_delivery_minutes: args.fulfilment === "delivery" ? trustedDeliveryMinutes : null,
    p_payment_method: args.paymentMethod,
  });
  if (result.error) throw result.error;
  return parseOrder(result.data);
}

/** The single source of truth for an order's status, including payment outcome. */
export async function getOrder(orderId: string): Promise<ServerOrder> {
  const result = await callUntypedRpc(checkoutRpc(), "get_order", { p_order_id: orderId });
  if (result.error) throw result.error;
  return parseOrder(result.data);
}

/**
 * Cancels the customer's own order via the same compare-and-swap transition
 * every other status change goes through (ordering.transition_order ->
 * private.transition_order_internal). That function only allows this for the
 * order's own customer, while status is still 'placed', within 90 seconds of
 * placed_at -- and atomically rejects if the restaurant has already accepted
 * it (p_expected_status no longer matches), so a lost race surfaces as an
 * error here rather than silently overriding the restaurant's acceptance.
 */
export async function cancelOrder(orderId: string, expectedStatus: string, reason: string): Promise<ServerOrder> {
  const result = await callUntypedRpc(checkoutRpc(), "transition_order", {
    p_order_id: orderId,
    p_expected_status: expectedStatus,
    p_new_status: "cancelled",
    p_cancel_reason: reason,
  });
  if (result.error) throw result.error;
  return parseOrder(result.data);
}
