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

export interface OrderCancelledTelegramData {
  businessName: string;
  locationName: string;
  orderNumber: string;
  grandTotalFormatted: string;
  cancelReason: string | null;
  cancelledByActorType: string;
}

export function buildOrderCancelledTelegramData(
  context: RawOrderContext,
  actorType: string,
): OrderCancelledTelegramData {
  const { order, business, location } = context;
  return {
    businessName: business?.name ?? "",
    locationName: location?.name ?? "",
    orderNumber: order.orderNumber,
    grandTotalFormatted: formatMoney(order.grandTotal, order.currency),
    cancelReason: order.cancelReason ?? null,
    cancelledByActorType: actorType,
  };
}

export interface OrderWaitingTelegramData {
  businessName: string;
  locationName: string;
  orderNumber: string;
  waitingMinutes: number;
  items: StaffNewOrderTelegramItem[];
}

export function buildOrderWaitingTelegramData(
  context: RawOrderContext,
  waitingMinutes: number,
): OrderWaitingTelegramData {
  const { order, business, location, items } = context;
  return {
    businessName: business?.name ?? "",
    locationName: location?.name ?? "",
    orderNumber: order.orderNumber,
    waitingMinutes,
    items: (items ?? []).map((item: RawOrderContext) => ({
      productName: item.productName,
      quantity: item.quantity,
    })),
  };
}

export interface StoreStatusTelegramData {
  businessName: string;
  locationName: string;
  isAccepting: boolean;
}

// deno-lint-ignore no-explicit-any
export function buildStoreStatusTelegramData(context: any, isAccepting: boolean): StoreStatusTelegramData {
  return {
    businessName: context.business?.name ?? "",
    locationName: context.location?.name ?? "",
    isAccepting,
  };
}

export interface DailySalesSummaryTelegramData {
  businessName: string;
  locationName: string;
  date: string;
  orderCount: number;
  cancelledCount: number;
  totalRevenueFormatted: string;
  cashRevenueFormatted: string;
  onlineRevenueFormatted: string;
}

// deno-lint-ignore no-explicit-any
export function buildDailySalesSummaryTelegramData(context: any): DailySalesSummaryTelegramData {
  const currency = context.business?.currency ?? "INR";
  const sales = context.salesSummary ?? {};
  return {
    businessName: context.business?.name ?? "",
    locationName: context.location?.name ?? "",
    date: sales.date ?? "",
    orderCount: sales.orderCount ?? 0,
    cancelledCount: sales.cancelledCount ?? 0,
    totalRevenueFormatted: formatMoney(sales.totalRevenue, currency),
    cashRevenueFormatted: formatMoney(sales.cashRevenue, currency),
    onlineRevenueFormatted: formatMoney(sales.onlineRevenue, currency),
  };
}
