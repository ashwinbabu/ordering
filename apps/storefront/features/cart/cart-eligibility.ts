import type { CartLineView } from "../../domain/cart";
import type { StorefrontSettings } from "../../domain/cart";
import type { FulfilmentType } from "../../domain/storefront";

export type CheckoutBlockReason =
  | "cart-empty"
  | "restaurant-paused"
  | "restaurant-closed"
  | "item-unavailable"
  | "below-minimum"
  | "address-required"
  | "delivery-unserviceable"
  | "offline";

export interface CheckoutEligibilityInput {
  lines: CartLineView[];
  settings: StorefrontSettings | null;
  fulfilment: FulfilmentType;
  hasAddress: boolean;
  deliveryServiceable: boolean | undefined;
  isOffline: boolean;
  netFoodSubtotal: number;
}

export interface CheckoutEligibility {
  canCheckout: boolean;
  reason?: CheckoutBlockReason;
}

const messages: Record<CheckoutBlockReason, string> = {
  "cart-empty": "Your cart is empty",
  "restaurant-paused": "This restaurant has paused ordering",
  "restaurant-closed": "This restaurant is closed right now",
  "item-unavailable": "Remove unavailable items to continue",
  "below-minimum": "Add more to meet the minimum order",
  "address-required": "Add a delivery address to continue",
  "delivery-unserviceable": "We can't deliver to this address",
  offline: "You're offline -- reconnect to continue",
};

export function checkoutEligibilityMessage(reason: CheckoutBlockReason) {
  return messages[reason];
}

// Single derived source of truth for whether the customer may proceed to
// checkout, so the cart screen does not scatter this logic across multiple
// conditionals (task: centralize checkout eligibility).
export function evaluateCheckoutEligibility(
  input: CheckoutEligibilityInput,
): CheckoutEligibility {
  if (input.isOffline) return { canCheckout: false, reason: "offline" };
  if (input.lines.length === 0)
    return { canCheckout: false, reason: "cart-empty" };
  if (input.lines.some((line) => !line.isAvailable))
    return { canCheckout: false, reason: "item-unavailable" };

  const settings = input.settings;
  if (settings) {
    if (!settings.orderingEnabled)
      return { canCheckout: false, reason: "restaurant-paused" };
    if (!settings.isOpenNow && !settings.acceptOrdersWhenClosed)
      return { canCheckout: false, reason: "restaurant-closed" };
    if (input.netFoodSubtotal < settings.minimumOrderValue)
      return { canCheckout: false, reason: "below-minimum" };
  }

  if (input.fulfilment === "delivery") {
    if (!input.hasAddress)
      return { canCheckout: false, reason: "address-required" };
    if (input.deliveryServiceable === false)
      return { canCheckout: false, reason: "delivery-unserviceable" };
  }

  return { canCheckout: true };
}
