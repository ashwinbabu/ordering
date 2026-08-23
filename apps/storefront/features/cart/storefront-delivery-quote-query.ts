import { useQuery } from "@tanstack/react-query";
import { getDeliveryQuote } from "./api/storefront-cart-api";
import {
  storefrontContext,
  type StorefrontContext,
} from "../../lib/storefront/storefront-context";

// The authoritative delivery fee cannot be known before a destination is
// resolved (task: do not pretend to know the delivery fee before the
// destination is known). This calls the real ordering.get_delivery_quote
// boundary -- distance-zone matching against ordering.delivery_zones -- as
// soon as an address with coordinates is selected.
export function useDeliveryQuoteQuery(
  destination: { latitude: number; longitude: number } | undefined,
  foodSubtotalAfterDiscount: number,
  context: StorefrontContext = storefrontContext,
) {
  return useQuery({
    queryKey: [
      "storefront",
      "delivery-quote",
      context.locationId,
      destination?.latitude,
      destination?.longitude,
      foodSubtotalAfterDiscount,
    ],
    queryFn: () =>
      getDeliveryQuote({
        locationId: context.locationId,
        destinationLatitude: destination!.latitude,
        destinationLongitude: destination!.longitude,
        foodSubtotalAfterDiscount,
      }),
    enabled: Boolean(destination),
    staleTime: 30_000,
    retry: false,
  });
}
