import {
  readJson,
  removeJson,
  writeJson,
} from "../../lib/storefront/safe-json-storage";
import type { StorefrontContext } from "../../lib/storefront/storefront-context";

// What actually gets persisted to the browser is a pointer to the
// server-authoritative cart row, not the cart's contents -- the contents are
// re-fetched (and reconciled) from Supabase on every load. Namespacing the
// key by business+location keeps carts from leaking across outlets even
// though only one outlet is configured today.
interface CartPointer {
  cartId: string;
}

function isCartPointer(value: unknown): value is CartPointer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { cartId?: unknown }).cartId === "string"
  );
}

function storageKey(context: StorefrontContext) {
  return `a2-storefront-cart:${context.businessId}:${context.locationId}`;
}

export function readCartPointer(context: StorefrontContext): string | null {
  const pointer = readJson(storageKey(context), isCartPointer);
  return pointer?.cartId ?? null;
}

export function writeCartPointer(context: StorefrontContext, cartId: string) {
  writeJson(storageKey(context), { cartId } satisfies CartPointer);
}

export function clearCartPointer(context: StorefrontContext) {
  removeJson(storageKey(context));
}
