import * as React from "npm:react@19";
import { Html, Head, Preview, Body, Container, Section, Text, Hr, Link, Img } from "npm:@react-email/components@0.0.31";

export const colors = {
  bg: "#f5f5f4",
  card: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  border: "#e7e5e4",
  accent: "#b45309",
};

export function EmailLayout({
  previewText,
  businessName,
  logoUrl,
  children,
}: {
  previewText: string;
  businessName: string;
  logoUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: colors.bg,
          fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 32,
            maxWidth: 480,
            border: `1px solid ${colors.border}`,
          }}
        >
          <Section style={{ marginBottom: 24 }}>
            {logoUrl
              ? <Img src={logoUrl} alt={businessName} height={32} style={{ objectFit: "contain" }} />
              : (
                <Text style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: 0 }}>
                  {businessName}
                </Text>
              )}
          </Section>
          {children}
          <Hr style={{ borderColor: colors.border, margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 12, color: colors.muted, margin: 0 }}>
            This is a transactional email about your order at {businessName}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: colors.accent,
        color: "#ffffff",
        padding: "12px 24px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

