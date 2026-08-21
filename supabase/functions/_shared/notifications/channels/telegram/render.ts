import type { StaffNewOrderTelegramData } from "../../templates/telegram/template-data.ts";

export interface RenderedTelegramMessage {
  text: string;
  parseMode: "HTML";
  /** Inline "Open order" button, only present when a real admin route could
   * be resolved. Omitted entirely otherwise -- never a wrong-tenant link. */
  buttonUrl: string | null;
}

// Telegram HTML mode only requires escaping these three characters; unlike
// MarkdownV2 there's no long list of punctuation that breaks parsing, which
// is why HTML was picked over MarkdownV2 for this dynamic, restaurant-authored
// content (item names, business names, customer notes all pass through raw).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderStaffNewOrder(data: StaffNewOrderTelegramData): RenderedTelegramMessage {
  const isDelivery = data.fulfillmentType === "delivery";
  const lines: string[] = [];

  lines.push(`🛎 <b>New order</b> · ${escapeHtml(data.businessName)}`);
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

export function renderTelegramTemplate(templateKey: string, payload: unknown): RenderedTelegramMessage {
  switch (templateKey) {
    case "staff_new_order":
      return renderStaffNewOrder(payload as StaffNewOrderTelegramData);
    default:
      throw new Error(`unknown telegram template key: ${templateKey}`);
  }
}
