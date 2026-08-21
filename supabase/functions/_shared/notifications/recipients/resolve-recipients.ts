import type { PlanningContext, RecipientSelector, RecipientType } from "../types.ts";
import { guardSendableEmail } from "./sendable-email.ts";

export interface ResolvedRecipient {
  recipientType: RecipientType;
  recipientId: string | null;
  address: string | null;
  skipReason: string | null;
}

/** Pure and synchronous by design: every fact a selector needs (the
 * customer, the resolved Telegram staff-group destination, ...) is already
 * sitting in the PlanningContext fetched once per event -- this function
 * never queries the database itself, so adding a recipient type never adds a
 * query-per-policy-rule.
 *
 * Returns 0..N recipients so one rule can fan out to many independent
 * deliveries (e.g. a future business_owners rule -> one delivery per owner).
 * customer/email/staff_group each resolve to exactly 0 or 1 today. */
export function resolveRecipients(
  selector: RecipientSelector,
  context: PlanningContext,
): ResolvedRecipient[] {
  switch (selector.type) {
    case "customer": {
      if (!context.customer) {
        return [{ recipientType: "customer", recipientId: null, address: null, skipReason: "no_email" }];
      }
      const guard = guardSendableEmail(context.customer.email);
      if (!guard.sendable) {
        return [{
          recipientType: "customer",
          recipientId: context.customer.id,
          address: null,
          skipReason: guard.reason,
        }];
      }
      return [{
        recipientType: "customer",
        recipientId: context.customer.id,
        address: guard.address,
        skipReason: null,
      }];
    }
    case "email": {
      const guard = guardSendableEmail(selector.address);
      if (!guard.sendable) {
        return [{ recipientType: "email", recipientId: null, address: null, skipReason: guard.reason }];
      }
      return [{ recipientType: "email", recipientId: null, address: guard.address, skipReason: null }];
    }
    case "staff_group": {
      const staffGroup = context.telegram.staffGroup;
      if (!staffGroup) {
        return [{
          recipientType: "staff_group",
          recipientId: null,
          address: null,
          skipReason: "telegram_staff_group_not_connected",
        }];
      }
      return [{
        recipientType: "staff_group",
        recipientId: null,
        address: staffGroup.chatId,
        skipReason: null,
      }];
    }
    case "business_owners": {
      const owners = context.telegram.businessOwners;
      if (owners.length === 0) {
        return [{
          recipientType: "business_owner",
          recipientId: null,
          address: null,
          skipReason: "telegram_no_owners_connected",
        }];
      }
      return owners.map((owner) => ({
        recipientType: "business_owner",
        recipientId: null,
        address: owner.chatId,
        skipReason: null,
      }));
    }
    case "business_user":
    case "location_admins":
      // Not implemented in v1. Fail loudly rather than silently no-op --
      // a policy rule referencing these would otherwise plan zero
      // deliveries with no observable error.
      throw new Error(`recipient selector "${selector.type}" is not implemented in v1`);
    default: {
      const exhaustive: never = selector;
      throw new Error(`unknown recipient selector: ${JSON.stringify(exhaustive)}`);
    }
  }
}
