import * as React from "npm:react@19";
import { Section, Text } from "npm:@react-email/components@0.0.31";
import { EmailLayout, colors, PrimaryButton } from "./components/layout.tsx";
import { formatMoney } from "../../money.ts";
import type { OrderCancelledEmailData } from "./template-data.ts";

export function buildOrderCancelledSubject(data: OrderCancelledEmailData): string {
  return `Order cancelled · ${data.business.name}`;
}

function headlineFor(actorType: OrderCancelledEmailData["cancelledByActorType"], businessName: string): string {
  switch (actorType) {
    case "customer":
      return "Your order has been cancelled, as requested.";
    case "admin":
    case "telegram":
      return `${businessName} had to cancel your order.`;
    case "system":
    default:
      return "Your order has been cancelled.";
  }
}

function formatCancelledTime(iso: string | null, timezone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })
      .format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CustomerOrderCancelledEmail(data: OrderCancelledEmailData) {
  const greeting = data.customerFirstName ? `Hi ${data.customerFirstName},` : "Hi there,";

  return (
    <EmailLayout
      previewText={`Order ${data.orderNumber} was cancelled · ${data.business.name}`}
      businessName={data.business.name}
      logoUrl={data.business.logoUrl}
    >
      <Text style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
        Order cancelled
      </Text>
      <Text style={{ fontSize: 14, color: colors.text, margin: "0 0 16px" }}>
        {greeting} {headlineFor(data.cancelledByActorType, data.business.name)}
      </Text>

      <Section style={{ backgroundColor: "#fafaf9", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>Order number</Text>
        <Text style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: "0 0 12px" }}>
          {data.orderNumber}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>{data.location.name}</Text>
        {data.cancelledAtIso && (
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            Cancelled {formatCancelledTime(data.cancelledAtIso, data.timezone)}
          </Text>
        )}
        <Text style={{ fontSize: 12, color: colors.muted, margin: "8px 0 0" }}>
          Order total: {formatMoney(data.grandTotal, data.currency)}
        </Text>
      </Section>

      {data.cancelReason && (
        <Text style={{ fontSize: 13, color: colors.text, margin: "0 0 16px" }}>
          Reason: {data.cancelReason}
        </Text>
      )}

      <Text style={{ fontSize: 13, color: colors.text, margin: "0 0 16px" }}>
        {data.refundMessage}
      </Text>

      {data.orderUrl && (
        <Section style={{ marginTop: 8 }}>
          <PrimaryButton href={data.orderUrl}>View order</PrimaryButton>
        </Section>
      )}

      {data.location.phone && (
        <Text style={{ fontSize: 12, color: colors.muted, margin: "16px 0 0" }}>
          Questions? Call {data.location.name} at {data.location.phone}.
        </Text>
      )}
    </EmailLayout>
  );
}
