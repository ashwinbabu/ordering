import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOwnerPairingToken,
  createStaffGroupPairingToken,
  getBusinessNotificationPreferences,
  getTelegramConnectionStatus,
  setBusinessNotificationPreferences,
} from "@/features/business-settings/api/telegram-api";

export function businessNotificationPreferencesQueryKey(businessId: string | null) {
  return ["business-notification-preferences", businessId] as const;
}

export function useBusinessNotificationPreferencesQuery(
  businessId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: businessNotificationPreferencesQueryKey(businessId),
    queryFn: () => getBusinessNotificationPreferences(businessId!),
    enabled: enabled && Boolean(businessId),
    staleTime: 15_000,
  });
}

export function useSetBusinessNotificationPreferencesMutation(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notifyOwnerOnCancellation: boolean) =>
      setBusinessNotificationPreferences(businessId, notifyOwnerOnCancellation),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: businessNotificationPreferencesQueryKey(businessId),
      });
    },
  });
}

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

export function useCreateOwnerPairingTokenMutation(
  businessId: string,
  locationId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createOwnerPairingToken(businessId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: telegramConnectionQueryKey(businessId, locationId),
      });
    },
  });
}
