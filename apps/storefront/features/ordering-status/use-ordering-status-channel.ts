import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { StorefrontMenu } from "../../domain/storefront";
import { storefrontMenuQueryKey } from "../menu/storefront-menu-query";
import { getSupabaseClient } from "../../lib/supabase/client";

/**
 * Keeps the cached menu's accepting-orders flag in step with the operator's
 * kill switch, without refetching the whole catalogue.
 *
 * The database broadcasts on a public channel (see the
 * ordering.broadcast_ordering_status trigger), so this subscribes without
 * `private: true` — the two ends have to agree or no message arrives. The
 * payload carries only the location's accepting-orders boolean.
 */
export function useOrderingStatusChannel(businessId: string, locationId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = getSupabaseClient();
    const channel = client
      .channel(`ordering-status:${locationId}`)
      .on("broadcast", { event: "ordering-status" }, (message) => {
        const payload = message.payload as { orderingEnabled?: unknown };
        if (typeof payload?.orderingEnabled !== "boolean") return;

        queryClient.setQueryData<StorefrontMenu>(
          storefrontMenuQueryKey(businessId, locationId),
          (menu) =>
            menu ? { ...menu, orderingEnabled: payload.orderingEnabled as boolean } : menu,
        );
      })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [businessId, locationId, queryClient]);
}
