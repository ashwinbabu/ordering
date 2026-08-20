import type { DomainEventType } from "../types.ts";

/** The only event types the v1 capture trigger produces. Extending this list
 * requires a matching change in the trigger's CHECK constraint and mapping
 * logic (private.capture_notification_event_from_order_event) -- this array
 * exists so application code has one place to validate against. */
export const KNOWN_DOMAIN_EVENT_TYPES: readonly DomainEventType[] = [
  "order.placed",
  "order.cancelled",
];

export function isKnownDomainEventType(value: string): value is DomainEventType {
  return (KNOWN_DOMAIN_EVENT_TYPES as readonly string[]).includes(value);
}
