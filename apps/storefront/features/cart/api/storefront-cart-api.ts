import { getSupabaseClient } from "../../../lib/supabase/client";
import {
  readArray,
  readBoolean,
  readNullableNumber,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from "../../../lib/supabase/json-parsing";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";
import type {
  CouponValidation,
  DeliveryQuote,
  ServerCart,
  ServerCartItem,
  ServerCartItemOption,
} from "../../../domain/cart";

/** The RPC only needs the option id; display fields belong to the caller's own domain types. */
export interface CartOptionSelectionInput {
  optionId: string;
}

function parseCartItemOption(value: unknown): ServerCartItemOption {
  const option = readRecord(value as never, "A cart item option");
  return {
    optionId: readString(option.option_id, "A cart item option ID"),
    name: readString(option.name, "A cart item option name"),
    priceDelta: readNumber(
      option.price_delta,
      "A cart item option price delta",
    ),
    quantity: readNumber(option.quantity, "A cart item option quantity"),
  };
}

function parseCartItem(value: unknown): ServerCartItem {
  const item = readRecord(value as never, "A cart item");
  return {
    id: readString(item.id, "A cart item ID"),
    productId: readString(item.product_id, "A cart item product ID"),
    productName: readString(item.product_name, "A cart item product name"),
    quantity: readNumber(item.quantity, "A cart item quantity"),
    customerNote: readNullableString(item.customer_note, "A cart item note"),
    baseUnitPrice: readNumber(item.base_unit_price, "A cart item base price"),
    modifierUnitTotal: readNumber(
      item.modifier_unit_total,
      "A cart item modifier total",
    ),
    estimatedLineTotal: readNumber(
      item.estimated_line_total,
      "A cart item line total",
    ),
    options: readArray(item.options as never, "A cart item's options").map(
      parseCartItemOption,
    ),
  };
}

function parseServerCart(value: unknown): ServerCart {
  const cart = readRecord(value as never, "The cart response");
  const couponValue = cart.coupon;
  const coupon =
    couponValue === null || couponValue === undefined
      ? null
      : (() => {
          const record = readRecord(couponValue as never, "A cart coupon");
          return {
            id: readString(record.id, "A cart coupon ID"),
            code: readString(record.code, "A cart coupon code"),
          };
        })();

  return {
    id: readString(cart.id, "The cart ID"),
    businessId: readString(cart.business_id, "The cart business ID"),
    locationId: readString(cart.location_id, "The cart location ID"),
    status: readString(cart.status, "The cart status"),
    isAuthenticated: readBoolean(
      cart.is_authenticated,
      "The cart authentication flag",
    ),
    updatedAt: readString(cart.updated_at, "The cart updated timestamp"),
    expiresAt: readString(cart.expires_at, "The cart expiry timestamp"),
    estimatedFoodSubtotal: readNumber(
      cart.estimated_food_subtotal,
      "The cart subtotal",
    ),
    coupon,
    items: readArray(cart.items as never, "The cart items").map(parseCartItem),
  };
}

function cartRpc() {
  return getSupabaseClient().schema("ordering");
}

export async function openAnonymousCart(args: {
  cartId: string;
  businessId: string;
  locationId: string;
  anonymousSessionId: string;
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "open_anonymous_cart", {
    p_cart_id: args.cartId,
    p_business_id: args.businessId,
    p_location_id: args.locationId,
    p_anonymous_session_id: args.anonymousSessionId,
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

/**
 * Claims the browser's anonymous cart for a signed-in customer, and doubles as
 * "open the customer's cart": ordering.attach_anonymous_cart merges an
 * anonymous cart into an existing customer cart when both exist, adopts the
 * anonymous one when only it exists, and creates a fresh cart when neither
 * does. It also prunes lines no longer orderable at this location and
 * revalidates any attached coupon, so the caller needs no merge logic of its
 * own -- and ordering.open_customer_cart is never needed.
 *
 * `newCartId` is only consumed by the create-from-nothing branch; supplying a
 * stable value keeps a retried call idempotent.
 */
export async function attachAnonymousCart(args: {
  businessId: string;
  locationId: string;
  anonymousSessionId: string;
  customerBusinessId: string;
  newCartId: string;
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "attach_anonymous_cart", {
    p_business_id: args.businessId,
    p_location_id: args.locationId,
    p_anonymous_session_id: args.anonymousSessionId,
    p_customer_business_id: args.customerBusinessId,
    p_new_cart_id: args.newCartId,
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

/**
 * `anonymousSessionId` must be null once a cart belongs to a signed-in
 * customer: private.can_access_cart authorises those through auth.uid()
 * instead, and a claimed cart no longer has a session id to match.
 */
export async function getCart(args: {
  cartId: string;
  anonymousSessionId: string | null;
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "get_cart", {
    p_cart_id: args.cartId,
    p_anonymous_session_id: args.anonymousSessionId,
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

export async function setCartItem(args: {
  cartId: string;
  anonymousSessionId: string | null;
  cartItemId: string;
  productId: string;
  quantity: number;
  customerNote?: string;
  selections: CartOptionSelectionInput[];
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "set_cart_item", {
    p_cart_id: args.cartId,
    p_anonymous_session_id: args.anonymousSessionId,
    p_cart_item_id: args.cartItemId,
    p_product_id: args.productId,
    p_quantity: args.quantity,
    p_customer_note: args.customerNote ?? null,
    p_options: args.selections.map((selection) => ({
      option_id: selection.optionId,
      quantity: 1,
    })),
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

export async function removeCartItem(args: {
  cartId: string;
  anonymousSessionId: string | null;
  cartItemId: string;
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "remove_cart_item", {
    p_cart_id: args.cartId,
    p_anonymous_session_id: args.anonymousSessionId,
    p_cart_item_id: args.cartItemId,
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

export async function setCartCoupon(args: {
  cartId: string;
  anonymousSessionId: string | null;
  code: string | null;
}): Promise<ServerCart> {
  const result = await callUntypedRpc(cartRpc(), "set_cart_coupon", {
    p_cart_id: args.cartId,
    p_anonymous_session_id: args.anonymousSessionId,
    p_code: args.code,
  });
  if (result.error) throw result.error;
  return parseServerCart(result.data);
}

export async function validateCoupon(args: {
  businessId: string;
  locationId: string;
  code: string;
  eligibleFoodSubtotal: number;
}): Promise<CouponValidation> {
  const result = await cartRpc().rpc("validate_coupon", {
    p_business_id: args.businessId,
    p_location_id: args.locationId,
    p_code: args.code,
    p_eligible_food_subtotal: args.eligibleFoodSubtotal,
  });
  if (result.error) throw result.error;

  const validation = readRecord(
    result.data as never,
    "The coupon validation response",
  );
  const valid = readBoolean(validation.valid, "The coupon validation result");
  if (!valid) {
    return {
      valid: false,
      reason:
        readNullableString(validation.reason, "The coupon validation reason") ??
        undefined,
    };
  }

  return {
    valid: true,
    couponId: readString(validation.coupon_id, "The coupon ID"),
    code: readString(validation.code, "The coupon code"),
    discountAmount: readNumber(
      validation.discount_amount,
      "The coupon discount amount",
    ),
  };
}

export async function getDeliveryQuote(args: {
  locationId: string;
  destinationLatitude: number;
  destinationLongitude: number;
  foodSubtotalAfterDiscount: number;
}): Promise<DeliveryQuote | null> {
  const result = await cartRpc().rpc("get_delivery_quote", {
    p_location_id: args.locationId,
    p_destination_latitude: args.destinationLatitude,
    p_destination_longitude: args.destinationLongitude,
    p_food_subtotal_after_discount: args.foodSubtotalAfterDiscount,
  });
  if (result.error) throw result.error;
  if (result.data === null) return null;

  const quote = readRecord(result.data as never, "The delivery quote response");
  return {
    serviceable: readBoolean(
      quote.serviceable,
      "The delivery quote serviceable flag",
    ),
    distanceKm: readNumber(quote.distance_km, "The delivery quote distance"),
    minimumOrderValue: readNullableNumber(
      quote.minimum_order_value,
      "The delivery quote minimum order value",
    ),
    normalDeliveryFee: readNullableNumber(
      quote.normal_delivery_fee,
      "The delivery quote normal fee",
    ),
    deliveryFee: readNullableNumber(
      quote.delivery_fee,
      "The delivery quote fee",
    ),
  };
}
