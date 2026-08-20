// Shared types for the v1 notification system. Kept deliberately small: only
// order.placed / order.cancelled exist today, but the shapes below (event
// type, recipient selector, policy rule, delivery spec) are what future
// events/recipients/channels plug into without changing this file's shape.

export type DomainEventType = "order.placed" | "order.cancelled";

export type OrderActorType = "customer" | "admin" | "telegram" | "system";

/** Mirrors the jsonb payload written by private.capture_notification_event_from_order_event. */
export interface OrderDomainEventPayload {
  schemaVersion: 1;
  orderId: string;
  customerId: string | null;
  actorType: OrderActorType;
  fromStatus: string | null;
  toStatus: string;
}

/** One row from notifications.events, as returned by notifications_claim_events. */
export interface NotificationEventRow {
  id: string;
  event_type: DomainEventType;
  entity_type: "order";
  entity_id: string;
  business_id: string;
  location_id: string | null;
  source_event_id: string | null;
  dedupe_key: string;
  occurred_at: string;
  payload: OrderDomainEventPayload;
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
  | { type: "email"; address: string };

export interface PolicyRule {
  event: DomainEventType;
  recipient: RecipientSelector;
  channel: "email";
  template: string;
}

export type RecipientType = "customer" | "business_user" | "location_admins" | "email";

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

export type DeliveryOutcome = "sent" | "retry" | "permanent_failure";
