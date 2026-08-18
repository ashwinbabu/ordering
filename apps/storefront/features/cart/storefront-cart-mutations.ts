import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { removeCartItem, setCartCoupon, setCartItem, type CartOptionSelectionInput } from "./api/storefront-cart-api";
import { clearCartPointer } from "./cart-pointer-storage";
import { cartLineKey, findLineByContent, resolveCartLineId } from "../../lib/storefront/cart-line-identity";
import { resolveCartIdentity, storefrontCartQueryKey } from "./storefront-cart-query";
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
 * 42501 means the cart on file no longer belongs to this identity (a stale
 * pointer, or a cart claimed by another tab/session in the meantime). 23505
 * means the line id a set_cart_item call targeted already belongs to a
 * different cart. Both are legitimate concurrent changes landing between
 * this mutation's own snapshot read and the server processing its request --
 * recoverable by re-reading the cart and reconstructing the request, not
 * failures to surface as-is.
 */
function isRecoverableCartIdentityError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42501" || code === "23505";
}

/**
 * On a recoverable identity error: clear the stale pointer (42501 only --
 * 23505 means the pointer itself is fine, just an item id target that has
 * moved on), then await a refetch so the next resolveCartIdentity() call
 * observes the server's current state instead of the snapshot that just
 * failed. `getCustomerId` is called here, at recovery time, rather than
 * threading through a `customerId` value captured earlier -- auth can
 * transition (sign-in completing, sign-out) during the failed request's own
 * round trip, and invalidating/refetching the wrong (pre-transition) cache
 * slot would recover into a cart that isn't the current one any more.
 */
async function refetchCartIdentity(error: unknown, queryClient: QueryClient, getCustomerId: () => string | null, context: StorefrontContext) {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42501") clearCartPointer(context);
  await queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(getCustomerId(), context), exact: true });
}

/**
 * Runs `perform` (which reads its own fresh cart identity and builds one RPC
 * request from it) and, on a recoverable identity error, refetches the cart
 * and runs `perform` again -- once. The retry calls the same `perform`
 * closure, so it re-resolves identity and rebuilds the request from the new
 * snapshot; nothing from the failed attempt is reused. The retry call itself
 * is not wrapped, so a second failure of any kind propagates without
 * looping.
 */
async function withCartIdentityRecovery<T>(
  perform: () => Promise<T>,
  queryClient: QueryClient,
  getCustomerId: () => string | null,
  context: StorefrontContext,
): Promise<T> {
  try {
    return await perform();
  } catch (error) {
    if (!isRecoverableCartIdentityError(error)) throw error;
    await refetchCartIdentity(error, queryClient, getCustomerId, context);
    return await perform();
  }
}

/**
 * Sets a line by *content* (product + selections), not by a caller-supplied
 * id: an existing match is found and updated, a fresh id is minted only when
 * nothing matches, and `quantity <= 0` removes an existing match or no-ops
 * if there isn't one. Every one of those decisions is made from the same
 * single cart snapshot the request's cartId/credential come from.
 */
export function useSetLineByContentMutation(getCustomerId: () => string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { productId: string; selections: CartOptionSelectionInput[]; quantity: number; customerNote?: string }) =>
      withCartIdentityRecovery(async () => {
        const { cart, cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);

        if (args.quantity <= 0) {
          const existing = findLineByContent(cart, args.productId, args.selections);
          if (!existing) return cart;
          return removeCartItem({ cartId, anonymousSessionId, cartItemId: existing.id });
        }

        const cartItemId = resolveCartLineId(cart, args.productId, args.selections);
        return setCartItem({
          cartId, anonymousSessionId, cartItemId,
          productId: args.productId, quantity: args.quantity, customerNote: args.customerNote, selections: args.selections,
        });
      }, queryClient, getCustomerId, context),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), cart),
    retry: false,
  });
}

