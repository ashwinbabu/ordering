import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMenu,
  saveMenuChanges,
  setCategoryAvailability,
  setProductAvailabilityAtLocation,
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

// Availability toggles are single-row writes (RLS-scoped, not baseline-
// checked against the whole menu) and skip the save_menu_changes RPC
// entirely -- see setCategoryAvailability / setProductAvailabilityAtLocation
// in menu-api.ts. Cache updates here are targeted patches, not a refetch.
export function useSetCategoryAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setCategoryAvailability,
    onSuccess: (result, input) => {
      const queryKey = menuQueryKey(input.businessId, input.locationId);
      queryClient.setQueryData<MenuData>(queryKey, (current) =>
        current
          ? {
              categories: current.categories.map((category) =>
                category.id === result.categoryId
                  ? { ...category, available: input.isActive }
                  : category,
              ),
              baseline: {
                ...current.baseline,
                categories: current.baseline.categories.map((entry) =>
                  entry.id === result.categoryId
                    ? { ...entry, updatedAt: result.updatedAt }
                    : entry,
                ),
              },
            }
          : current,
      );
    },
  });
}

export function useSetProductAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      businessId: string;
      locationId: string;
      productId: string;
      isAvailable: boolean;
    }) =>
      setProductAvailabilityAtLocation({
        locationId: input.locationId,
        productId: input.productId,
        isAvailable: input.isAvailable,
      }),
    onSuccess: (_result, input) => {
      const queryKey = menuQueryKey(input.businessId, input.locationId);
      queryClient.setQueryData<MenuData>(queryKey, (current) =>
        current
          ? {
              ...current,
              categories: current.categories.map((category) => ({
                ...category,
                products: category.products.map((product) =>
                  product.id === input.productId
                    ? { ...product, available: input.isAvailable }
                    : product,
                ),
              })),
            }
          : current,
      );
    },
  });
}
