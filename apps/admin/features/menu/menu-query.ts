import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getMenu,
  saveMenuChanges,
  type MenuBaseline,
} from "@/features/menu/api/menu-api";
import type { Category } from "@/features/menu/menu-model";

export function menuQueryKey(
  businessId: string | null,
  locationId: string | null,
) {
  return ["menu", businessId, locationId] as const;
}

export function useMenuQuery(
  businessId: string | null,
  locationId: string | null,
) {
  return useQuery({
    queryKey: menuQueryKey(businessId, locationId),
    queryFn: () =>
      getMenu({ businessId: businessId!, locationId: locationId! }),
    enabled: Boolean(businessId && locationId),
    staleTime: 30_000,
  });
}

export function useSaveMenuMutation() {
  return useMutation({
    mutationFn: (input: {
      businessId: string;
      locationId: string;
      baseline: MenuBaseline;
      categories: Category[];
    }) =>
      saveMenuChanges({
        scope: { businessId: input.businessId, locationId: input.locationId },
        baseline: input.baseline,
        categories: input.categories,
      }),
  });
}
