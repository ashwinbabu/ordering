import * as React from "npm:react@19";
import { Column, Hr, Row, Section, Text } from "npm:@react-email/components@0.0.31";
import { EmailLayout, colors, PrimaryButton } from "./components/layout.tsx";
import { formatMoney, isPositiveAmount } from "../../money.ts";
import type { OrderPlacedEmailData } from "./template-data.ts";

export function buildOrderPlacedSubject(data: OrderPlacedEmailData): string {
  return `Order confirmed · ${data.business.name}`;
}

function formatPlacedTime(iso: string | null, timezone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })
      .format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CustomerOrderPlacedEmail(data: OrderPlacedEmailData) {
  const greeting = data.customerFirstName ? `Hi ${data.customerFirstName},` : "Hi there,";
  const isDelivery = data.fulfillmentType === "delivery";

  return (
    <EmailLayout
      previewText={`Order ${data.orderNumber} · ${formatMoney(data.grandTotal, data.currency)} · ${data.business.name}`}
      businessName={data.business.name}
      logoUrl={data.business.logoUrl}
    >
      <Text style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 8px" }}>
        Order confirmed
      </Text>
      <Text style={{ fontSize: 14, color: colors.text, margin: "0 0 16px" }}>
        {greeting} your order at {data.business.name} has been confirmed.
      </Text>

      <Section style={{ backgroundColor: "#fafaf9", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>Order number</Text>
        <Text style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: "0 0 12px" }}>
          {data.orderNumber}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
          {isDelivery ? "Delivery" : "Pickup"} · {data.location.name}
        </Text>
        {data.placedAtIso && (
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            Placed {formatPlacedTime(data.placedAtIso, data.timezone)}
          </Text>
        )}
        {data.estimatedDeliveryMinutes != null && (
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            Estimated {isDelivery ? "delivery" : "ready"} time: ~{data.estimatedDeliveryMinutes} min
          </Text>
        )}
        {isDelivery && data.deliveryAddressLine && (
          <Text style={{ fontSize: 12, color: colors.muted, margin: "8px 0 0" }}>
            Delivering to: {data.deliveryAddressLine}
          </Text>
        )}
        {isDelivery && data.deliveryInstructions && (
          <Text style={{ fontSize: 12, color: colors.muted, margin: "4px 0 0" }}>
            Delivery note: {data.deliveryInstructions}
          </Text>
        )}
      </Section>

      <Text style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: "0 0 8px" }}>Items</Text>
      {data.items.map((item, index) => (
        <Row key={index} style={{ marginBottom: 8 }}>
          <Column>
            <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
              {item.quantity}× {item.productName}
            </Text>
            {item.options.length > 0 && (
              <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
                {item.options.map((opt) => opt.optionName).join(", ")}
              </Text>
            )}
          </Column>
          <Column align="right">
            <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
              {formatMoney(item.lineTotal, data.currency)}
            </Text>
          </Column>
        </Row>
      ))}

      <Hr style={{ borderColor: colors.border, margin: "16px 0" }} />

      <Row>
        <Column><Text style={{ fontSize: 13, color: colors.muted, margin: 0 }}>Subtotal</Text></Column>
        <Column align="right">
          <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
            {formatMoney(data.foodSubtotal, data.currency)}
          </Text>
        </Column>
      </Row>
      {isPositiveAmount(data.discountTotal) && (
        <Row>
          <Column><Text style={{ fontSize: 13, color: colors.muted, margin: 0 }}>Discount</Text></Column>
          <Column align="right">
            <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
              −{formatMoney(data.discountTotal, data.currency)}
            </Text>
          </Column>
        </Row>
      )}
      <Row>
        <Column><Text style={{ fontSize: 13, color: colors.muted, margin: 0 }}>Tax</Text></Column>
        <Column align="right">
          <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
            {formatMoney(data.taxTotal, data.currency)}
          </Text>
        </Column>
      </Row>
      {isDelivery && (
        <Row>
          <Column><Text style={{ fontSize: 13, color: colors.muted, margin: 0 }}>Delivery fee</Text></Column>
          <Column align="right">
            <Text style={{ fontSize: 13, color: colors.text, margin: 0 }}>
              {formatMoney(data.deliveryFee, data.currency)}
            </Text>
          </Column>
        </Row>
      )}
      <Row style={{ marginTop: 8 }}>
        <Column><Text style={{ fontSize: 15, fontWeight: 700, color: colors.text, margin: 0 }}>Total</Text></Column>
        <Column align="right">
          <Text style={{ fontSize: 15, fontWeight: 700, color: colors.text, margin: 0 }}>
            {formatMoney(data.grandTotal, data.currency)}
          </Text>
        </Column>
      </Row>

      <Text style={{ fontSize: 12, color: colors.muted, margin: "16px 0 0" }}>
        Payment: {data.paymentMethod === "cash" ? "Cash on delivery/pickup" : `Online · ${data.paymentStatus}`}
      </Text>

      {data.customerNote && (
        <Text style={{ fontSize: 12, color: colors.muted, margin: "8px 0 0" }}>
          Note to restaurant: {data.customerNote}
        </Text>
      )}

      {data.orderUrl && (
        <Section style={{ marginTop: 24 }}>
          <PrimaryButton href={data.orderUrl}>Track order</PrimaryButton>
        </Section>
      )}

      {data.location.phone && (
        <Text style={{ fontSize: 12, color: colors.muted, margin: "16px 0 0" }}>
          Questions about your order? Call {data.location.name} at {data.location.phone}.
        </Text>
      )}
    </EmailLayout>
  );
}

