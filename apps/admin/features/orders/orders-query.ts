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
  return useQuery({
    queryKey: ordersQueryKey(businessId, locationId),
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
