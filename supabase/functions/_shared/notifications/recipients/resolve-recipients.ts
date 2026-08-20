import type { RecipientSelector, RecipientType } from "../types.ts";
import { guardSendableEmail } from "./sendable-email.ts";

export interface ResolvedRecipient {
  recipientType: RecipientType;
  recipientId: string | null;
  address: string | null;
  skipReason: string | null;
}

export interface OrderContextCustomer {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** Recipient resolution happens server-side, here, from identifiers already
 * present in the order context -- never from anything the client sent. */
export function resolveRecipient(
  selector: RecipientSelector,
  context: { customer: OrderContextCustomer | null },
): ResolvedRecipient {
  switch (selector.type) {
    case "customer": {
      if (!context.customer) {
        return { recipientType: "customer", recipientId: null, address: null, skipReason: "no_email" };
      }
      const guard = guardSendableEmail(context.customer.email);
      if (!guard.sendable) {
        return {
          recipientType: "customer",
          recipientId: context.customer.id,
          address: null,
          skipReason: guard.reason,
        };
      }
      return {
        recipientType: "customer",
        recipientId: context.customer.id,
        address: guard.address,
        skipReason: null,
      };
    }
    case "email": {
      const guard = guardSendableEmail(selector.address);
      if (!guard.sendable) {
        return { recipientType: "email", recipientId: null, address: null, skipReason: guard.reason };
      }
      return { recipientType: "email", recipientId: null, address: guard.address, skipReason: null };
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
