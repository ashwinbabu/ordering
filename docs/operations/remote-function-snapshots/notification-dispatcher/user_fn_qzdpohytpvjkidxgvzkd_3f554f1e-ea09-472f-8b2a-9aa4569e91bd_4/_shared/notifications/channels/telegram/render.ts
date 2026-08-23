import type {
  DailySalesSummaryTelegramData,
  OrderCancelledTelegramData,
  OrderWaitingTelegramData,
  StaffNewOrderTelegramData,
  StoreStatusTelegramData,
} from "../../templates/telegram/template-data.ts";

export interface RenderedTelegramMessage {
  text: string;
  parseMode: "HTML";
  buttonUrl: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderStaffNewOrder(data: StaffNewOrderTelegramData): RenderedTelegramMessage {
  const isDelivery = data.fulfillmentType === "delivery";
  const lines: string[] = [];

  lines.push(`🕮 <b>New order</b> · ${escapeHtml(data.businessName)}`);
  lines.push(`#${escapeHtml(data.orderNumber)} · ${escapeHtml(data.grandTotalFormatted)}`);
  lines.push(`${isDelivery ? "Delivery" : "Pickup"} · ${escapeHtml(data.paymentMethod === "cash" ? "Cash" : "Paid online")}`);
  lines.push("");
  for (const item of data.items) {
    lines.push(`${item.quantity} × ${escapeHtml(item.productName)}`);
  }
  if (data.estimatedDeliveryMinutes != null) {
    lines.push("");
    lines.push(`Estimated ${isDelivery ? "delivery" : "prep"}: ~${data.estimatedDeliveryMinutes} min`);
  }

  return { text: lines.join("\n"), parseMode: "HTML", buttonUrl: data.orderUrl };
}

function headlineForCancelActor(actorType: string, businessName: string): string {
  switch (actorType) {
    case "customer":
      return "Cancelled by the customer.";
    case "admin":
    case "telegram":
      return `Cancelled by ${businessName}.`;
    default:
      return "Cancelled.";
  }
}

function renderOrderCancelled(data: OrderCancelledTelegramData): RenderedTelegramMessage {
  const lines = [
    `❌ <b>Order cancelled</b> · ${escapeHtml(data.businessName)}`,
    `#${escapeHtml(data.orderNumber)} · ${escapeHtml(data.grandTotalFormatted)}`,
    headlineForCancelActor(data.cancelledByActorType, escapeHtml(data.businessName)),
  ];
  if (data.cancelReason) {
    lines.push(`Reason: ${escapeHtml(data.cancelReason)}`);
  }
  return { text: lines.join("\n"), parseMode: "HTML", buttonUrl: null };
}

function renderOrderWaiting(data: OrderWaitingTelegramData): RenderedTelegramMessage {
  const lines = [
    `⏳ <b>Order waiting ${data.waitingMinutes} min</b> · ${escapeHtml(data.businessName)}`,
    `#${escapeHtml(data.orderNumber)}`,
    "",
    ...data.items.map((item) => `${item.quantity} × ${escapeHtml(item.productName)}`),
  ];
  return { text: lines.join("\n"), parseMode: "HTML", buttonUrl: null };
}

function renderStoreStatus(data: StoreStatusTelegramData): RenderedTelegramMessage {
  const text = data.isAccepting
    ? `🟢 <b>${escapeHtml(data.businessName)}</b> · ${escapeHtml(data.locationName)} is now accepting orders.`
    : `🔴 <b>${escapeHtml(data.businessName)}</b> · ${escapeHtml(data.locationName)} has stopped accepting orders.`;
  return { text, parseMode: "HTML", buttonUrl: null };
}

function renderDailySalesSummary(data: DailySalesSummaryTelegramData): RenderedTelegramMessage {
  const lines = [
    `📊 <b>Daily summary</b> · ${escapeHtml(data.businessName)} · ${escapeHtml(data.locationName)}`,
    escapeHtml(data.date),
    "",
    `${data.orderCount} orders · ${escapeHtml(data.totalRevenueFormatted)}`,
    `Cash: ${escapeHtml(data.cashRevenueFormatted)} · Online: ${escapeHtml(data.onlineRevenueFormatted)}`,
  ];
  if (data.cancelledCount > 0) {
    lines.push(`${data.cancelledCount} cancelled`);
  }
  return { text: lines.join("\n"), parseMode: "HTML", buttonUrl: null };
}

export function renderTelegramTemplate(templateKey: string, payload: unknown): RenderedTelegramMessage {
  switch (templateKey) {
    case "staff_new_order":
      return renderStaffNewOrder(payload as StaffNewOrderTelegramData);
    case "order_cancelled_alert":
      return renderOrderCancelled(payload as OrderCancelledTelegramData);
    case "order_waiting_alert":
      return renderOrderWaiting(payload as OrderWaitingTelegramData);
    case "store_status_alert":
      return renderStoreStatus(payload as StoreStatusTelegramData);
    case "daily_sales_summary":
      return renderDailySalesSummary(payload as DailySalesSummaryTelegramData);
    default:
      throw new Error(`unknown telegram template key: ${templateKey}`);
  }
}