/**
 * Resolves which line an "existing-line" mutation should act on: the given
 * `lineId` if it's still in the authoritative snapshot, or -- since a
 * caller-supplied id is a reference to what the user interacted with, not an
 * independently prepared identity -- the line with the same content, if the
 * id itself no longer resolves (`productId`/`selections` are optional, so a
 * caller with nothing to fall back to, like clearing a whole cart by id, can
 * omit them). Only when neither resolves does the caller's intent no longer
 * map to anything in the current cart.
 */
function resolveExistingLine(
  cart: ReturnType<typeof resolveCartIdentity>["cart"],
  lineId: string,
  productId?: string,
  selections?: CartOptionSelectionInput[],
) {
  return cart.items.find((candidate) => candidate.id === lineId)
    ?? (productId ? findLineByContent(cart, productId, selections ?? []) : undefined);
}

/**
 * Updates or removes a line the caller identifies by id (from the cart
 * currently on screen), falling back to a content match if that id no
 * longer resolves against this mutation's own fresh snapshot (see
 * resolveExistingLine). The resolved line's *own* id, productId, options,
 * and customerNote are what get sent -- never the caller's -- so a
 * content-fallback match is targeted correctly even though it has a
 * different id than the one the caller asked for.
 */
export function useUpdateExistingLineMutation(getCustomerId: () => string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { lineId: string; productId: string; selections: CartOptionSelectionInput[] } & ({ quantity: number } | { delta: number })) =>
      withCartIdentityRecovery(async () => {
        const { cart, cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);
        const item = resolveExistingLine(cart, args.lineId, args.productId, args.selections);
        if (!item) return cart;

        const quantity = "delta" in args ? item.quantity + args.delta : args.quantity;
        if (quantity <= 0) return removeCartItem({ cartId, anonymousSessionId, cartItemId: item.id });

        return setCartItem({
          cartId, anonymousSessionId, cartItemId: item.id,
          productId: item.productId, quantity, customerNote: item.customerNote ?? undefined,
          selections: item.options.map((option) => ({ optionId: option.optionId })),
        });
      }, queryClient, getCustomerId, context),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), cart),
    retry: false,
  });
}

/**
 * Removes a line the caller identifies by id, with the same content-match
 * fallback as useUpdateExistingLineMutation. `productId`/`selections` are
 * optional: a caller clearing every line in the cart by id (see orderAgain
 * in storefront-app.tsx) has no single content to fall back to, and doesn't
 * need one -- an id already gone from the current cart means there is
 * nothing left to remove.
 */
export function useRemoveExistingLineMutation(getCustomerId: () => string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { lineId: string; productId?: string; selections?: CartOptionSelectionInput[] }) =>
      withCartIdentityRecovery(async () => {
        const { cart, cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);
        const item = resolveExistingLine(cart, args.lineId, args.productId, args.selections);
        if (!item) return cart;
        return removeCartItem({ cartId, anonymousSessionId, cartItemId: item.id });
      }, queryClient, getCustomerId, context),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), cart),
    retry: false,
  });
}

/**
 * Saves the product-configuration sheet's result, whether that's a brand
 * new line or an edit of an existing one (`sourceLineId`):
 *
 *  - no `sourceLineId`: adding from the menu. `target` is any existing line
 *    with this exact content; its quantity (or 0) plus one is the new total.
 *  - `sourceLineId` given and its content is unchanged (`target.id ===
 *    sourceLineId`): a plain in-place update.
 *  - `sourceLineId` given and the content changed: the edited line's
 *    quantity moves to `target` (merging with whatever was already there),
 *    or to a freshly minted id if no line has that content yet, and the old
 *    line is removed.
 *
 * The move case is the only one that needs two RPCs. Each gets its own
 * resolveCartIdentity() call and its own withCartIdentityRecovery scope,
 * immediately before it is built -- the second call never reuses the first
 * call's cartId/credential, and its own recoverable-error retry only re-runs
 * itself, never the first call. (Wrapping both calls in one shared recovery
 * scope was tried and rejected: on a recoverable failure of the second call,
 * that would replay the *first* call too, from a snapshot that already
 * reflects the first call's own effect, re-merging the source quantity into
 * the target a second time.) The set is still ordered before the remove --
 * see the comment at the second call for why.
 */
