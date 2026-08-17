import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { removeCartItem, setCartCoupon, setCartItem, type CartOptionSelectionInput } from "./api/storefront-cart-api";
import { clearCartPointer } from "./cart-pointer-storage";
import { readCurrentCart, storefrontCartQueryKey } from "./storefront-cart-query";
import { getAnonymousSessionId } from "../../lib/storefront/anonymous-session";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

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
function currentCartAccess(queryClient: QueryClient, customerId: string | null, context: StorefrontContext) {
  const cart = readCurrentCart(queryClient, customerId, context);
  if (!cart) throw new Error("The cart has not loaded yet.");
  return { cartId: cart.id, anonymousSessionId: cart.isAuthenticated ? null : getAnonymousSessionId() };
}

/**
 * Cart identity has gone stale under the request that just failed:
 *  - 42501 means the cart on file no longer belongs to this identity (a
 *    cross-identity pointer, or a cart claimed by another session) --
 *    discard the pointer so the next bootstrap opens/attaches the right cart.
 *  - 23505 means the line id the mutation sent already belongs to a
 *    different (often converted) cart -- the cached cart is behind, so the
 *    caller must re-derive the line id from a freshly fetched cart rather
 *    than retrying the one that just failed.
 * Both cases force a refetch of the current-cart query; neither retries the
 * failed request itself (retry: false below, and callers must re-derive
 * cartItemId from the refetched cart rather than reusing the failed one).
 */
function recoverCartIdentity(error: unknown, queryClient: QueryClient, customerId: string | null, context: StorefrontContext) {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42501") clearCartPointer(context);
  if (code === "42501" || code === "23505") {
    void queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(customerId, context), exact: true });
  }
}

export function useSetCartItemMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string; productId: string; quantity: number; customerNote?: string; selections: CartOptionSelectionInput[] }) =>
      setCartItem({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    onError: (error) => recoverCartIdentity(error, queryClient, customerId, context),
    retry: false,
  });
}

export function useRemoveCartItemMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { cartItemId: string }) =>
      removeCartItem({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    onError: (error) => recoverCartIdentity(error, queryClient, customerId, context),
    retry: false,
  });
}

export function useSetCartCouponMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { code: string | null }) =>
      setCartCoupon({ ...currentCartAccess(queryClient, customerId, context), ...args }),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(customerId, context), cart),
    onError: (error) => recoverCartIdentity(error, queryClient, customerId, context),
    retry: false,
  });
}
