import { formatMoney } from "../../money.ts";

export interface StaffNewOrderTelegramItem {
  productName: string;
  quantity: number;
}

export interface StaffNewOrderTelegramData {
  businessName: string;
  locationName: string;
  orderNumber: string;
  fulfillmentType: string;
  paymentMethod: string;
  grandTotalFormatted: string;
  items: StaffNewOrderTelegramItem[];
  estimatedDeliveryMinutes: number | null;
  orderUrl: string | null;
}

// deno-lint-ignore no-explicit-any
type RawOrderContext = any;

/** No admin per-order route exists to link to today (the admin app is a
 * live queue screen, not a routed order-detail page) -- omit the button
 * rather than invent a URL that doesn't resolve, matching the same
 * "omit the CTA if it can't be determined reliably" rule email already
 * follows for the storefront link. */
export function buildStaffNewOrderTelegramData(context: RawOrderContext): StaffNewOrderTelegramData {
  const { order, business, location, items } = context;
  return {
    businessName: business?.name ?? "",
    locationName: location?.name ?? "",
    orderNumber: order.orderNumber,
    fulfillmentType: order.fulfillmentType,
    paymentMethod: order.paymentMethod,
    grandTotalFormatted: formatMoney(order.grandTotal, order.currency),
    items: (items ?? []).map((item: RawOrderContext) => ({
      productName: item.productName,
      quantity: item.quantity,
    })),
    estimatedDeliveryMinutes: order.estimatedDeliveryMinutes,
    orderUrl: null,
  };
}
