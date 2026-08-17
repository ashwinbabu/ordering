import { useQuery } from "@tanstack/react-query";
import { listCustomerOrders } from "./api/customer-orders-api";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

export function customerOrdersQueryKey(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return ["storefront", "customer-orders", context.businessId, context.locationId, customerId] as const;
}

/**
 * Order history for the signed-in customer at this business+location.
 * Disabled without a customer: the RPC is `authenticated`-only, and an
 * anonymous browser has no history to show, so the orders screen renders its
 * empty state instead.
 *
 * `businessKey` is the value the UI filters on (StorefrontOrder.restaurantId);
 * the query is already business+location-scoped server-side, so it is only a
 * label.
 *
 * refetchOnWindowFocus is turned on here specifically (the app default is
 * off): use-customer-orders-channel.ts only invalidates while the socket is
 * actually connected, and broadcast has no replay -- an event sent while the
 * tab was asleep/backgrounded is gone for good. Refetching on focus is what
 * catches the app back up in that case, independent of whether the socket
 * reconnects.
 */
export function useCustomerOrdersQuery(customerId: string | null, businessKey: string, context: StorefrontContext = storefrontContext) {
  return useQuery({
    queryKey: customerOrdersQueryKey(customerId, context),
    queryFn: () => listCustomerOrders(context.businessId, context.locationId, businessKey),
    enabled: Boolean(customerId),
    // Status changes while an order is in flight; short enough to pick those
    // up when the customer opens the screen, long enough not to refetch on
    // every navigation between account sub-screens.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
