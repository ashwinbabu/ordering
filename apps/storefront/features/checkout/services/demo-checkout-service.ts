import type { CheckoutRequest, PaymentPendingOrder, PaymentStatus } from "../../../domain/storefront";

/**
 * Local-only checkout boundary. A future trusted backend replaces these calls;
 * UI code must never use a browser-calculated amount to create a real payment.
 */
export const demoCheckoutService = {
  async getFinalQuote(request: CheckoutRequest) {
    await wait(350);
    return { total: request.displayedTotal };
  },

  async createPaymentPendingOrder(request: CheckoutRequest, amount: number): Promise<PaymentPendingOrder> {
    await wait(450);
    const id = `A2-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    return {
      id,
      amount,
      createdAt,
      fulfilment: request.fulfilment,
      itemCount: request.cart.reduce((count, line) => count + line.quantity, 0),
      paymentStatus: "awaiting_provider",
      trackingOrder: {
        id,
        restaurantId: "demo-local",
        placedAt: createdAt,
        status: "placed",
        paymentStatus: "pending",
        fulfilment: request.fulfilment,
        items: request.items,
        subtotal: request.subtotal,
        discount: 0,
        deliveryFee: request.deliveryFee,
        taxes: request.taxes,
        total: amount,
        deliveryAddress: request.deliveryAddress,
      },
    };
  },

  async preparePayment(order: PaymentPendingOrder) {
    await wait(450);
    return order;
  },

  async getPaymentStatus(order: PaymentPendingOrder): Promise<PaymentStatus> {
    await wait(550);
    return order.paymentStatus === "awaiting_provider" ? "pending" : order.paymentStatus;
  },
};

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}
