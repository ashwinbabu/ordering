// Re-exported from the centralized storefront context so existing menu call
// sites keep working. New code should import storefrontContext directly.
import { storefrontContext } from "../../lib/storefront/storefront-context";

export { storefrontContext };
export const storefrontLocationId = storefrontContext.locationId;
