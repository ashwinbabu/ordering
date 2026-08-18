import type { ServerCart, ServerCartItem } from "../../domain/cart";

// The server upserts a cart item by client-supplied id
// (ordering.set_cart_item), so the client owns cart-line identity. Two lines
// are the same line only when product + variant/modifier selections match
// exactly; quantity belongs to that exact configuration (task: cart-line
// identity). The cart's own id is folded in so a fresh cart opened after the
// previous one expired never collides with a stale item id from before.
//
// Only for minting the id of a genuinely new line. An existing line's id
// must come from the authoritative cart response (see resolveCartLineId) --
// attach_anonymous_cart can re-parent an existing cart_items row onto a
// different cart_id while preserving its id, so recomputing this hash for a
// line that may already exist is not safe.
export function cartLineKey(cartId: string, productId: string, selections: { optionId: string }[]) {
  const optionsKey = selections
    .map((selection) => selection.optionId)
    .sort()
    .join(",");
  return deterministicUuid(`${cartId}:${productId}:${optionsKey}`);
}

/**
 * Finds the line already in `cart` with this exact product + option
 * configuration, if any -- matched by content, not by recomputing an id.
 * This is what makes existing-line lookup robust to attach_anonymous_cart's
 * re-parenting: a survived line keeps its original id even though its
 * cart_id changed, so a fresh cartLineKey(cart.id, ...) would not find it,
 * but a content match does.
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
 * mutation: an existing match's own id, or a freshly minted one -- always
 * derived from the same `cart` snapshot passed in, so it can never disagree
 * with the cart_id sent alongside it in the same request.
 */
export function resolveCartLineId(cart: ServerCart, productId: string, selections: { optionId: string }[]): string {
  return findLineByContent(cart, productId, selections)?.id ?? cartLineKey(cart.id, productId, selections);
}

function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex8(value: number) {
  return value.toString(16).padStart(8, "0");
}

// Deterministic, synchronous, dependency-free 128-bit digest formatted as a
// UUID (in the spirit of UUID v5, without pulling in a crypto/SHA1 library
// for what is purely a stable local identifier -- ownership of the cart
// itself is enforced server-side by the anonymous session id, not by this
// value being unguessable).
function deterministicUuid(input: string): string {
  const a = fnv1a32(input, 0x811c9dc5);
  const b = fnv1a32(`${input}:1`, a);
  const c = fnv1a32(`${input}:2`, b);
  const d = fnv1a32(`${input}:3`, c);

  const bytes = [hex8(a), hex8(b), hex8(c), hex8(d)].join("");
  const version = "4";
  const variant = ((parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);

  return [
    bytes.slice(0, 8),
    bytes.slice(8, 12),
    version + bytes.slice(13, 16),
    variant + bytes.slice(17, 20),
    bytes.slice(20, 32),
  ].join("-");
}
