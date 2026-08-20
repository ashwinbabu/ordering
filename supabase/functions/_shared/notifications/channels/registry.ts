import { sendEmailDelivery, type ChannelSendResult, type EmailDeliveryContext } from "./email/email-channel.ts";
import type { DispatcherConfig } from "../config.ts";

export type ChannelHandler = (
  delivery: EmailDeliveryContext,
  config: DispatcherConfig,
) => Promise<ChannelSendResult>;

// Extending to WhatsApp/SMS/push means adding a handler here with the same
// (delivery, config) => ChannelSendResult shape -- the dispatcher's send loop
// doesn't change.
export const CHANNEL_REGISTRY: Record<string, ChannelHandler> = {
  email: sendEmailDelivery,
};

export function getChannelHandler(channel: string): ChannelHandler {
  const handler = CHANNEL_REGISTRY[channel];
  if (!handler) {
    throw new Error(`no channel handler registered for "${channel}"`);
  }
  return handler;
}

export type { ChannelSendResult } from "./email/email-channel.ts";
