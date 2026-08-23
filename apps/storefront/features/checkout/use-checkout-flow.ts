import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginCheckoutAttempt,
  beginPaymentAttempt,
  clearCheckoutAttempt,
  readCheckoutAttempt,
} from "./checkout-attempt-storage";
import {
  cancelOrder as cancelOrderRequest,
  checkoutCart,
  getOrder,
  PaymentVerificationError,
  quoteCart,
  startOnlinePayment,
  verifyOnlinePayment,
  type ServerOrder,
} from "./api/storefront-checkout-api";
import { openRazorpayCheckout } from "./razorpay-checkout";
import { clearCartPointer } from "../cart/cart-pointer-storage";
import {
  resolveCartIdentity,
  storefrontCartQueryKey,
} from "../cart/storefront-cart-query";
import { storefrontContext } from "../../lib/storefront/storefront-context";
import type {
  CheckoutRequest,
  PaymentPendingOrder,
} from "../../domain/storefront";
import type { ServerCart } from "../../domain/cart";

/**
 * What quote_cart/checkout_cart need to identify and act on a cart, resolved
 * the same way -- from the same function -- as every other cart RPC in the
 * app (see storefront-cart-query.ts). Neither RPC accepts a separate
 * anonymous-session credential (both always send null; checkout is
 * authenticated-only), so `cartId` is the only field either call reads off
 * this, but resolving the whole snapshot keeps checkout on the same single
 * source of identity as the rest of the cart instead of a parallel,
 * cartId-only helper that could drift from it.
 */
type CartIdentity = ReturnType<typeof resolveCartIdentity>;

export type CheckoutPhase =
  | "idle"
  | "quoting"
  | "quote_changed"
  | "creating_order"
  | "preparing_payment"
  | "awaiting_provider"
  | "confirming"
  | "confirmed"
  | "pending"
  | "failed"
  | "cancelled"
  | "verification_error"
  | "start_error"
  | "placing_order";

/** Payment outcomes from which nothing further happens without the customer acting. */
const terminalPaymentStatuses = new Set(["confirmed", "cancelled"]);

/**
 * Phases in which a real order exists and is being shown to the customer,
 * as opposed to still being created or waiting on the payment-provider
 * stub. Only in these phases does the tracking query below stay mounted --
 * that's what lets a realtime-triggered invalidateQueries actually refetch
 * instead of just marking an inactive cache entry stale.
 */
const trackedPhases = new Set<CheckoutPhase>([
  "confirming",
  "confirmed",
  "pending",
  "failed",
  "cancelled",
]);

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

/** Exported for reuse by the /orders/:orderId route's own cancel handler, which calls cancelOrder directly rather than through this hook -- see use-order-by-id.ts. */
export function checkoutErrorMessage(error: unknown, fallback: string) {
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;

  if (
    code === "42501" ||
    (typeof message === "string" && message.startsWith("permission denied"))
  ) {
    return "Please verify your phone number to place this order.";
  }

  if (
    typeof code === "string" &&
    readableErrorCodes.has(code) &&
    typeof message === "string" &&
    message.length > 0
  ) {
    return message;
  }

  return fallback;
}

function isCheckoutAccessError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;
  return (
    code === "42501" ||
    (typeof message === "string" && message.startsWith("permission denied"))
  );
}

/**
 * checkout_cart's own 42501s are not all the same failure. Its very first
 * statement is `if not can_access_cart(p_cart_id, null) then raise 42501
 * 'cart access denied'` -- that message means the cart on file no longer
 * belongs to this identity, a genuine race between this hook's snapshot and
 * a concurrent change (another tab attaching or re-claiming the cart). Any
 * other 42501 (checkout_cart's own 'checkout requires authentication', or a
 * bare "permission denied for function" from the RLS grant rejecting an
 * unauthenticated caller before the function body ever runs) means this
 * browser has no usable session at all -- re-reading the cart cannot fix
 * that, so only the first case is worth retrying.
 *
 * Retrying the first case is safe: the access check runs before any insert,
 * so a raised exception leaves nothing partially written, and the retry
 * reuses the same orderId already persisted by beginCheckoutAttempt --
 * checkout_cart's own idempotency check (converted cart + matching
 * converted_order_id returns the existing order) means even a retry that
 * lands after an earlier attempt's eventual success cannot create a second
 * order.
 */
