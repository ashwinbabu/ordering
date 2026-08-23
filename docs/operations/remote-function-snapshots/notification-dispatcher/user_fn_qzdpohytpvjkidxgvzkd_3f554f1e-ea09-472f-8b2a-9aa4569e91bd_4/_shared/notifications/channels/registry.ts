import { sendEmailDelivery } from "./email/email-channel.ts";
import { sendTelegramDelivery } from "./telegram/telegram-channel.ts";
import type { ChannelSendResult, DeliveryContext } from "./types.ts";
import type { DispatcherConfig } from "../config.ts";

export type ChannelHandler = (
  delivery: DeliveryContext,
  config: DispatcherConfig,
) => Promise<ChannelSendResult>;

export const CHANNEL_REGISTRY: Record<string, ChannelHandler> = {
  email: sendEmailDelivery,
  telegram: sendTelegramDelivery,
};

export function getChannelHandler(channel: string): ChannelHandler {
  const handler = CHANNEL_REGISTRY[channel];
  if (!handler) {
    throw new Error(`no channel handler registered for "${channel}"`);
  }
  return handler;
}

export type { ChannelSendResult } from "./types.ts";

