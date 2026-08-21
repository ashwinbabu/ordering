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
];

export function policyRulesForEvent(eventType: string): PolicyRule[] {
  return NOTIFICATION_POLICY.filter((rule) => rule.event === eventType);
}