function isCartIdentityCheckoutError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = (error as { message?: unknown } | null)?.message;
  return code === "42501" && message === "cart access denied";
}

/**
 * Drives checkout against the real ordering RPCs.
 *
 * Three invariants hold throughout:
 *   1. The order's identifier is persisted *before* checkout_cart is called,
 *      so a lost response, a refresh, or a second tab all replay onto the same
 *      order instead of creating another one.
 *   2. A payment outcome is only ever read back from the server. Nothing in
 *      browser storage is allowed to assert that an order was paid.
 *   3. `getCartIdentity` is called fresh, immediately before each RPC that
 *      needs it -- never once at the top of a callback and reused across an
 *      `await`. quote_cart and checkout_cart are treated as two independent
 *      RPCs for this purpose: checkout_cart re-resolves identity on its own
 *      rather than trusting whatever quote_cart's call happened to read,
 *      since checkout_cart recomputes its own authoritative total from the
 *      cart regardless of what was quoted.
 *   4. `getCustomerId` (not a plain `customerId` value) is what any cache
 *      key here is built from, for the same reason as (3): auth can
 *      transition while a checkout call is in flight or being recovered,
 *      and a `customerId` captured at the top of a long-running callback
 *      would keep targeting the pre-transition cache slot for the rest of
 *      that callback's life, including its own retry.
 */
