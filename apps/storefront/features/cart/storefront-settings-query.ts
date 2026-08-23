import { useQuery } from "@tanstack/react-query";
import { getStorefrontSettings } from "./api/storefront-settings-api";
import {
  storefrontContext,
  type StorefrontContext,
} from "../../lib/storefront/storefront-context";

export function storefrontSettingsQueryKey(
  context: StorefrontContext = storefrontContext,
) {
  return [
    "storefront",
    "settings",
    context.businessId,
    context.locationId,
  ] as const;
}

export function useStorefrontSettingsQuery(
  context: StorefrontContext = storefrontContext,
) {
  return useQuery({
    queryKey: storefrontSettingsQueryKey(context),
    queryFn: () => getStorefrontSettings(context.locationId),
    // Minimum order, tax and delivery-zone pricing change rarely; a longer
    // staleTime avoids refetching this on every cart interaction while still
    // picking up an operator change within a couple of minutes.
    staleTime: 120_000,
    retry: false,
  });
}
