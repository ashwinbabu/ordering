import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase/client";
import { customerOrdersQueryKey } from "./customer-orders-query";
import { checkoutOrderQueryKey } from "../checkout/use-checkout-flow";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

const maxJoinAttempts = 3;

/**
 * Joins the customer's private "an order changed" channel and invalidates the
 * order-history query, plus the tracking query for the specific order named
 * in the payload, on every message. The socket payload (just an order id) is
 * never read into either cache -- ordering.broadcast_order_change() sends it
 * purely as a hint that something changed; list_customer_orders and get_order,
 * both gated by RLS, remain the only sources of truth.
 *
 * One subscription per (authUserId, locationId): mounted once in
 * CustomerSessionProvider rather than the Orders screen, so it stays joined
 * while the customer is anywhere else in the app, and re-subscribes cleanly
 * on sign-in/out or a storefront context change via the effect's own cleanup.
 *
 * `ready` gates the join on customer bootstrap being complete -- the Realtime
 * RLS policy for this topic requires core.customer_businesses to already
 * exist, and that row is created by a separate, asynchronous step after the
 * auth session appears. Joining while `ready` is false races that row and
 * gets rejected.
 */
export function useCustomerOrdersChannel(
  authUserId: string | null,
  customerId: string | null,
  ready: boolean,
  context: StorefrontContext = storefrontContext,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authUserId || !ready) return;

    const client = getSupabaseClient();
    const topic = `customer-orders:${authUserId}:${context.locationId}`;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;

    function join() {
      channel = client
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "order-changed" }, (message) => {
          const orderId = (message.payload as { order_id?: unknown } | null)?.order_id;
          void queryClient.invalidateQueries({ queryKey: customerOrdersQueryKey(customerId, context) });
          if (typeof orderId === "string") {
            void queryClient.invalidateQueries({ queryKey: checkoutOrderQueryKey(orderId) });
          }
        })
        .subscribe((status, error) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            attempt = 0;
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(`Realtime: ${topic} failed to subscribe (${status}).`, error);
            // Supabase already retries the underlying websocket transport;
            // this only covers a join that failed because application state
            // (customer_businesses) wasn't actually ready yet, bounded so a
            // genuinely denied topic doesn't retry forever.
            if (attempt >= maxJoinAttempts || !channel) return;
            attempt += 1;
            const failedChannel = channel;
            retryTimer = window.setTimeout(() => {
              if (cancelled) return;
              void client.removeChannel(failedChannel);
              join();
            }, attempt * 1000);
          }
        });
    }

    join();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (channel) void client.removeChannel(channel);
    };
    // context is a mutated-in-place singleton (see storefront-context.ts) --
    // its reference never changes, so context.locationId is depended on
    // directly rather than the object itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, customerId, ready, context.locationId, queryClient]);
}