export function useCheckoutFlow(
  getCartIdentity: () => CartIdentity | undefined,
  getCustomerId: () => string | null,
  cart: ServerCart | undefined,
  requestedOrderId: string | null = null,
) {
  const queryClient = useQueryClient();
  const [restored] = useState(() =>
    Boolean(readCheckoutAttempt(storefrontContext)),
  );
  // A direct load of /orders/:orderid (fresh navigation, reload, shared
  // link) carries no checkout attempt in localStorage -- that's only
  // written by this browser's own checkout. Track the URL's order id the
  // same way as a restored attempt so the tracking query below actually
  // runs instead of leaving `order` null forever.
  const [phase, setPhase] = useState<CheckoutPhase>(() =>
    restored || requestedOrderId ? "confirming" : "idle",
  );
  const [order, setOrder] = useState<PaymentPendingOrder | null>(null);
  const [trackedOrderId, setTrackedOrderIdState] = useState<string | null>(
    () => readCheckoutAttempt(storefrontContext)?.orderId ?? requestedOrderId,
  );
  /**
   * Ref mirror of trackedOrderId for callbacks that can outlive the render
   * that captured them (applyServerOrder's guard below) -- the same
   * reasoning as getCartIdentity/getCustomerId elsewhere in this file: a
   * plain closure over state would keep targeting whichever order was
   * tracked when that async chain started, not whichever order (if any) is
   * still actually being tracked by the time it resolves. Always written
   * together with the state via setTrackedOrder, never on its own.
   */
  const trackedOrderIdRef = useRef(trackedOrderId);
  const setTrackedOrder = useCallback((id: string | null) => {
    trackedOrderIdRef.current = id;
    setTrackedOrderIdState(id);
  }, []);
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
   * The cart a checkout attempt was created against -- the lifecycle
   * boundary this hook resets on (see the retirement effect below). Set the
   * moment an attempt starts, from the cart identity actually used for it;
   * lazily anchored to whatever cart is current for a restored/direct-link
   * attempt that never went through begin()/beginCashOnDelivery() in this
   * tab. null whenever no attempt is being tracked.
   */
  const attemptCartId = useRef<string | null>(null);

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

  const applyServerOrder = useCallback(
    (result: ServerOrder) => {
      // Refuses a result for an order this hook is no longer tracking. The
      // realtime channel invalidates checkoutOrderQueryKey(orderId) for as
      // long as anything has that key cached, so a broadcast -- or a
      // fetch it triggered -- for a retired attempt's order can still
      // resolve after the cart that attempt belonged to has been
      // superseded (see the retirement effect below). Checking the *ref*
      // is what makes this correct even though disabling trackingQuery
      // (trackedOrderId flips to null, changing its query key) can't by
      // itself stop a request that was already in flight when that
      // happened.
      if (trackedOrderIdRef.current !== result.order.id) return;
      databaseStatus.current = result.databaseStatus;
      setOrder((current) => {
        // The server response doesn't carry this label (see
        // beginCashOnDelivery below) -- preserve whatever was already
        // showing across any later refresh of the same order.
        const paymentMethod =
          current?.trackingOrder.paymentMethod ??
          result.order.trackingOrder.paymentMethod;
        return {
          ...result.order,
          trackingOrder: { ...result.order.trackingOrder, paymentMethod },
        };
      });
      setTrackedOrder(result.order.id);
      if (terminalPaymentStatuses.has(result.order.paymentStatus))
        clearCheckoutAttempt(storefrontContext);
      setPhase(phaseFromOrder(result.order));
    },
    [setTrackedOrder],
  );

  // Applies a background refetch -- realtime-invalidated or otherwise --
  // once we're already tracking a placed order, keeping the tracking
  // screen in sync with Admin without the customer doing anything.
  useEffect(() => {
    if (!trackingQuery.data) return;
    applyServerOrder(trackingQuery.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingQuery.data]);

  /**
   * Retires the checkout attempt currently anchored to attemptCartId --
   * called from the effect below once a genuinely different cart is
   * established, never merely because /cart remounted or the old cart's
   * pointer was cleared. Clears every piece of transient state this hook
   * owns, including the persisted attempt pointer, so a reload after this
   * point can't resurrect the retired order either -- from the customer's
   * perspective that order is exactly as done as a confirmed/cancelled one,
   * it just never reached one of those statuses in this tab.
   */
  const retireAttempt = useCallback(() => {
    attemptCartId.current = null;
    databaseStatus.current = null;
    lastAttemptWasCash.current = false;
    clearCheckoutAttempt(storefrontContext);
    setPhase("idle");
    setOrder(null);
    setTrackedOrder(null);
    setRequest(null);
    setUpdatedAmount(null);
    setStartError(undefined);
    setCancelError(undefined);
    setCancelling(false);
  }, [setTrackedOrder]);

  /**
   * The lifecycle boundary: a checkout attempt belongs to one specific
   * cart, not to every cart that ever exists in this tab. checkout_cart's
   * own pointer-clearing (see createOrder/beginCashOnDelivery) makes a
   * brand new -- empty -- cart appear in the cache almost immediately,
   * well before the customer has actually finished paying, so this can't
   * just compare against whatever cart is currently cached:
   *
   *   - While an attempt is in flight (activeRequest.current), never look.
   *     Comparing against that instant replacement cart here would rip the
   *     payment UI out from under the customer mid-flow (e.g. while the
   *     Razorpay widget is open, or while a "pending" order is still
   *     legitimately being confirmed by the payment provider).
   *   - Once nothing is in flight, only retire once the new cart actually
   *     has items in it. An empty replacement cart is bookkeeping, not the
   *     customer moving on -- this is what keeps a completed order's
   *     confirmation/tracking state alive long enough to navigate away on
   *     its own, and keeps a still-pending attempt recoverable if the
   *     customer leaves /cart and comes back without touching a new cart.
   *   - The same cart id (a same-cart payment retry after a cancel/failure)
   *     is never treated as a new lifecycle.
   *
   * A restored or direct-link attempt (see the mount-only effect further
   * down) has no recorded cart at all -- anchor it to whatever cart is
   * current the first time one loads, so a later, genuinely different cart
   * can still retire it, without ever retiring on this same pass.
   */
  useEffect(() => {
    if (activeRequest.current || !cart) return;
    if (attemptCartId.current === null) {
      if (phase !== "idle") attemptCartId.current = cart.id;
      return;
    }
    if (cart.id === attemptCartId.current || cart.items.length === 0) return;
    retireAttempt();
  }, [cart, phase, retireAttempt]);

  const verify = useCallback(async () => {
    const orderId =
      order?.id ??
      readCheckoutAttempt(storefrontContext)?.orderId ??
      requestedOrderId;
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

  /**
   * Starts a Razorpay payment for an order already in payment_pending and
   * drives the widget through to a real outcome. Reused by both the initial
   * checkout and a payment-only retry (see retryPayment below) -- both cases
   * reuse the same persisted paymentAttemptId, so a second call for the same
   * order resumes the same Razorpay order rather than creating another one.
   *
   * Every exit path here ends in a phase change; callers never need to set
   * one themselves afterward.
   */
  const startRazorpayPayment = useCallback(
    async (orderId: string) => {
      setPhase("preparing_payment");
      try {
        const paymentAttemptId = beginPaymentAttempt(storefrontContext);
        const start = await startOnlinePayment({ orderId, paymentAttemptId });

        setPhase("awaiting_provider");
        const outcome = await openRazorpayCheckout({
          checkoutKey: start.checkoutKey,
          providerOrderId: start.providerOrderId,
          amount: start.amount,
          currency: start.currency,
          displayName:
            typeof start.display.displayName === "string"
              ? start.display.displayName
              : "Payment",
          customerName: request?.customer.name,
          customerPhone: request
            ? `${request.customer.countryCode}${request.customer.phone}`
            : undefined,
        });

        if (outcome.outcome === "dismissed") {
          setPhase("cancelled");
          return;
        }
        if (outcome.outcome === "failed") {
          setPhase("failed");
          return;
        }

        setPhase("confirming");
        const result = await verifyOnlinePayment({
          orderId,
          razorpayPaymentId: outcome.razorpayPaymentId,
          razorpayOrderId: outcome.razorpayOrderId,
          razorpaySignature: outcome.razorpaySignature,
        });
        applyServerOrder(result);
      } catch (error) {
        // A verification failure means the true outcome is unknown, not that
        // the payment failed -- never claim "failed" for that, since the
        // customer may already have paid. Anything else (script load failure,
        // start-online-payment rejecting) means the attempt never got far
        // enough to know either way, which start_error already covers.
        if (error instanceof PaymentVerificationError) {
          setPhase("verification_error");
          return;
        }
        setStartError(
          checkoutErrorMessage(error, "We couldn't start your payment."),
        );
        setPhase("start_error");
      }
    },
    [applyServerOrder, request],
  );

  /**
   * Calls checkout_cart with the given identity's cartId; on the narrow,
   * proven-safe 'cart access denied' failure (see isCartIdentityCheckoutError
   * above), refetches the cart and retries exactly once with a freshly
   * resolved identity -- never replaying the failed request's own cartId.
   * Any other failure (including a second 'cart access denied') propagates.
   */
  const checkoutCartWithIdentityRecovery = useCallback(
    async (
      identity: CartIdentity,
      args: Omit<Parameters<typeof checkoutCart>[0], "cartId">,
    ) => {
      try {
        return await checkoutCart({ ...args, cartId: identity.cartId });
      } catch (error) {
        if (!isCartIdentityCheckoutError(error)) throw error;
        await queryClient.invalidateQueries({
          queryKey: storefrontCartQueryKey(getCustomerId()),
          exact: true,
        });
        const freshIdentity = getCartIdentity();
        if (!freshIdentity) throw error;
        return await checkoutCart({ ...args, cartId: freshIdentity.cartId });
      }
    },
    [getCartIdentity, getCustomerId, queryClient],
  );

  const createOrder = useCallback(
    async (checkoutRequest: CheckoutRequest) => {
      const identity = getCartIdentity();
      if (!identity) throw new Error("Your cart is still loading.");
      setPhase("creating_order");
      const orderId = beginCheckoutAttempt(storefrontContext);
      const result = await checkoutCartWithIdentityRecovery(identity, {
        orderId,
        fulfilment: checkoutRequest.fulfilment,
        customerBusinessAddressId: checkoutRequest.deliveryAddress?.id ?? null,
        customerNote: checkoutRequest.customerNote ?? null,
        paymentMethod: "online",
      });
      setOrder(result.order);
      setTrackedOrder(result.order.id);

      // checkout_cart marks the cart 'converted', so the cached copy is stale and
      // the next add has to open a fresh cart. Only clear the pointer now that
      // conversion actually succeeded -- an aborted or failed checkout must
      // leave the still-active cart's pointer alone.
      void queryClient.invalidateQueries({
        queryKey: storefrontCartQueryKey(getCustomerId()),
        exact: true,
      });
      clearCartPointer(storefrontContext);

      await startRazorpayPayment(result.order.id);
    },
    [
      checkoutCartWithIdentityRecovery,
      getCartIdentity,
      getCustomerId,
      queryClient,
      setTrackedOrder,
      startRazorpayPayment,
    ],
  );

  const begin = useCallback(
    async (checkoutRequest: CheckoutRequest) => {
      const identity = getCartIdentity();
      if (activeRequest.current || !identity) return;
      activeRequest.current = true;
      attemptCartId.current = identity.cartId;
      lastAttemptWasCash.current = false;
      setRequest(checkoutRequest);
      setStartError(undefined);
      setPhase("quoting");
      try {
        const quote = await quoteCart({
          cartId: identity.cartId,
          fulfilment: checkoutRequest.fulfilment,
          customerBusinessAddressId:
            checkoutRequest.deliveryAddress?.id ?? null,
        });

        if (quote.grandTotal !== checkoutRequest.displayedTotal) {
          setUpdatedAmount(quote.grandTotal);
          setPhase("quote_changed");
          return;
        }

        // createOrder resolves its own identity fresh rather than reusing
        // `identity` above -- if it changed during the quote round trip, order
        // creation targets whichever cart is actually current now, and
        // checkout_cart recomputes its own authoritative total regardless of
        // what was quoted.
        await createOrder(checkoutRequest);
      } catch (error) {
        // quote_cart and checkout_cart raise for real, explainable conditions --
        // unserviceable address, unmet minimum, closed restaurant, an item that
        // has gone unavailable. Surface the server's own wording.
        setStartError(
          checkoutErrorMessage(error, "We couldn't start your payment."),
        );
        setPhase("start_error");
      } finally {
        activeRequest.current = false;
      }
    },
    [createOrder, getCartIdentity],
  );

  // Cash on delivery still creates a real order through checkout_cart (same
  // idempotent path as online checkout) -- it just skips the quote-recheck
  // and payment-provider hand-off, since there is no online payment to
  // prepare, going straight from order creation to the confirmed tracking
  // screen.
  const beginCashOnDelivery = useCallback(
    async (checkoutRequest: CheckoutRequest) => {
      const identity = getCartIdentity();
      if (activeRequest.current || !identity) return null;
      activeRequest.current = true;
      attemptCartId.current = identity.cartId;
      lastAttemptWasCash.current = true;
      setRequest(checkoutRequest);
      setStartError(undefined);
      setPhase("placing_order");
      try {
        const orderId = beginCheckoutAttempt(storefrontContext);
        const result = await checkoutCartWithIdentityRecovery(identity, {
          orderId,
          fulfilment: checkoutRequest.fulfilment,
          customerBusinessAddressId:
            checkoutRequest.deliveryAddress?.id ?? null,
          customerNote: checkoutRequest.customerNote ?? null,
          paymentMethod: "cash",
        });

        void queryClient.invalidateQueries({
          queryKey: storefrontCartQueryKey(getCustomerId()),
          exact: true,
        });
        clearCartPointer(storefrontContext);

        // The server has already created this order as 'placed'; only the
        // customer-facing payment-method label is added here. Nothing about the
        // order's own status is invented client-side -- an earlier version
        // overrode paymentStatus to "confirmed" locally, which made a cash order
        // look confirmed while it sat unplaced and invisible to the restaurant.
        const cashOrder: PaymentPendingOrder = {
          ...result.order,
          trackingOrder: {
            ...result.order.trackingOrder,
            paymentMethod: "cash",
          },
        };
        setOrder(cashOrder);
        setTrackedOrder(cashOrder.id);
        clearCheckoutAttempt(storefrontContext);
        setPhase("confirmed");
        return cashOrder;
      } catch (error) {
        setStartError(
          checkoutErrorMessage(error, "We couldn't place your order."),
        );
        setPhase("start_error");
        return null;
      } finally {
        activeRequest.current = false;
      }
    },
    [
      checkoutCartWithIdentityRecovery,
      getCartIdentity,
      getCustomerId,
      queryClient,
      setTrackedOrder,
    ],
  );

  const acceptUpdatedQuote = useCallback(() => {
    if (!request || activeRequest.current) return;
    activeRequest.current = true;
    setUpdatedAmount(null);
    void createOrder(request)
      .catch((error: unknown) => {
        setStartError(
          checkoutErrorMessage(error, "We couldn't start your payment."),
        );
        setPhase("start_error");
      })
      .finally(() => {
        activeRequest.current = false;
      });
  }, [createOrder, request]);

  /**
   * "failed"/"cancelled" mean the order exists and is still payment_pending
   * but the payment attempt itself didn't land -- retrying means reopening
   * Razorpay for that same order, not re-running checkout_cart. Any other
   * phase with an order already loaded (e.g. a stale "pending" after a
   * reload) just re-reads the server. Only with no order at all does this
   * fall back to redoing checkout from the top -- safe to call repeatedly
   * either way, since beginCheckoutAttempt/beginPaymentAttempt hand back the
   * same ids and every RPC/Edge Function involved is idempotent on them.
   */
  const retryPayment = useCallback(() => {
    if (order && (phase === "failed" || phase === "cancelled")) {
      if (activeRequest.current) return;
      activeRequest.current = true;
      void startRazorpayPayment(order.id).finally(() => {
        activeRequest.current = false;
      });
      return;
    }
    if (order) {
      void verify();
      return;
    }
    if (!request) return;
    void (lastAttemptWasCash.current
      ? beginCashOnDelivery(request)
      : begin(request));
  }, [
    begin,
    beginCashOnDelivery,
    order,
    phase,
    request,
    startRazorpayPayment,
    verify,
  ]);

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
      const result = await cancelOrderRequest(
        trackedOrderId,
        databaseStatus.current,
        "Cancelled by customer",
      );
      applyServerOrder(result);
    } catch (error) {
      setCancelError(
        checkoutErrorMessage(
          error,
          "We couldn't cancel this order. It may have already been accepted.",
        ),
      );
      void verify();
    } finally {
      setCancelling(false);
    }
  }, [applyServerOrder, cancelling, trackedOrderId, verify]);

  useEffect(() => {
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        phase === "awaiting_provider"
      )
        void verify();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [phase, verify]);

  return {
    acceptUpdatedQuote,
    begin,
    beginCashOnDelivery,
    cancelError,
    cancelling,
    cancelOrder,
    order,
    phase,
    restored,
    retryPayment,
    startError,
    updatedAmount,
    verify,
  };
}
