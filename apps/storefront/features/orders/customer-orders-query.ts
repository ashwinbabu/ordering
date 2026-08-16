import { useQuery } from "@tanstack/react-query";
import { listCustomerOrders } from "./api/customer-orders-api";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

export function customerOrdersQueryKey(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return ["storefront", "customer-orders", context.businessId, customerId] as const;
}

/**
 * Order history for the signed-in customer at this business. Disabled without
 * a customer: the RPC is `authenticated`-only, and an anonymous browser has no
 * history to show, so the orders screen renders its empty state instead.
 *
 * `businessKey` is the value the UI filters on (StorefrontOrder.restaurantId);
 * the query is already business-scoped server-side, so it is only a label.
 */
export function useCustomerOrdersQuery(customerId: string | null, businessKey: string, context: StorefrontContext = storefrontContext) {
  return useQuery({
    queryKey: customerOrdersQueryKey(customerId, context),
    queryFn: () => listCustomerOrders(context.businessId, businessKey),
    enabled: Boolean(customerId),
    // Status changes while an order is in flight; short enough to pick those
    // up when the customer opens the screen, long enough not to refetch on
    // every navigation between account sub-screens.
    staleTime: 30_000,
    retry: false,
  });
}
