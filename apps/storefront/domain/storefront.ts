export type MenuPresentation = "list" | "grid";

export type ProductAvailability = "available" | "sold-out";

export interface Venue {
  businessName: string;
  displayName: string;
  locationName: string;
  locationDescription: string;
  address: string;
  orderingStatus: string;
  isAcceptingOrders: boolean;
  accentColor: string;
  logoUrl: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  availability: ProductAvailability;
  badges?: string[];
  optionGroups?: StorefrontMenuOptionGroup[];
}

export interface FeaturedProduct {
  productId: string;
  editorialLabel: string;
}

export interface Menu {
  defaultPresentation: MenuPresentation;
  allowPresentationChange: boolean;
  categories: MenuCategory[];
  products: MenuProduct[];
  featuredProducts: FeaturedProduct[];
}

export interface StorefrontDemo {
  venue: Venue;
  menu: Menu;
}

export type StorefrontOptionSelectionType = "single" | "multiple";

export interface StorefrontMenuOption {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
  sortOrder: number;
}

export interface StorefrontMenuOptionGroup {
  id: string;
  name: string;
  selectionType: StorefrontOptionSelectionType;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: StorefrontMenuOption[];
}

export interface StorefrontMenuProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  image: string | null;
  dietaryType: string | null;
  available: boolean;
  sortOrder: number;
  optionGroups: StorefrontMenuOptionGroup[];
}

export interface StorefrontMenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  products: StorefrontMenuProduct[];
}

export interface StorefrontMenu {
  schemaVersion: 1;
  orderingEnabled: boolean;
  business: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    logoUrl: string | null;
  };
  location: {
    id: string;
    name: string;
  };
  categories: StorefrontMenuCategory[];
  featuredProducts: FeaturedProduct[];
}

export type FulfilmentType = "delivery" | "pickup";

export interface CartLine {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: CartLineOptionSelection[];
}

export interface CartLineOptionSelection {
  groupId: string;
  optionId: string;
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface CustomerDetails {
  name: string;
  countryIso2: string;
  countryCode: string;
  phone: string;
}

export type AddressLabel = "Home" | "Hotel" | "Work" | "Other";

export interface DeliveryAddress {
  id: string;
  label: AddressLabel;
  customLabel?: string;
  recipientName: string;
  recipientPhoneE164: string;
  recipientPhoneCountryIso2: string;
  recipientPhone: string;
  preferredContactMethod: "phone" | "whatsapp" | "telegram";
  telegramUsername?: string;
  line1: string;
  line2: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  landmark: string;
  instructions: string;
  isDefault: boolean;
  // Approximate area-centroid coordinates used to price delivery via the
  // real ordering.get_delivery_quote boundary. Absent for addresses saved
  // before this field existed or for an area outside the known lookup.
  latitude?: number;
  longitude?: number;
}

export interface DeliveryContact {
  method: "phone" | "whatsapp" | "telegram";
  phone: string;
  telegramUsername?: string;
}

export interface CustomerProfile {
  name: string;
  countryIso2: string;
  countryCode: string;
  phone: string;
  email?: string;
  isPhoneVerified: boolean;
}

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded";
export type PaymentStatus =
  | "awaiting_provider"
  | "confirmed"
  | "pending"
  | "failed"
  | "cancelled"
  | "verification_error";
export type OrderPaymentStatus = "paid" | "pending" | "refunded";

/**
 * Statuses that represent an order still in progress, as opposed to a
 * terminal one. Drives both the "Current orders" / "Past orders" split on
 * the order-history screen and, for routing, which screen `/orders/:orderId`
 * renders (OrderTrackingScreen for these, OrderDetailsScreen otherwise) --
 * one partition, reused rather than re-decided per call site. "completed" and
 * "refunded" are declared on OrderStatus but never produced by
 * orderStatusByDatabaseValue (see customer-orders-api.ts), so they're not
 * reachable in practice; excluding them here just means they fall through to
 * the "past" side like every other terminal status would.
 */
export const currentOrderStatuses = new Set<OrderStatus>([
  "placed",
  "accepted",
  "preparing",
  "out-for-delivery",
]);

export interface OrderLineItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  selectedOptions?: string[];
  note?: string;
}

export interface OrderTimelineEntry {
  label: string;
  occurredAt: string;
}

export interface StorefrontOrder {
  /** ordering.orders.order_number -- the human-facing reference shown as "Order #{id}". */
  id: string;
  /** ordering.orders.id -- the real row UUID. Only this can be used to build an /orders/:orderId link or to call get_order; `id` above cannot. */
  orderId: string;
  restaurantId: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: string;
  fulfilment: FulfilmentType;
  items: OrderLineItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  taxes: number;
  total: number;
  couponCode?: string;
  deliveryAddress?: DeliveryAddress;
  deliveryContact?: DeliveryContact;
  orderNote?: string;
  estimatedFulfilment?: string;
  completedAt?: string;
  cancellationReason?: string;
  timeline?: OrderTimelineEntry[];
}

export type ResourceState = "loading" | "ready" | "error";

export interface CheckoutRequest {
  cart: CartLine[];
  customer: CustomerDetails;
  /** Kitchen note from the cart screen; persisted as ordering.orders.customer_note. */
  customerNote?: string;
  deliveryAddress?: DeliveryAddress;
  displayedTotal: number;
  fulfilment: FulfilmentType;
  items: OrderLineItem[];
  subtotal: number;
  deliveryFee: number;
  taxes: number;
}

export interface PaymentPendingOrder {
  /** ordering.orders.id -- the idempotency key, and what /orders/:id resolves. */
  id: string;
  /** ordering.orders.order_number -- the short human-facing reference. */
  orderNumber: string;
  amount: number;
  createdAt: string;
  fulfilment: FulfilmentType;
  itemCount: number;
  paymentStatus: PaymentStatus;
  trackingOrder: StorefrontOrder;
}

export function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function productsForCategory(menu: Menu, categoryId: string) {
  return menu.products.filter((product) => product.categoryId === categoryId);
}

export function productById(menu: Menu, productId: string) {
  return menu.products.find((product) => product.id === productId);
}
