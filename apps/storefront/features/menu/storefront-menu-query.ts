import { useQuery } from "@tanstack/react-query";
import { getStorefrontMenu } from "./api/storefront-menu-api";

export function storefrontMenuQueryKey(locationId: string) {
  return ["storefront-menu", locationId] as const;
}

export function useStorefrontMenuQuery(locationId: string) {
  return useQuery({
    queryKey: storefrontMenuQueryKey(locationId),
    queryFn: async () => {
      try {
        const menu = await getStorefrontMenu(locationId);
        if (!menu) {
          throw new Error("This restaurant location is not available.");
        }

        return menu;
      } catch (error) {
        throw error instanceof Error ? error : new Error("Could not load the menu.");
      }
    },
    staleTime: 30_000,
    // A single attempt keeps the unavailable-menu screen immediate. Retrying
    // would leave the customer on the loading state through several backoffs.
    retry: false,
  });
}
