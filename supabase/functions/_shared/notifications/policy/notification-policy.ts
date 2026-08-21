import type { PolicyRule } from "../types.ts";

// The entire v1 notification behaviour, in one place. Adding a new
// destination for an existing event (e.g. order.placed -> location admins)
// means adding a rule here, resolving its recipient type in
// recipients/resolve-recipients.ts, and adding a template -- never touching
// order placement/cancellation code.
export const NOTIFICATION_POLICY: readonly PolicyRule[] = [
  {
    event: "order.placed",
    recipient: { type: "customer" },
    channel: "email",
    template: "customer_order_placed",
  },
  {
    event: "order.cancelled",
    recipient: { type: "customer" },
    channel: "email",
    template: "customer_order_cancelled",
  },
  {
    event: "order.placed",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "staff_new_order",
  },
  {
    event: "order.cancelled",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "order_cancelled_alert",
  },
  {
    event: "order.cancelled",
    recipient: { type: "business_owners" },
    channel: "telegram",
    template: "order_cancelled_alert",
  },
  {
    event: "order.waiting_3m",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "order_waiting_alert",
  },
  {
    event: "order.waiting_8m",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "order_waiting_alert",
  },
  {
    event: "order.waiting_8m",
    recipient: { type: "business_owners" },
    channel: "telegram",
    template: "order_waiting_alert",
  },
  {
    event: "store.paused",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "store_status_alert",
  },
  {
    event: "store.paused",
    recipient: { type: "business_owners" },
    channel: "telegram",
    template: "store_status_alert",
  },
  {
    event: "store.resumed",
    recipient: { type: "staff_group" },
    channel: "telegram",
    template: "store_status_alert",
  },
  {
    event: "store.resumed",
    recipient: { type: "business_owners" },
    channel: "telegram",
    template: "store_status_alert",
  },
  {
    event: "sales.daily_summary",
    recipient: { type: "business_owners" },
    channel: "telegram",
    template: "daily_sales_summary",
  },
];

export interface PolicyContext {
  /** Only order.cancelled's business_owners rule is conditional today -- see
   * notifications.business_preferences. Every other rule in the matrix is
   * unconditional, so this is deliberately a single narrow flag rather than
   * a generic per-rule config mechanism. */
  notifyOwnerOnCancellation: boolean;
}

export function policyRulesForEvent(eventType: string, context: PolicyContext): PolicyRule[] {
  return NOTIFICATION_POLICY.filter((rule) => {
    if (rule.event !== eventType) return false;
    if (
      rule.event === "order.cancelled" &&
      rule.recipient.type === "business_owners" &&
      !context.notifyOwnerOnCancellation
    ) {
      return false;
    }
    return true;
  });
}
