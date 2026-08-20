import { isPositiveAmount, formatMoney } from "../../money.ts";
import type { OrderActorType } from "../../types.ts";

export interface OrderEmailItemOption {
  optionGroupName: string;
  optionName: string;
  priceDelta: string;
  quantity: number;
}

export interface OrderEmailItem {
  productName: string;
  quantity: number;
  lineTotal: string;
  customerNote: string | null;
  options: OrderEmailItemOption[];
}

export interface OrderEmailCommon {
  orderNumber: string;
  orderUrl: string | null;
  business: { name: string; logoUrl: string | null };
  location: { name: string; phone: string | null; addressLine: string | null };
  customerFirstName: string | null;
  currency: string;
  locale: string;
  timezone: string;
}

export interface OrderPlacedEmailData extends OrderEmailCommon {
  placedAtIso: string | null;
  fulfillmentType: string;
  estimatedDeliveryMinutes: number | null;
  deliveryAddressLine: string | null;
  deliveryInstructions: string | null;
  items: OrderEmailItem[];
  foodSubtotal: string;
  discountTotal: string;
  taxTotal: string;
  deliveryFee: string;
  grandTotal: string;
  paymentMethod: string;
  paymentStatus: string;
  customerNote: string | null;
}

export interface OrderCancelledEmailData extends OrderEmailCommon {
  cancelledAtIso: string | null;
  cancelledByActorType: OrderActorType;
  cancelReason: string | null;
  grandTotal: string;
  refundMessage: string;
}

// Shape returned by public.notifications_get_order_context -- kept loose
// (not re-typed field by field) since it's an internal RPC boundary, not a
// public contract; the builder functions below are the real typed contract.
// deno-lint-ignore no-explicit-any
type RawOrderContext = any;

export interface BuildEmailDataOptions {
  devDefaultStorefrontUrl: string | null;
  environment: "development" | "production";
}

function firstNameFrom(displayName: string | null | undefined): string | null {
  const trimmed = displayName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

/** Resolves the /orders/:id CTA link for the correct tenant's storefront
 * domain. Never falls back to another tenant's domain: the dev default is
 * only used when the environment explicitly self-identifies as development,
 * and in production an unresolved domain means the CTA is simply omitted. */
function resolveOrderUrl(
  orderId: string,
  storefrontDomain: string | null | undefined,
  opts: BuildEmailDataOptions,
): string | null {
  if (storefrontDomain) {
    return `https://${storefrontDomain}/orders/${orderId}`;
  }
  if (opts.environment === "development" && opts.devDefaultStorefrontUrl) {
    return `${opts.devDefaultStorefrontUrl.replace(/\/$/, "")}/orders/${orderId}`;
  }
  return null;
}

function mapItems(rawItems: RawOrderContext[]): OrderEmailItem[] {
  return (rawItems ?? []).map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    customerNote: item.customerNote ?? null,
    options: (item.options ?? []).map((opt: RawOrderContext) => ({
      optionGroupName: opt.optionGroupName,
      optionName: opt.optionName,
      priceDelta: opt.priceDelta,
      quantity: opt.quantity,
    })),
  }));
}

function formatDeliveryAddressLine(snapshot: RawOrderContext | null | undefined): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const parts = [
    snapshot.address_line_1,
    snapshot.address_line_2,
    snapshot.locality,
    snapshot.city,
    snapshot.state,
    snapshot.postal_code,
  ].filter((part) => typeof part === "string" && part.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function buildCommon(context: RawOrderContext, opts: BuildEmailDataOptions): OrderEmailCommon {
  const { order, business, location, customer } = context;
  return {
    orderNumber: order.orderNumber,
    orderUrl: resolveOrderUrl(order.id, location?.storefrontDomain, opts),
    business: { name: business?.name ?? "", logoUrl: business?.logoUrl ?? null },
    location: {
      name: location?.name ?? "",
      phone: location?.phone ?? null,
      addressLine: location?.addressLine ?? null,
    },
    customerFirstName: firstNameFrom(customer?.displayName),
    currency: order.currency,
    locale: "en-IN",
    timezone: business?.timezone ?? "Asia/Kolkata",
  };
}

export function buildOrderPlacedEmailData(
  context: RawOrderContext,
  opts: BuildEmailDataOptions,
): OrderPlacedEmailData {
  const { order } = context;
  const snapshot = order.deliveryAddressSnapshot;
  return {
    ...buildCommon(context, opts),
    placedAtIso: order.placedAt,
    fulfillmentType: order.fulfillmentType,
    estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
    deliveryAddressLine: order.fulfillmentType === "delivery" ? formatDeliveryAddressLine(snapshot) : null,
    deliveryInstructions:
      order.fulfillmentType === "delivery" && snapshot && typeof snapshot === "object"
        ? (snapshot.delivery_instructions ?? null)
        : null,
    items: mapItems(context.items),
    foodSubtotal: order.foodSubtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    deliveryFee: order.deliveryFee,
    grandTotal: order.grandTotal,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    customerNote: order.customerNote,
  };
}

function buildRefundMessage(context: RawOrderContext): string {
  const facts = context.refundFacts ?? {};
  const currency = context.order.currency;

  if (!facts.paymentTaken) {
    return "No payment was taken for this order, so there is nothing to refund.";
  }
  if (facts.latestRefundStatus === "completed" && isPositiveAmount(facts.refundedAmount)) {
    return `${formatMoney(facts.refundedAmount, currency)} has been refunded.`;
  }
  if (facts.latestRefundStatus === "pending" || facts.latestRefundStatus === "processing") {
    return "Your refund is being processed.";
  }
  if (facts.latestRefundStatus === "failed") {
    return "We attempted to process your refund but it did not go through yet. Our team has been notified and will follow up.";
  }
  return "Your payment will be refunded shortly.";
}

export function buildOrderCancelledEmailData(
  context: RawOrderContext,
  actorType: OrderActorType,
  opts: BuildEmailDataOptions,
): OrderCancelledEmailData {
  const { order } = context;
  return {
    ...buildCommon(context, opts),
    cancelledAtIso: order.cancelledAt,
    cancelledByActorType: actorType,
    cancelReason: order.cancelReason,
    grandTotal: order.grandTotal,
    refundMessage: buildRefundMessage(context),
  };
}
