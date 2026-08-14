import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMenu,
  saveMenuChanges,
  type MenuBaseline,
  type MenuData,
} from "@/features/menu/api/menu-api";
import { cloneCategories, type Category } from "@/features/menu/menu-model";

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
  const queryClient = useQueryClient();
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
    onMutate: async (input) => {
      const queryKey = menuQueryKey(input.businessId, input.locationId);
      await queryClient.cancelQueries({ queryKey });
      const previousMenu = queryClient.getQueryData<MenuData>(queryKey);

      queryClient.setQueryData<MenuData>(queryKey, (current) =>
        current
          ? { ...current, categories: cloneCategories(input.categories) }
          : current,
      );

      return { previousMenu };
    },
    onError: (_error, input, context) => {
      if (!context?.previousMenu) return;
      queryClient.setQueryData(
        menuQueryKey(input.businessId, input.locationId),
        context.previousMenu,
      );
    },
    onSuccess: (baseline, input) => {
      const queryKey = menuQueryKey(input.businessId, input.locationId);
      queryClient.setQueryData<MenuData>(queryKey, () => ({
        categories: cloneCategories(input.categories),
        baseline,
      }));
    },
  });
}
