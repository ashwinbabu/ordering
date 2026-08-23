import { useQuery } from "@tanstack/react-query";
import { validateCoupon } from "./api/storefront-cart-api";
import {
  storefrontContext,
  type StorefrontContext,
} from "../../lib/storefront/storefront-context";

// get_cart only echoes the applied coupon's id/code, not its computed
// discount (discount depends on the current subtotal, which can change as
// the cart changes). This derives the display discount from the trusted
// validate_coupon boundary rather than reimplementing the discount formula
// on the client.
export function useCartCouponDiscountQuery(
  code: string | undefined,
  eligibleFoodSubtotal: number,
  context: StorefrontContext = storefrontContext,
) {
  // Rounded to the nearest rupee for the cache key/request: this is a
  // display preview (the authoritative discount is re-derived server-side
  // in set_cart_coupon and again at checkout), so it is not worth a refetch
  // for every paise-level change while quantities are being adjusted.
  const roundedSubtotal = Math.round(eligibleFoodSubtotal);
  return useQuery({
    queryKey: [
      "storefront",
      "coupon-discount",
      context.businessId,
      context.locationId,
      code,
      roundedSubtotal,
    ],
    queryFn: () =>
      validateCoupon({
        businessId: context.businessId,
        locationId: context.locationId,
        code: code!,
        eligibleFoodSubtotal: roundedSubtotal,
      }),
    enabled: Boolean(code),
    staleTime: 15_000,
    retry: false,
  });
}
