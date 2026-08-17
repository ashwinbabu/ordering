import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase/client";
import { customerOrdersQueryKey } from "./customer-orders-query";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

/**
 * Joins the customer's private "an order changed" channel and invalidates the
 * order-history query on every message. The socket payload (just an order id)
 * is never read into the cache -- ordering.broadcast_order_change() sends it
 * purely as a hint that something changed; list_customer_orders, gated by RLS
 * via realtime.messages, remains the only source of truth.
 *
 * One subscription per (authUserId, locationId): mounted once in
 * CustomerSessionProvider rather than the Orders screen, so it stays joined
 * while the customer is anywhere else in the app, and re-subscribes cleanly
 * on sign-in/out or a storefront context change via the effect's own cleanup.
 */
export function useCustomerOrdersChannel(
  authUserId: string | null,
  customerId: string | null,
  context: StorefrontContext = storefrontContext,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authUserId) return;

    const client = getSupabaseClient();
    const topic = `customer-orders:${authUserId}:${context.locationId}`;
    const channel = client
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "order-changed" }, () => {
        void queryClient.invalidateQueries({ queryKey: customerOrdersQueryKey(customerId, context) });
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
    // context is a mutated-in-place singleton (see storefront-context.ts) --
    // its reference never changes, so context.locationId is depended on
    // directly rather than the object itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, customerId, context.locationId, queryClient]);
}
