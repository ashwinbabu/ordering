import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { attachAnonymousCart, getCart, openAnonymousCart } from "./api/storefront-cart-api";
import { readCartPointer, writeCartPointer } from "./cart-pointer-storage";
import { resolveCustomerBusinessId } from "../auth/api/customer-business-api";
import { getAnonymousSessionId } from "../../lib/storefront/anonymous-session";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";
import type { ServerCart } from "../../domain/cart";

/**
 * The identity segment keeps an anonymous cart and a signed-in customer's cart
 * in separate cache entries. Without it, signing in would briefly serve the
 * previous anonymous cart from cache under the customer's identity.
 */
export function storefrontCartQueryKey(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return ["storefront", "cart", context.businessId, context.locationId, customerId ?? "anon"] as const;
}

/**
 * The single source callers should read cart identity from at the moment
 * they act -- mutation calls and identity-sensitive derivations (like a
 * line id) must use this instead of a `cart` value captured at render time,
 * which can be behind by the time the user actually clicks.
 */
export function readCurrentCart(queryClient: QueryClient, customerId: string | null, context: StorefrontContext = storefrontContext): ServerCart | undefined {
  return queryClient.getQueryData<ServerCart>(storefrontCartQueryKey(customerId, context));
}

/**
 * The single authoritative read every cart RPC call (mutation or checkout)
 * resolves its identity from, exactly once, immediately before constructing
 * that request. Returns the cart itself, not just its id, so a caller never
 * needs a second, independent read to look at its items -- a second read is
 * what let cart_id/credential and an item id disagree in the first place.
 * Throws rather than returning undefined so a caller can't accidentally
 * build a request around a half-resolved identity.
 */
export function resolveCartIdentity(queryClient: QueryClient, customerId: string | null, context: StorefrontContext = storefrontContext) {
  const cart = readCurrentCart(queryClient, customerId, context);
  if (!cart) throw new Error("The cart has not loaded yet.");
  return { cart, cartId: cart.id, anonymousSessionId: cart.isAuthenticated ? null : getAnonymousSessionId() };
}

/**
 * A signed-in customer always goes through attach_anonymous_cart: it claims
 * this browser's guest cart, merges it into an existing customer cart when
 * both exist, and creates one when there is nothing to claim. That single RPC
 * covers every authenticated case, so there is no separate "open" path -- and
 * ordering.open_customer_cart is never needed.
 */
async function ensureCustomerCart(context: StorefrontContext, customerId: string): Promise<ServerCart> {
  const customerBusinessId = await resolveCustomerBusinessId(context.businessId, customerId);
  const cart = await attachAnonymousCart({
    businessId: context.businessId,
    locationId: context.locationId,
    anonymousSessionId: getAnonymousSessionId(),
    customerBusinessId,
    newCartId: window.crypto.randomUUID(),
  });
  writeCartPointer(context, cart.id);
  return cart;
}

async function ensureAnonymousCart(context: StorefrontContext): Promise<ServerCart> {
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

export function useStorefrontCartQuery(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return useQuery({
    queryKey: storefrontCartQueryKey(customerId, context),
    queryFn: () => customerId ? ensureCustomerCart(context, customerId) : ensureAnonymousCart(context),
    staleTime: 15_000,
    // Cart mutations are non-retryable business decisions (unavailable
    // product, closed restaurant); the initial open/get is the one operation
    // worth a couple of attempts against a flaky connection.
    retry: 2,
  });
}

export function useReconcileCartOnFocus(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(customerId, context), exact: true });
}
