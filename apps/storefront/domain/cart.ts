// Server-authoritative cart contract (ordering.get_cart /
// ordering.set_cart_item / ordering.remove_cart_item /
// ordering.set_cart_coupon). This is the source of truth for pricing and
// contents; it is cached by TanStack Query, not duplicated into local state.
export interface ServerCartItemOption {
  optionId: string;
  name: string;
  priceDelta: number;
  quantity: number;
}

export interface ServerCartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  customerNote: string | null;
  baseUnitPrice: number;
  modifierUnitTotal: number;
  estimatedLineTotal: number;
  options: ServerCartItemOption[];
}

export interface ServerCartCoupon {
  id: string;
  code: string;
}

export interface ServerCart {
  id: string;
  businessId: string;
  locationId: string;
  status: string;
  isAuthenticated: boolean;
  updatedAt: string;
  expiresAt: string;
  estimatedFoodSubtotal: number;
  coupon: ServerCartCoupon | null;
  items: ServerCartItem[];
}

// ordering.get_storefront_settings -- public, read-only restaurant
// configuration the cart needs to price and gate checkout.
export interface StorefrontDeliveryZone {
  id: string;
  name: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  minimumOrderValue: number;
}

export type TaxMode = "none" | "inclusive" | "exclusive";

export interface StorefrontPaymentMethods {
  defaultMethod: "cash" | "online";
  cash: { enabled: boolean };
  online: {
    configured: boolean;
    enabled: boolean;
    status: "available" | "disabled" | "not_configured";
  };
}

export interface StorefrontSettings {
  schemaVersion: 2;
  currency: string;
  locationPhone: string | null;
  orderingEnabled: boolean;
  orderingMode: "delivery" | "pickup" | "both";
  acceptOrdersWhenClosed: boolean;
  isOpenNow: boolean;
  minimumOrderValue: number;
  taxMode: TaxMode;
  taxRate: number;
  paymentMethods: StorefrontPaymentMethods;
  deliveryZones: StorefrontDeliveryZone[];
}

// ordering.validate_coupon
export interface CouponValidation {
  valid: boolean;
  reason?: string;
  couponId?: string;
  code?: string;
  discountAmount?: number;
}

// ordering.get_delivery_quote
export interface DeliveryQuote {
  serviceable: boolean;
  distanceKm: number;
  minimumOrderValue: number | null;
  normalDeliveryFee: number | null;
  deliveryFee: number | null;
}

export type CartUnavailableReason =
  "product-unavailable" | "product-removed" | "option-unavailable";

// A cart item reconciled against the current live menu for display. Pricing
// always comes straight from the server cart (never recomputed locally);
// this only adds the availability/display facts the cart RPC does not
// already carry (get_cart returns current price for a deactivated product,
// but not whether it is still orderable).
export interface CartLineView {
  id: string;
  productId: string;
  productName: string;
  imageUrl?: string;
  quantity: number;
  customerNote: string | null;
  unitPrice: number;
  lineTotal: number;
  options: ServerCartItemOption[];
  isAvailable: boolean;
  unavailableReason?: CartUnavailableReason;
  hasOptionGroups: boolean;
}
