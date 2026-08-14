// Explicit development routing seam. Production host/route resolution replaces
// this value without affecting menu UI or the Supabase data service.
const arambolDevelopmentLocationId = "23ca53d8-5e39-42af-acfb-b2e5c50b3c8b";

export const storefrontLocationId =
  import.meta.env.VITE_STOREFRONT_LOCATION_ID ?? arambolDevelopmentLocationId;
