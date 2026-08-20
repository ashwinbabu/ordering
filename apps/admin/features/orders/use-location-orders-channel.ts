"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

const maxJoinAttempts = 3;

/**
 * Joins the active outlet's private "an order changed" room and invalidates
 * the orders query for that business+location on every message. Mirrors
 * apps/storefront/features/orders/use-customer-orders-channel.ts -- the
 * broadcast payload is just an order id hint; list_orders_for_location (via
 * useOrdersQuery), gated by RLS, remains the only source of truth.
 *
 * One subscription per (businessId, locationId), mounted in OutletProvider
 * rather than the Orders page, so switching outlets naturally unsubscribes
 * the old room and joins the new one via the effect's own cleanup.
 */
export function useLocationOrdersChannel(
  businessId: string | null,
  locationId: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!businessId || !locationId) return;

    const topic = `location-orders:${locationId}`;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: number | undefined;
    let attempt = 0;

    function join() {
      channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "order-changed" }, () => {
          void queryClient.invalidateQueries({
            queryKey: ["orders", businessId, locationId],
          });
        })
        .subscribe((status, error) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            attempt = 0;
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(
              `Realtime: ${topic} failed to subscribe (${status}).`,
              error,
            );
            if (attempt >= maxJoinAttempts || !channel) return;
            attempt += 1;
            const failedChannel = channel;
            retryTimer = window.setTimeout(() => {
              if (cancelled) return;
              void supabase.removeChannel(failedChannel);
              join();
            }, attempt * 1000);
          }
        });
    }

    join();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [businessId, locationId, queryClient]);
}
