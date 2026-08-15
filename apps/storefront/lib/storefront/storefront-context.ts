// Single centralized business/location boundary. Every data-layer module
// (menu, cart, settings, coupons) reads the active outlet from here instead
// of hardcoding IDs. A future URL/domain/slug resolver replaces this module's
// internals without touching any caller.
export interface StorefrontContext {
  businessId: string;
  locationId: string;
}

// Development routing seam: A2 / Arambol. Production host/route resolution
// replaces these values without affecting menu, cart, or settings call sites.
const a2BusinessId = "71667212-8437-4a40-a6fa-de869ca8f1b5";
const arambolLocationId = "23ca53d8-5e39-42af-acfb-b2e5c50b3c8b";

export const storefrontContext: StorefrontContext = {
  businessId: import.meta.env.VITE_STOREFRONT_BUSINESS_ID ?? a2BusinessId,
  locationId: import.meta.env.VITE_STOREFRONT_LOCATION_ID ?? arambolLocationId,
};
