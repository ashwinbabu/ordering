// Shared types for the v1 notification system. Kept deliberately small: only
// order.placed / order.cancelled exist today, but the shapes below (event
// type, recipient selector, policy rule, delivery spec) are what future
// events/recipients/channels plug into without changing this file's shape.

export type DomainEventType =
  | "order.placed"
  | "order.cancelled"
  | "order.waiting_3m"
  | "order.waiting_8m"
  | "store.paused"
  | "store.resumed"
  | "sales.daily_summary";

export type OrderActorType = "customer" | "admin" | "telegram" | "system";

/** Mirrors the jsonb payload written by private.capture_notification_event_from_order_event.
 * Only order-entity events use this shape; location-entity events (store.*,
 * sales.daily_summary) carry a much smaller payload (see NotificationEventRow.payload). */
export interface OrderDomainEventPayload {
  schemaVersion: 1;
  orderId: string;
  customerId: string | null;
  actorType: OrderActorType;
  fromStatus: string | null;
  toStatus: string;
}

/** One row from notifications.events, as returned by notifications_claim_events.
 * payload is intentionally loose: its shape depends on entity_type (order vs
 * location), and the dispatcher is the only place that needs to know that. */
export interface NotificationEventRow {
  id: string;
  event_type: DomainEventType;
  entity_type: "order" | "location";
  entity_id: string;
  business_id: string;
  location_id: string | null;
  source_event_id: string | null;
  dedupe_key: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
}

/** One row from notifications.deliveries, as returned by notifications_claim_deliveries. */
export interface NotificationDeliveryRow {
  id: string;
  event_id: string;
  business_id: string;
  location_id: string | null;
  channel: string;
  template_key: string;
  recipient_type: string;
  recipient_id: string | null;
  recipient_address: string | null;
  locale: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
}

export type RecipientSelector =
  | { type: "customer" }
  | { type: "business_user"; userId: string }
  | { type: "location_admins" }
  | { type: "email"; address: string }
  | { type: "staff_group" }
  // Designed now, not implemented: resolveRecipients throws for this selector
  // (same precedent as business_user/location_admins below) until a policy
  // rule actually uses it. Kept here so the fan-out shape (0..N recipients)
  // and the policy rule table are ready for it.
  | { type: "business_owners" };

export interface PolicyRule {
  event: DomainEventType;
  recipient: RecipientSelector;
  channel: "email" | "telegram";
  template: string;
}

export type RecipientType =
  | "customer"
  | "business_user"
  | "location_admins"
  | "email"
  | "staff_group"
  | "business_owner";

/** What gets handed to notifications_plan_event for one recipient/channel. */
export interface DeliverySpec {
  channel: string;
  templateKey: string;
  recipientType: RecipientType;
  recipientId: string | null;
  recipientAddress: string | null;
  locale: string;
  payload: Record<string, unknown>;
  status: "pending" | "skipped";
  skipReason: string | null;
}

export type DeliveryOutcome = "sent" | "retry" | "permanent_failure" | "skipped";

/** The narrow, typed slice of notifications_get_order_context that recipient
 * resolution is allowed to see -- deliberately NOT the same as the loose
 * template-data blob. Extending this (e.g. for business_owners later) means
 * adding a field here and to the order-context RPC, never coupling recipient
 * resolution to a specific channel's template payload shape. */
export interface PlanningContext {
  customer: { id: string; email: string | null; displayName: string | null } | null;
  telegram: {
    staffGroup: { chatId: string; chatTitle: string | null } | null;
    businessOwners: { chatId: string }[];
  };
  preferences: {
    notifyOwnerOnCancellation: boolean;
  };
}
