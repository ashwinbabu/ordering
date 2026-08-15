import type { CartLineOptionSelection } from "../../domain/storefront";

// The server upserts a cart item by client-supplied id
// (ordering.set_cart_item), so the client owns cart-line identity. Two lines
// are the same line only when product + variant/modifier selections match
// exactly; quantity belongs to that exact configuration (task: cart-line
// identity). The cart's own id is folded in so a fresh cart opened after the
// previous one expired never collides with a stale item id from before.
export function cartLineKey(cartId: string, productId: string, selections: CartLineOptionSelection[]) {
  const optionsKey = selections
    .map((selection) => selection.optionId)
    .sort()
    .join(",");
  return deterministicUuid(`${cartId}:${productId}:${optionsKey}`);
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
