import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckoutRequest, PaymentPendingOrder, PaymentStatus } from "../../domain/storefront";
import { demoCheckoutService } from "./services/demo-checkout-service";

export type CheckoutPhase =
  | "idle" | "quoting" | "quote_changed" | "creating_order" | "preparing_payment"
  | "awaiting_provider" | "confirming" | "confirmed" | "pending" | "failed"
  | "cancelled" | "verification_error" | "start_error";

interface PersistedCheckout {
  order: PaymentPendingOrder;
  phase: CheckoutPhase;
}

const storageKey = "a2-storefront-active-checkout";

function readPersistedCheckout(): PersistedCheckout | null {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as PersistedCheckout : null;
  } catch {
    return null;
  }
}

export function useCheckoutFlow() {
  const [restored] = useState(readPersistedCheckout);
  const [phase, setPhase] = useState<CheckoutPhase>(() => restored?.phase === "awaiting_provider" ? "confirming" : restored?.phase ?? "idle");
  const [order, setOrder] = useState<PaymentPendingOrder | null>(() => restored?.order ?? null);
  const [request, setRequest] = useState<CheckoutRequest | null>(null);
  const [updatedAmount, setUpdatedAmount] = useState<number | null>(null);
  const activeRequest = useRef(false);

  useEffect(() => {
    if (!order) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify({ order, phase })); } catch { /* persistence is optional in demo mode */ }
  }, [order, phase]);

  const verify = useCallback(async (targetOrder = order) => {
    if (!targetOrder || activeRequest.current) return;
    activeRequest.current = true;
    setPhase("confirming");
    try {
      const status = await demoCheckoutService.getPaymentStatus(targetOrder);
      if (status === "confirmed") setOrder({ ...targetOrder, paymentStatus: status, trackingOrder: { ...targetOrder.trackingOrder, paymentStatus: "paid" } });
      setPhase(status);
    } catch {
      setPhase("verification_error");
    } finally {
      activeRequest.current = false;
    }
  }, [order]);

  const preparePayment = useCallback(async (checkoutRequest: CheckoutRequest | null, amount: number) => {
    if (activeRequest.current) return;
    activeRequest.current = true;
    try {
      // A paid order is complete. Only a pending order may be reused for a retry.
      let nextOrder = order?.paymentStatus === "confirmed" ? null : order;
      if (!nextOrder) {
        if (!checkoutRequest) { setPhase("start_error"); return; }
        setPhase("creating_order");
        nextOrder = await demoCheckoutService.createPaymentPendingOrder(checkoutRequest, amount);
        setOrder(nextOrder);
      }
      setPhase("preparing_payment");
      await demoCheckoutService.preparePayment(nextOrder);
      setPhase("awaiting_provider");
    } catch {
      setPhase("start_error");
    } finally {
      activeRequest.current = false;
    }
  }, [order]);

  const begin = useCallback(async (checkoutRequest: CheckoutRequest) => {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setRequest(checkoutRequest);
    setPhase("quoting");
    try {
      const quote = await demoCheckoutService.getFinalQuote(checkoutRequest);
      if (quote.total !== checkoutRequest.displayedTotal) {
        setUpdatedAmount(quote.total);
        setPhase("quote_changed");
      } else {
        activeRequest.current = false;
        await preparePayment(checkoutRequest, quote.total);
        return;
      }
    } catch {
      setPhase("start_error");
    } finally {
      activeRequest.current = false;
    }
  }, [preparePayment]);

  const acceptUpdatedQuote = useCallback(() => {
    if (request && updatedAmount !== null) void preparePayment(request, updatedAmount);
  }, [preparePayment, request, updatedAmount]);

  const returnFromProvider = useCallback((status: PaymentStatus) => {
    if (!order) return;
    const nextOrder = { ...order, paymentStatus: status };
    setOrder(nextOrder);
    void verify(nextOrder);
  }, [order, verify]);

  const retryPayment = useCallback(() => {
    if (order) void preparePayment(request, order.amount);
  }, [order, preparePayment, request]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && phase === "awaiting_provider") returnFromProvider("pending");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [phase, returnFromProvider]);

  useEffect(() => {
    if (phase === "confirming" && order && !activeRequest.current) void verify(order);
  }, [order, phase, verify]);

  return { acceptUpdatedQuote, begin, order, phase, restored: Boolean(restored), returnFromProvider, retryPayment, updatedAmount, verify };
}
