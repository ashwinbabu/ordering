import { renderEmailTemplate } from "./render.ts";
import { sendViaResend } from "./resend-provider.ts";
import type { DispatcherConfig } from "../../config.ts";
import type { ChannelSendResult, DeliveryContext } from "../types.ts";

export type { ChannelSendResult } from "../types.ts";

function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Applies NOTIFICATIONS_EMAIL_MODE (off/log/redirect/live) and then sends
 * through the Resend adapter. This is the one place mode-dependent behaviour
 * lives -- the dispatcher loop calling this doesn't know or care which mode
 * is active. */
export async function sendEmailDelivery(
  delivery: DeliveryContext,
  config: DispatcherConfig,
): Promise<ChannelSendResult> {
  const mode = config.notificationsEmailMode;

  if (mode === "off") {
    return { outcome: "sent", provider: "off", providerMessageId: "off-mode" };
  }

  let rendered;
  try {
    rendered = await renderEmailTemplate(delivery.templateKey, delivery.payload);
  } catch (error) {
    return {
      outcome: "permanent_failure",
      error: `template render failed: ${error instanceof Error ? error.message : String(error)}`,
      provider: null,
    };
  }

  if (mode === "log") {
    console.log(JSON.stringify({
      msg: "notification email (log mode, not sent)",
      deliveryId: delivery.deliveryId,
      templateKey: delivery.templateKey,
      subject: rendered.subject,
      recipientDomain: delivery.recipientAddress.split("@")[1] ?? "unknown",
    }));
    return { outcome: "sent", provider: "log", providerMessageId: "log-mode" };
  }

  let actualRecipient = delivery.recipientAddress;
  let subject = rendered.subject;

  if (mode === "redirect") {
    if (!config.notificationsDevRecipient) {
      return {
        outcome: "permanent_failure",
        error: "redirect mode requires notifications_dev_recipient to be configured",
        provider: null,
      };
    }
    subject = `[dev → ${maskEmail(delivery.recipientAddress)}] ${rendered.subject}`;
    actualRecipient = config.notificationsDevRecipient;
  } else if (mode === "live") {
    if (config.notificationsEnvironment !== "production") {
      return {
        outcome: "permanent_failure",
        error: "live email mode refused: notifications_environment is not production",
        provider: null,
      };
    }
  }

  if (!config.resendApiKey) {
    return { outcome: "retry", error: "Resend API key is not configured", provider: "resend" };
  }

  const fromAddress = `${config.emailFromNameFallback} <${config.emailFromAddress}>`;

  const result = await sendViaResend({
    apiKey: config.resendApiKey,
    from: fromAddress,
    to: actualRecipient,
    subject,
    html: rendered.html,
    text: rendered.text,
    replyTo: config.emailReplyTo ?? undefined,
    idempotencyKey: delivery.deliveryId,
  });

  if (result.outcome === "sent") {
    return { outcome: "sent", provider: "resend", providerMessageId: result.providerMessageId };
  }
  return { outcome: result.outcome, error: result.error, provider: "resend" };
}
