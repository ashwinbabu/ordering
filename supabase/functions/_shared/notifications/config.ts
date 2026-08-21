import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type NotificationsEmailMode = "off" | "log" | "redirect" | "live";
export type NotificationsTelegramMode = "off" | "log" | "live";
export type NotificationsEnvironment = "development" | "production";

export interface DispatcherConfig {
  emailProvider: string;
  emailFromAddress: string;
  emailFromNameFallback: string;
  emailReplyTo: string | null;
  notificationsEmailMode: NotificationsEmailMode;
  notificationsDevRecipient: string | null;
  notificationsEnvironment: NotificationsEnvironment;
  devDefaultStorefrontUrl: string | null;
  resendApiKey: string | null;
  dispatcherAuthSecret: string | null;
  telegramBotToken: string | null;
  notificationsTelegramMode: NotificationsTelegramMode;
}

/** Reads notifications.settings (+ decrypted Vault secrets) via the
 * service-role-only RPC. This is the single source of truth for dispatcher
 * config -- there are no Edge Function secret env vars for this system, by
 * design (see the "Dispatcher configuration" section of the final report). */
export async function loadDispatcherConfig(adminClient: SupabaseClient): Promise<DispatcherConfig> {
  const { data, error } = await adminClient.rpc("notifications_get_dispatcher_config");
  if (error) {
    throw new Error(`failed to load notification dispatcher config: ${error.message}`);
  }
  const raw = data as Record<string, unknown>;
  return {
    emailProvider: String(raw.emailProvider ?? "resend"),
    emailFromAddress: String(raw.emailFromAddress ?? ""),
    emailFromNameFallback: String(raw.emailFromNameFallback ?? ""),
    emailReplyTo: (raw.emailReplyTo as string | null) ?? null,
    notificationsEmailMode: (raw.notificationsEmailMode as NotificationsEmailMode) ?? "off",
    notificationsDevRecipient: (raw.notificationsDevRecipient as string | null) ?? null,
    notificationsEnvironment: (raw.notificationsEnvironment as NotificationsEnvironment) ?? "development",
    devDefaultStorefrontUrl: (raw.devDefaultStorefrontUrl as string | null) ?? null,
    resendApiKey: (raw.resendApiKey as string | null) ?? null,
    dispatcherAuthSecret: (raw.dispatcherAuthSecret as string | null) ?? null,
    telegramBotToken: (raw.telegramBotToken as string | null) ?? null,
    notificationsTelegramMode: (raw.notificationsTelegramMode as NotificationsTelegramMode) ?? "off",
  };
}