export function useSaveCartLineConfigurationMutation(getCustomerId: () => string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { sourceLineId?: string; productId: string; selections: CartOptionSelectionInput[]; customerNote?: string }) => {
      const first = await withCartIdentityRecovery(async () => {
        const { cart, cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);
        const target = findLineByContent(cart, args.productId, args.selections);

        if (!args.sourceLineId) {
          const quantity = (target?.quantity ?? 0) + 1;
          const cartItemId = target?.id ?? cartLineKey(cart.id, args.productId, args.selections);
          const result = await setCartItem({
            cartId, anonymousSessionId, cartItemId,
            productId: args.productId, quantity, customerNote: args.customerNote, selections: args.selections,
          });
          return { cart: result, removeLineId: undefined as string | undefined };
        }

        const source = cart.items.find((item) => item.id === args.sourceLineId);
        const sourceQuantity = source?.quantity ?? 1;

        if (target && target.id === args.sourceLineId) {
          const result = await setCartItem({
            cartId, anonymousSessionId, cartItemId: args.sourceLineId,
            productId: args.productId, quantity: sourceQuantity, customerNote: args.customerNote, selections: args.selections,
          });
          return { cart: result, removeLineId: undefined as string | undefined };
        }

        // Set the merged target before removing the source, not after: if
        // cart identity changes between the two calls (e.g. this same cart
        // is converted by a concurrent checkout in another tab), both calls
        // guard on the cart still being 'active' and raise 55000 -- a code
        // recovery does not retry, since retrying a conversion-in-progress
        // isn't recoverable by re-reading the cart. Set-first means that
        // failure mode is a visible, harmless duplicate/inflated line (the
        // source survives, unremoved) rather than remove-first's failure
        // mode: the source silently gone and the merged replacement never
        // created.
        const targetId = target?.id ?? cartLineKey(cart.id, args.productId, args.selections);
        const mergedQuantity = sourceQuantity + (target?.quantity ?? 0);
        const result = await setCartItem({
          cartId, anonymousSessionId, cartItemId: targetId,
          productId: args.productId, quantity: mergedQuantity, customerNote: args.customerNote, selections: args.selections,
        });
        return { cart: result, removeLineId: args.sourceLineId as string | undefined };
      }, queryClient, getCustomerId, context);

      // Reflect the first call's own effect immediately so the second call's
      // resolveCartIdentity() -- inside its own recovery scope below -- reads
      // a snapshot that actually includes it, not the pre-mutation cache.
      queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), first.cart);
      if (!first.removeLineId) return first.cart;

      const removeLineId = first.removeLineId;
      return withCartIdentityRecovery(async () => {
        const { cart, cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);
        if (!cart.items.some((item) => item.id === removeLineId)) return cart;
        return removeCartItem({ cartId, anonymousSessionId, cartItemId: removeLineId });
      }, queryClient, getCustomerId, context);
    },
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), cart),
    retry: false,
  });
}

export function useSetCartCouponMutation(getCustomerId: () => string | null, context: StorefrontContext = storefrontContext) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { code: string | null }) =>
      withCartIdentityRecovery(async () => {
        const { cartId, anonymousSessionId } = resolveCartIdentity(queryClient, getCustomerId(), context);
        return setCartCoupon({ cartId, anonymousSessionId, code: args.code });
      }, queryClient, getCustomerId, context),
    onSuccess: (cart) => queryClient.setQueryData(storefrontCartQueryKey(getCustomerId(), context), cart),
    retry: false,
  });
}
