// Channel-neutral shapes shared by every channel adapter (email, telegram,
// ...). The dispatcher's send loop only ever knows about these two types --
// it has no idea which channel it's talking to.

export interface DeliveryContext {
  deliveryId: string;
  recipientAddress: string;
  templateKey: string;
  payload: unknown;
}

export interface ChannelSendResult {
  outcome: "sent" | "retry" | "permanent_failure" | "skipped";
  error?: string;
  provider: string | null;
  providerMessageId?: string;
  /** Only meaningful when outcome is "skipped" -- becomes deliveries.skip_reason. */
  skipReason?: string;
}
