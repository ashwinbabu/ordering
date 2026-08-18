import type { ServerCart, ServerCartItem } from "../../domain/cart";

/**
 * Finds the line already in `cart` with this exact product + option
 * configuration, if any -- matched by content, not by an id. This is what
 * makes existing-line lookup robust to attach_anonymous_cart's re-parenting:
 * a survived line keeps its original id even though its cart_id changed, so
 * a match here can have come from a different cart entirely.
 */
export function findLineByContent(
  cart: ServerCart,
  productId: string,
  selections: { optionId: string }[],
): ServerCartItem | undefined {
  const optionIds = selections.map((selection) => selection.optionId).sort().join(",");
  return cart.items.find((item) => {
    if (item.productId !== productId) return false;
    return item.options.map((option) => option.optionId).sort().join(",") === optionIds;
  });
}

/**
 * The single place that decides existing-vs-new for a "set by content"
 * mutation: an existing match's own id, or a freshly minted one.
 *
 * The id for a genuinely new line is a random UUID, not a hash of
 * (cartId, productId, selections). A deterministic id was tried and
 * reverted: `ordering.carts.id` is not a one-time value -- both
 * open_anonymous_cart (reactivating a matching abandoned cart) and
 * attach_anonymous_cart (re-owning an abandoned customer cart "in place")
 * intentionally reuse an existing cart's id rather than minting a new one.
 * A cart id can therefore outlive a full abandon-and-reparent cycle: items
 * added under it get moved to a different cart_id by attach_anonymous_cart
 * (id preserved, see findLineByContent above), and when that same cart id
 * is later reactivated, a deterministic hash of (that id, product,
 * selections) recomputes the *same* id as the old, now-elsewhere row --
 * colliding with it and making ordering.set_cart_item raise 23505
 * ('cart item identifier belongs to a different line') on every attempt to
 * add that product again, with no way to recover by retrying, since the
 * hash is a pure function of values that haven't actually changed. A random
 * id cannot collide with a stale row from a past cart lifecycle.
 */
export function resolveCartLineId(cart: ServerCart, productId: string, selections: { optionId: string }[]): string {
  return findLineByContent(cart, productId, selections)?.id ?? window.crypto.randomUUID();
}
