import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { beginCheckoutAttempt, clearCheckoutAttempt, readCheckoutAttempt } from "./checkout-attempt-storage";
import { cancelOrder as cancelOrderRequest, checkoutCart, getOrder, quoteCart, type ServerOrder } from "./api/storefront-checkout-api";
import { clearCartPointer } from "../cart/cart-pointer-storage";
import { storefrontCartQueryKey } from "../cart/storefront-cart-query";
import { storefrontContext } from "../../lib/storefront/storefront-context";
import type { CheckoutRequest, PaymentPendingOrder } from "../../domain/storefront";

export type CheckoutPhase =
  | "idle" | "quoting" | "quote_changed" | "creating_order" | "preparing_payment"
  | "awaiting_provider" | "confirming" | "confirmed" | "pending" | "failed"
  | "cancelled" | "verification_error" | "start_error" | "placing_order";

/** Payment outcomes from which nothing further happens without the customer acting. */
const terminalPaymentStatuses = new Set(["confirmed", "cancelled"]);

/**
 * Phases in which a real order exists and is being shown to the customer,
 * as opposed to still being created or waiting on the payment-provider
 * stub. Only in these phases does the tracking query below stay mounted --
 * that's what lets a realtime-triggered invalidateQueries actually refetch
 * instead of just marking an inactive cache entry stale.
 */
const trackedPhases = new Set<CheckoutPhase>(["confirming", "confirmed", "pending", "failed", "cancelled"]);

export function checkoutOrderQueryKey(orderId: string | null) {
  return ["storefront", "checkout-order", orderId] as const;
}

function phaseFromOrder(order: PaymentPendingOrder): CheckoutPhase {
  if (order.paymentStatus === "confirmed") return "confirmed";
  if (order.paymentStatus === "cancelled") return "cancelled";
  if (order.paymentStatus === "failed") return "failed";
  return "pending";
}

/**
 * quote_cart and checkout_cart raise two very different kinds of failure.
 *
 * Business-rule rejections (22023 invalid input, 55000 wrong object state) are
 * written to be read -- "delivery address is unserviceable", "restaurant
 * minimum order value is not met" -- so they are shown verbatim.
 *
 * Authorisation failures (42501) are not: they surface as "permission denied
 * for function quote_cart", which names internals and tells the customer
 * nothing. Both RPCs are granted to `authenticated` only, so in practice this
 * means the browser has no real session yet.
 */
const readableErrorCodes = new Set(["22023", "55000"]);

function checkoutErrorMessage(error: unknown, fallback: string) {
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;

  if (code === "42501" || (typeof message === "string" && message.startsWith("permission denied"))) {
    return "Please verify your phone number to place this order.";
  }

  if (typeof code === "string" && readableErrorCodes.has(code) && typeof message === "string" && message.length > 0) {
    return message;
  }

  return fallback;
}

function isCheckoutAccessError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;
  return code === "42501" || (typeof message === "string" && message.startsWith("permission denied"));
}

/**
 * Drives checkout against the real ordering RPCs.
 *
 * Two invariants hold throughout:
 *   1. The order's identifier is persisted *before* checkout_cart is called,
 *      so a lost response, a refresh, or a second tab all replay onto the same
 *      order instead of creating another one.
 *   2. A payment outcome is only ever read back from the server. Nothing in
 *      browser storage is allowed to assert that an order was paid.
 */
