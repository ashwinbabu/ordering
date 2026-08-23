import { renderTelegramTemplate } from "./render.ts";
import { sendViaTelegram } from "./telegram-provider.ts";
import type { DispatcherConfig } from "../../config.ts";
import type { ChannelSendResult, DeliveryContext } from "../types.ts";

export async function sendTelegramDelivery(
  delivery: DeliveryContext,
  config: DispatcherConfig,
): Promise<ChannelSendResult> {
  const mode = config.notificationsTelegramMode;

  if (mode === "off") {
    return { outcome: "skipped", provider: "off", skipReason: "telegram_mode_off" };
  }

  let rendered;
  try {
    rendered = renderTelegramTemplate(delivery.templateKey, delivery.payload);
  } catch (error) {
    return {
      outcome: "permanent_failure",
      error: `template render failed: ${error instanceof Error ? error.message : String(error)}`,
      provider: null,
    };
  }

  if (mode === "log") {
    console.log(JSON.stringify({
      msg: "notification telegram message (log mode, not sent)",
      deliveryId: delivery.deliveryId,
      templateKey: delivery.templateKey,
      textLength: rendered.text.length,
    }));
    return { outcome: "sent", provider: "log", providerMessageId: "log-mode" };
  }

  if (!config.telegramBotToken) {
    return { outcome: "retry", error: "Telegram bot token is not configured", provider: "telegram" };
  }

  const result = await sendViaTelegram({
    botToken: config.telegramBotToken,
    chatId: delivery.recipientAddress,
    text: rendered.text,
    parseMode: rendered.parseMode,
    buttonUrl: rendered.buttonUrl,
  });

  if (result.outcome === "sent") {
    return { outcome: "sent", provider: "telegram", providerMessageId: result.providerMessageId };
  }
  return { outcome: result.outcome, error: result.error, provider: "telegram" };
}

