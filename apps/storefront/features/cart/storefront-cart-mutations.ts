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

function currentCartId(queryClient: ReturnType<typeof useQueryClient>, context: StorefrontContext) {
  const cart = queryClient.getQueryData<ServerCart>(storefrontCartQueryKey(context));
  if (!cart) throw new Error("The cart has not loaded yet.");
  return cart.id;
}

export function useSetCartItemMutation(context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string; productId: string; quantity: number; customerNote?: string; selections: CartOptionSelectionInput[] }) =>
      setCartItem({
        cartId: currentCartId(queryClient, context),
        anonymousSessionId: getAnonymousSessionId(),
        ...args,
      }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(context), cart),
    retry: false,
  });
}

export function useRemoveCartItemMutation(context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string }) =>
      removeCartItem({
        cartId: currentCartId(queryClient, context),
        anonymousSessionId: getAnonymousSessionId(),
        ...args,
      }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(context), cart),
    retry: false,
  });
}

export function useSetCartCouponMutation(context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { code: string | null }) =>
      setCartCoupon({
        cartId: currentCartId(queryClient, context),
        anonymousSessionId: getAnonymousSessionId(),
        ...args,
      }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(context), cart),
    retry: false,
  });
}
