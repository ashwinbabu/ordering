import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrdersForLocation,
  transitionOrderAtLocation,
} from "@/features/orders/api/orders-api";
import {
  ordersDateRangeQueryWindow,
  type OrdersDateRange,
} from "@/features/orders/order-model";

export function ordersQueryKey(
  businessId: string | null,
  locationId: string | null,
  dateRange: OrdersDateRange,
) {
  const window = ordersDateRangeQueryWindow(dateRange);
  return ["orders", businessId, locationId, window.from, window.to] as const;
}

export function useOrdersQuery(
  businessId: string | null,
  locationId: string | null,
  dateRange: OrdersDateRange,
) {
  return useQuery({
    queryKey: ordersQueryKey(businessId, locationId, dateRange),
    queryFn: () =>
      getOrdersForLocation(
        { businessId: businessId!, locationId: locationId! },
        ordersDateRangeQueryWindow(dateRange),
      ),
    enabled: Boolean(businessId && locationId),
    staleTime: 15_000,
    // Broadcast has no replay -- an order-changed event sent while this tab
    // was backgrounded/asleep is gone for good. Refetching on focus is what
    // catches the Orders page back up, independent of the realtime socket
    // reconnecting. Matches useCustomerOrdersQuery's override on the
    // storefront side, for the same reason.
    refetchOnWindowFocus: true,
  });
}

export function useTransitionOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transitionOrderAtLocation,
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["orders", input.businessId, input.locationId],
      });
    },
  });
}
