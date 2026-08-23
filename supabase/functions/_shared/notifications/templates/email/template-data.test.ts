import { assertEquals } from "jsr:@std/assert@1";
import { buildOrderCancelledEmailData, buildOrderPlacedEmailData } from "./template-data.ts";

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      id: "order-1",
      orderNumber: "A2-000001",
      currency: "INR",
      fulfillmentType: "pickup",
      placedAt: "2026-08-20T12:00:00Z",
      estimatedDeliveryMinutes: 25,
      deliveryAddressSnapshot: null,
      foodSubtotal: "500.00",
      discountTotal: "0.00",
      taxTotal: "23.81",
      deliveryFee: "0.00",
      grandTotal: "500.00",
      paymentMethod: "cash",
      paymentStatus: "pending",
      customerNote: null,
      cancelledAt: "2026-08-20T12:10:00Z",
      cancelReason: "Customer changed their mind",
    },
    items: [],
    business: { name: "A2 Food and Beverages", logoUrl: null, timezone: "Asia/Kolkata", currency: "INR" },
    location: { name: "Arambol", phone: "+918669971407", addressLine: "Beach Road", storefrontDomain: null },
    customer: { id: "cust-1", email: "real@example.com", displayName: "Meera Shah" },
    payment: null,
    refundFacts: { paymentTaken: false, refundedAmount: "0", latestRefundStatus: null },
    ...overrides,
  };
}

Deno.test("orderUrl: uses the real storefront domain when the location has one", () => {
  const context = baseContext({
    location: { name: "Arambol", phone: null, addressLine: null, storefrontDomain: "ordering-storefront-dev.vercel.app" },
  });
  const data = buildOrderPlacedEmailData(context, { devDefaultStorefrontUrl: "https://dev.example.com", environment: "development" });
  assertEquals(data.orderUrl, "https://ordering-storefront-dev.vercel.app/orders/order-1");
});

Deno.test("orderUrl: falls back to the dev default only in development, when no storefront domain is set", () => {
  const context = baseContext();
  const data = buildOrderPlacedEmailData(context, { devDefaultStorefrontUrl: "https://dev.example.com", environment: "development" });
  assertEquals(data.orderUrl, "https://dev.example.com/orders/order-1");
});

Deno.test("orderUrl: is omitted (never fabricated) in production with no resolved domain", () => {
  const context = baseContext();
  const data = buildOrderPlacedEmailData(context, { devDefaultStorefrontUrl: "https://dev.example.com", environment: "production" });
  assertEquals(data.orderUrl, null);
});

Deno.test("refund message: cash/unpaid order has nothing to refund", () => {
  const context = baseContext({ refundFacts: { paymentTaken: false, refundedAmount: "0", latestRefundStatus: null } });
  const data = buildOrderCancelledEmailData(context, "customer", { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(data.refundMessage, "No payment was taken for this order, so there is nothing to refund.");
});

Deno.test("refund message: completed refund states the exact amount", () => {
  const context = baseContext({
    refundFacts: { paymentTaken: true, refundedAmount: "500.00", latestRefundStatus: "completed" },
  });
  const data = buildOrderCancelledEmailData(context, "admin", { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(data.refundMessage, "₹500.00 has been refunded.");
});

Deno.test("refund message: pending refund status", () => {
  const context = baseContext({
    refundFacts: { paymentTaken: true, refundedAmount: "0", latestRefundStatus: "pending" },
  });
  const data = buildOrderCancelledEmailData(context, "system", { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(data.refundMessage, "Your refund is being processed.");
});

Deno.test("refund message: paid but no refund record yet does not invent a timeline", () => {
  const context = baseContext({
    refundFacts: { paymentTaken: true, refundedAmount: "0", latestRefundStatus: null },
  });
  const data = buildOrderCancelledEmailData(context, "admin", { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(data.refundMessage, "Your payment will be refunded shortly.");
});

Deno.test("cancelledByActorType passes through the domain event's actor", () => {
  const context = baseContext();
  const data = buildOrderCancelledEmailData(context, "telegram", { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(data.cancelledByActorType, "telegram");
});

Deno.test("customerFirstName derives from display name; falls back to null", () => {
  const withName = buildOrderPlacedEmailData(baseContext(), { devDefaultStorefrontUrl: null, environment: "development" });
  assertEquals(withName.customerFirstName, "Meera");

  const withoutCustomer = buildOrderPlacedEmailData(
    baseContext({ customer: null }),
    { devDefaultStorefrontUrl: null, environment: "development" },
  );
  assertEquals(withoutCustomer.customerFirstName, null);
});