export function useCheckoutFlow(cartId: string | undefined, customerId: string | null, requestedOrderId: string | null = null) {
  const queryClient = useQueryClient();
  const [restored] = useState(() => Boolean(readCheckoutAttempt(storefrontContext)));
  // A direct load of /orders/:orderid (fresh navigation, reload, shared
  // link) carries no checkout attempt in localStorage -- that's only
  // written by this browser's own checkout. Track the URL's order id the
  // same way as a restored attempt so the tracking query below actually
  // runs instead of leaving `order` null forever.
  const [phase, setPhase] = useState<CheckoutPhase>(() => restored || requestedOrderId ? "confirming" : "idle");
  const [order, setOrder] = useState<PaymentPendingOrder | null>(null);
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(() => readCheckoutAttempt(storefrontContext)?.orderId ?? requestedOrderId);
  const [request, setRequest] = useState<CheckoutRequest | null>(null);
  const [updatedAmount, setUpdatedAmount] = useState<number | null>(null);
  const [startError, setStartError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();
  const activeRequest = useRef(false);
  const lastAttemptWasCash = useRef(false);
  // transition_order's compare-and-swap needs the order's *raw* database
  // status (e.g. "placed"), not the storefront-facing enum PaymentPendingOrder
  // carries -- tracked separately rather than widening that type for one caller.
  const databaseStatus = useRef<string | null>(null);

  /**
   * An active TanStack observer on the same query key verify() populates.
   * use-customer-orders-channel.ts invalidates this key by order id on
   * every order-changed broadcast; invalidateQueries only forces a real
   * refetch when there's an active observer, which this is, for exactly as
   * long as we're actually tracking a placed order.
   */
  const trackingQuery = useQuery({
    queryKey: checkoutOrderQueryKey(trackedOrderId),
    queryFn: () => getOrder(trackedOrderId as string),
    enabled: Boolean(trackedOrderId) && trackedPhases.has(phase),
    staleTime: 10_000,
    retry: false,
    // Mirrors customer-orders-query.ts and orders-query.ts: the realtime
    // broadcast has no replay, so a tab that missed it (asleep, backgrounded,
    // a dropped socket) needs this as its catch-up path back to the server.
    refetchOnWindowFocus: true,
  });

  const applyServerOrder = useCallback((result: ServerOrder) => {
    databaseStatus.current = result.databaseStatus;
    setOrder((current) => {
      // The server response doesn't carry this label (see
      // beginCashOnDelivery below) -- preserve whatever was already
      // showing across any later refresh of the same order.
      const paymentMethod = current?.trackingOrder.paymentMethod ?? result.order.trackingOrder.paymentMethod;
      return { ...result.order, trackingOrder: { ...result.order.trackingOrder, paymentMethod } };
    });
    setTrackedOrderId(result.order.id);
    if (terminalPaymentStatuses.has(result.order.paymentStatus)) clearCheckoutAttempt(storefrontContext);
    setPhase(phaseFromOrder(result.order));
  }, []);

  // Applies a background refetch -- realtime-invalidated or otherwise --
  // once we're already tracking a placed order, keeping the tracking
  // screen in sync with Admin without the customer doing anything.
  useEffect(() => {
    if (!trackingQuery.data) return;
    applyServerOrder(trackingQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingQuery.data]);

  const verify = useCallback(async () => {
    const orderId = order?.id ?? readCheckoutAttempt(storefrontContext)?.orderId ?? requestedOrderId;
    if (!orderId || activeRequest.current) return;
    activeRequest.current = true;
    setPhase("confirming");
    try {
      // A missing session/permission cannot be repaired by a network retry.
      // Make the retry policy explicit here rather than inheriting a future
      // QueryClient default, and keep the server as the only order authority.
      const serverOrder = await queryClient.fetchQuery({
        queryKey: checkoutOrderQueryKey(orderId),
        queryFn: () => getOrder(orderId),
        retry: false,
        staleTime: 0,
      });
      applyServerOrder(serverOrder);
    } catch (error) {
      // A persisted attempt would otherwise make every later page load repeat
      // the same forbidden get_order call. It is not a transient condition.
      if (isCheckoutAccessError(error)) clearCheckoutAttempt(storefrontContext);
      setPhase("verification_error");
    } finally {
      activeRequest.current = false;
    }
  }, [applyServerOrder, order, queryClient, requestedOrderId]);

  // Restoring a previous visit: the persisted value is only a pointer, so the
  // phase is rebuilt from whatever the server currently says about the order.
  useEffect(() => {
    if (!restored && !requestedOrderId) return;
    void verify();
    // Mount-only; verify() re-reads the persisted/requested id itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createOrder = useCallback(async (checkoutRequest: CheckoutRequest) => {
    if (!cartId) throw new Error("Your cart is still loading.");
    setPhase("creating_order");
    const orderId = beginCheckoutAttempt(storefrontContext);
    const result = await checkoutCart({
      orderId,
      cartId,
      fulfilment: checkoutRequest.fulfilment,
      customerBusinessAddressId: checkoutRequest.deliveryAddress?.id ?? null,
      customerNote: checkoutRequest.customerNote ?? null,
      paymentMethod: "online",
    });
    setOrder(result.order);
    setTrackedOrderId(result.order.id);

    // checkout_cart marks the cart 'converted', so the cached copy is stale and
    // the next add has to open a fresh cart. Only clear the pointer now that
    // conversion actually succeeded -- an aborted or failed checkout must
    // leave the still-active cart's pointer alone.
    void queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(customerId), exact: true });
    clearCartPointer(storefrontContext);

    // The payment hand-off is still a stub: no gateway is configured, so this
    // stops at "waiting for the provider" rather than claiming any outcome.
    setPhase("preparing_payment");
    setPhase("awaiting_provider");
  }, [cartId, customerId, queryClient]);

  const begin = useCallback(async (checkoutRequest: CheckoutRequest) => {
    if (activeRequest.current || !cartId) return;
    activeRequest.current = true;
    lastAttemptWasCash.current = false;
    setRequest(checkoutRequest);
    setStartError(undefined);
    setPhase("quoting");
    try {
      const quote = await quoteCart({
        cartId,
        fulfilment: checkoutRequest.fulfilment,
        customerBusinessAddressId: checkoutRequest.deliveryAddress?.id ?? null,
      });

      if (quote.grandTotal !== checkoutRequest.displayedTotal) {
        setUpdatedAmount(quote.grandTotal);
        setPhase("quote_changed");
        return;
      }

      await createOrder(checkoutRequest);
    } catch (error) {
      // quote_cart and checkout_cart raise for real, explainable conditions --
      // unserviceable address, unmet minimum, closed restaurant, an item that
      // has gone unavailable. Surface the server's own wording.
      setStartError(checkoutErrorMessage(error, "We couldn't start your payment."));
      setPhase("start_error");
    } finally {
      activeRequest.current = false;
    }
  }, [cartId, createOrder]);

  // Cash on delivery still creates a real order through checkout_cart (same
  // idempotent path as online checkout) -- it just skips the quote-recheck
  // and payment-provider hand-off, since there is no online payment to
  // prepare, going straight from order creation to the confirmed tracking
  // screen.
  const beginCashOnDelivery = useCallback(async (checkoutRequest: CheckoutRequest) => {
    if (activeRequest.current || !cartId) return null;
    activeRequest.current = true;
    lastAttemptWasCash.current = true;
    setRequest(checkoutRequest);
    setStartError(undefined);
    setPhase("placing_order");
    try {
      const orderId = beginCheckoutAttempt(storefrontContext);
      const result = await checkoutCart({
        orderId,
        cartId,
        fulfilment: checkoutRequest.fulfilment,
        customerBusinessAddressId: checkoutRequest.deliveryAddress?.id ?? null,
        customerNote: checkoutRequest.customerNote ?? null,
        paymentMethod: "cash",
      });

      void queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(customerId), exact: true });
      clearCartPointer(storefrontContext);

      // The server has already created this order as 'placed'; only the
      // customer-facing payment-method label is added here. Nothing about the
      // order's own status is invented client-side -- an earlier version
      // overrode paymentStatus to "confirmed" locally, which made a cash order
      // look confirmed while it sat unplaced and invisible to the restaurant.
      const cashOrder: PaymentPendingOrder = {
        ...result.order,
        trackingOrder: { ...result.order.trackingOrder, paymentMethod: "Cash on delivery" },
      };
      setOrder(cashOrder);
      setTrackedOrderId(cashOrder.id);
      clearCheckoutAttempt(storefrontContext);
      setPhase("confirmed");
      return cashOrder;
    } catch (error) {
      setStartError(checkoutErrorMessage(error, "We couldn't place your order."));
      setPhase("start_error");
      return null;
    } finally {
      activeRequest.current = false;
    }
  }, [cartId, customerId, queryClient]);

  const acceptUpdatedQuote = useCallback(() => {
    if (!request || activeRequest.current) return;
    activeRequest.current = true;
    setUpdatedAmount(null);
    void createOrder(request)
      .catch((error: unknown) => {
        setStartError(checkoutErrorMessage(error, "We couldn't start your payment."));
        setPhase("start_error");
      })
      .finally(() => { activeRequest.current = false; });
  }, [createOrder, request]);

  /**
   * Safe to call repeatedly: beginCheckoutAttempt hands back the *same* order
   * id, so checkout_cart recognises the already-converted cart and replays the
   * existing order rather than creating a second one.
   */
  const retryPayment = useCallback(() => {
    if (order) { void verify(); return; }
    if (!request) return;
    void (lastAttemptWasCash.current ? beginCashOnDelivery(request) : begin(request));
  }, [begin, beginCashOnDelivery, order, request, verify]);

  /**
   * Coming back from the payment app is a prompt to re-read the server, never a
   * report of the outcome -- any status the caller passes is ignored on
   * purpose, because the browser is not allowed to decide this.
   */
  const returnFromProvider = useCallback(() => { void verify(); }, [verify]);

  /**
   * Cancels the tracked order for real (see cancelOrder in
   * storefront-checkout-api.ts) instead of only toggling local UI state.
   * transition_order rejects atomically if the restaurant has already
   * accepted the order or the 90-second window has closed -- that shows up
   * here as a thrown error, surfaced via cancelError, with the tracking
   * screen re-synced to whatever the server actually did.
   */
  const cancelOrder = useCallback(async () => {
    if (!trackedOrderId || !databaseStatus.current || cancelling) return;
    setCancelling(true);
    setCancelError(undefined);
    try {
      const result = await cancelOrderRequest(trackedOrderId, databaseStatus.current, "Cancelled by customer");
      applyServerOrder(result);
    } catch (error) {
      setCancelError(checkoutErrorMessage(error, "We couldn't cancel this order. It may have already been accepted."));
      void verify();
    } finally {
      setCancelling(false);
    }
  }, [applyServerOrder, cancelling, trackedOrderId, verify]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && phase === "awaiting_provider") void verify();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [phase, verify]);

  return { acceptUpdatedQuote, begin, beginCashOnDelivery, cancelError, cancelling, cancelOrder, order, phase, restored, returnFromProvider, retryPayment, startError, updatedAmount, verify };
}
