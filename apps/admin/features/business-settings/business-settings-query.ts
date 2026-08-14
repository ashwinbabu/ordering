import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBusinessSettings,
  saveBusinessSettings,
  type BusinessSettingsBaseline,
} from "@/features/business-settings/api/business-settings-api";
import type { BusinessSettingsDraft } from "@/features/business-settings/business-settings-model";

export function businessSettingsQueryKey(
  businessId: string | null,
  locationId: string | null,
) {
  return ["business-settings", businessId, locationId] as const;
}

export function useBusinessSettingsQuery(
  businessId: string | null,
  locationId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: businessSettingsQueryKey(businessId, locationId),
    queryFn: () =>
      getBusinessSettings({ businessId: businessId!, locationId: locationId! }),
    enabled: enabled && Boolean(businessId && locationId),
    staleTime: 30_000,
  });
}

export function useSaveBusinessSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      businessId: string;
      locationId: string;
      baseline: BusinessSettingsBaseline;
      draft: BusinessSettingsDraft;
    }) => saveBusinessSettings(input),
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({
        queryKey: businessSettingsQueryKey(input.businessId, input.locationId),
      });
    },
  });
}
