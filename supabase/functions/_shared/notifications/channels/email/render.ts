import { render as renderReactEmail } from "npm:@react-email/render@1.0.6";
import {
  buildOrderCancelledSubject,
  CustomerOrderCancelledEmail,
} from "../../templates/email/customer-order-cancelled.tsx";
import {
  buildOrderPlacedSubject,
  CustomerOrderPlacedEmail,
} from "../../templates/email/customer-order-placed.tsx";
import type { OrderCancelledEmailData, OrderPlacedEmailData } from "../../templates/email/template-data.ts";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Template-key dispatch. Adding a template means adding one case here plus
// the .tsx file + policy rule -- nothing else in the dispatcher changes.
export async function renderEmailTemplate(templateKey: string, payload: unknown): Promise<RenderedEmail> {
  switch (templateKey) {
    case "customer_order_placed": {
      const data = payload as OrderPlacedEmailData;
      const element = CustomerOrderPlacedEmail(data);
      const [html, text] = await Promise.all([
        renderReactEmail(element),
        renderReactEmail(element, { plainText: true }),
      ]);
      return { subject: buildOrderPlacedSubject(data), html, text };
    }
    case "customer_order_cancelled": {
      const data = payload as OrderCancelledEmailData;
      const element = CustomerOrderCancelledEmail(data);
      const [html, text] = await Promise.all([
        renderReactEmail(element),
        renderReactEmail(element, { plainText: true }),
      ]);
      return { subject: buildOrderCancelledSubject(data), html, text };
    }
    default:
      throw new Error(`unknown email template key: ${templateKey}`);
  }
}
