import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeCartItem, setCartCoupon, setCartItem, type CartOptionSelectionInput } from "./api/storefront-cart-api";
import { storefrontCartQueryKey } from "./storefront-cart-query";
import { getAnonymousSessionId } from "../../lib/storefront/anonymous-session";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";
import type { ServerCart } from "../../domain/cart";

/** Postgres error codes the cart RPCs raise for business-rule rejections (not transient failures -- never worth retrying). */
const nonRetryableCartErrorCodes = new Set(["22023", "42501", "55000", "23505", "40001"]);

export function isNonRetryableCartError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && nonRetryableCartErrorCodes.has(code);
}

export function cartErrorMessage(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

/**
 * Reads the cart the mutation is about to act on and derives how to prove
 * ownership of it. Once a cart has been claimed by a signed-in customer it has
 * no anonymous_session_id left, so it must be authorised through auth.uid() by
 * sending null instead.
 */
function currentCartAccess(queryClient: ReturnType<typeof useQueryClient>, customerId: string | null, context: StorefrontContext) {
  const cart = queryClient.getQueryData<ServerCart>(storefrontCartQueryKey(customerId, context));
  if (!cart) throw new Error("The cart has not loaded yet.");
  return { cartId: cart.id, anonymousSessionId: cart.isAuthenticated ? null : getAnonymousSessionId() };
}

export function useSetCartItemMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string; productId: string; quantity: number; customerNote?: string; selections: CartOptionSelectionInput[] }) =>
      setCartItem({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    retry: false,
  });
}

export function useRemoveCartItemMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string }) =>
      removeCartItem({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    retry: false,
  });
}

export function useSetCartCouponMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { code: string | null }) =>
      setCartCoupon({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    retry: false,
  });
}
