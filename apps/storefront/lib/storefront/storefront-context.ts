// Single centralized business/location boundary. Every data-layer module
// (menu, cart, settings, addresses, orders, checkout, coupons) reads the
// active outlet from here instead of resolving it independently.
export interface StorefrontContext {
  businessId: string;
  locationId: string;
  businessName: string;
  locationName: string;
}

// This is a mutable singleton, not a plain constant. Every call site below
// menu/cart/settings/addresses/orders reads it as a default parameter --
// `context: StorefrontContext = storefrontContext` -- which is evaluated
// fresh on every call. `setStorefrontContext` mutates this same object
// in place (rather than reassigning the export) so all of those call sites
// keep working unchanged. `StorefrontBootstrap` is the only caller, and only
// once `ordering.resolve_storefront_context` has actually resolved the
// hostname -- it gates rendering of everything that reads this default, so
// nothing ever observes the empty placeholder below.
export const storefrontContext: StorefrontContext = {
  businessId: "",
  locationId: "",
  businessName: "",
  locationName: "",
};

export function setStorefrontContext(resolved: StorefrontContext): void {
  Object.assign(storefrontContext, resolved);
}
