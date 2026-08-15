import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOrdersForLocation,
  transitionOrderAtLocation,
} from "@/features/orders/api/orders-api";

export function ordersQueryKey(
  businessId: string | null,
  locationId: string | null,
) {
  return ["orders", businessId, locationId] as const;
}

export function useOrdersQuery(
  businessId: string | null,
  locationId: string | null,
) {
  // The server scopes closed orders to "today" by default. Bucketing the
  // key by the client's local date keeps a session left open across
  // midnight from continuing to serve a stale "today" from before the
  // rollover -- an approximation of the server's business-timezone cutoff,
  // not a substitute for it.
  const dayBucket = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: [...ordersQueryKey(businessId, locationId), dayBucket],
    queryFn: () => getOrdersForLocation({ businessId: businessId!, locationId: locationId! }),
    enabled: Boolean(businessId && locationId),
    staleTime: 15_000,
  });
}

export function useTransitionOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transitionOrderAtLocation,
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({
        queryKey: ordersQueryKey(input.businessId, input.locationId),
      });
    },
  });
}
