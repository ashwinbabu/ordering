import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStaffGroupPairingToken,
  getTelegramConnectionStatus,
} from "@/features/business-settings/api/telegram-api";

export function telegramConnectionQueryKey(
  businessId: string | null,
  locationId: string | null,
) {
  return ["telegram-connection", businessId, locationId] as const;
}

export function useTelegramConnectionQuery(
  businessId: string | null,
  locationId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: telegramConnectionQueryKey(businessId, locationId),
    queryFn: () => getTelegramConnectionStatus(businessId!, locationId!),
    enabled: enabled && Boolean(businessId && locationId),
    staleTime: 15_000,
  });
}

export function useCreateStaffGroupPairingTokenMutation(
  businessId: string,
  locationId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createStaffGroupPairingToken(businessId, locationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: telegramConnectionQueryKey(businessId, locationId),
      });
    },
  });
}
