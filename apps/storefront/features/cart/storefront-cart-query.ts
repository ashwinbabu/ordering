import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCart, openAnonymousCart } from "./api/storefront-cart-api";
import { readCartPointer, writeCartPointer } from "./cart-pointer-storage";
import { getAnonymousSessionId } from "../../lib/storefront/anonymous-session";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";
import type { ServerCart } from "../../domain/cart";

export function storefrontCartQueryKey(context: StorefrontContext = storefrontContext) {
  return ["storefront", "cart", context.businessId, context.locationId] as const;
}

async function ensureCart(context: StorefrontContext): Promise<ServerCart> {
  const anonymousSessionId = getAnonymousSessionId();
  const pointerCartId = readCartPointer(context);

  if (pointerCartId) {
    try {
      const cart = await getCart({ cartId: pointerCartId, anonymousSessionId });
      return cart;
    } catch {
      // The pointer no longer resolves (expired, converted, or from a wiped
      // dev database) -- fall through and open a fresh anonymous cart below.
    }
  }

  const cart = await openAnonymousCart({
    cartId: window.crypto.randomUUID(),
    businessId: context.businessId,
    locationId: context.locationId,
    anonymousSessionId,
  });
  writeCartPointer(context, cart.id);
  return cart;
}

export function useStorefrontCartQuery(context: StorefrontContext = storefrontContext) {
  return useQuery({
    queryKey: storefrontCartQueryKey(context),
    queryFn: () => ensureCart(context),
    staleTime: 15_000,
    // Cart mutations are non-retryable business decisions (unavailable
    // product, closed restaurant); the initial open/get is the one operation
    // worth a couple of attempts against a flaky connection.
    retry: 2,
  });
}

export function useReconcileCartOnFocus(context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(context), exact: true });
}
