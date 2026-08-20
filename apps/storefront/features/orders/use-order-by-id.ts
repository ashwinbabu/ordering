import { useQuery } from "@tanstack/react-query";
import { checkoutOrderQueryKey } from "../checkout/use-checkout-flow";
import {
  getOrder,
  type ServerOrder,
} from "../checkout/api/storefront-checkout-api";

/**
 * The canonical data source for the /orders/:orderId route -- a standalone
 * fetch that works on a cold load (refresh, direct URL, new tab), unlike
 * `checkout.order` (in-memory only, populated solely by this browser's own
 * just-completed checkout) or the order-history list (only ever loaded for
 * `/orders`, and only carries the fields OrderDetailsScreen needs, not a
 * live single-order read).
 *
 * Uses the exact same query key and queryFn as useCheckoutFlow's own
 * internal tracking query (`checkoutOrderQueryKey` / `getOrder`) -- not a
 * parallel cache entry, the same one. That's also the key
 * use-customer-orders-channel.ts already invalidates on every realtime
 * "order-changed" broadcast, so this route gets live updates for free.
 *
 * `initialData` is the one deliberate coupling to `useCheckoutFlow`: pass
 * `checkout.order` (converted by the caller) when it matches this route's id
 * so a just-completed checkout renders instantly instead of flashing a
 * loading state, purely a UX nicety -- this hook fetches independently of
 * whether that's ever supplied.
 */
export function useOrderById(
  orderId: string | undefined,
  customerId: string | null,
  initialData?: ServerOrder,
) {
  return useQuery({
    queryKey: checkoutOrderQueryKey(orderId ?? null),
    queryFn: () => getOrder(orderId as string),
    enabled: Boolean(orderId && customerId),
    initialData,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
