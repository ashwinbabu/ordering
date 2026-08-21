import { supabase } from "@/lib/supabase/client";

export interface TelegramConnectionStatus {
  botUsername: string | null;
  staffGroup: {
    connected: boolean;
    chatTitle?: string | null;
    connectedAt?: string | null;
  };
  myConnection: {
    connected: boolean;
    connectedAt?: string | null;
  };
}

export async function getTelegramConnectionStatus(
  businessId: string,
  locationId: string,
): Promise<TelegramConnectionStatus> {
  const { data, error } = await supabase.rpc(
    "notifications_get_telegram_connection_status",
    { p_business_id: businessId, p_location_id: locationId },
  );
  if (error) throw error;
  return data as unknown as TelegramConnectionStatus;
}

export interface TelegramPairingToken {
  token: string;
  expiresAt: string;
}

export async function createStaffGroupPairingToken(
  businessId: string,
  locationId: string,
): Promise<TelegramPairingToken> {
  const { data, error } = await supabase.rpc(
    "notifications_create_telegram_pairing_token",
    {
      p_destination_type: "staff_group",
      p_business_id: businessId,
      p_location_id: locationId,
    },
  );
  if (error) throw error;
  return data as unknown as TelegramPairingToken;
}

export interface BusinessNotificationPreferences {
  notifyOwnerOnCancellation: boolean;
}

export async function getBusinessNotificationPreferences(
  businessId: string,
): Promise<BusinessNotificationPreferences> {
  const { data, error } = await supabase.rpc(
    "notifications_get_business_preferences",
    { p_business_id: businessId },
  );
  if (error) throw error;
  return data as unknown as BusinessNotificationPreferences;
}

export async function setBusinessNotificationPreferences(
  businessId: string,
  notifyOwnerOnCancellation: boolean,
): Promise<BusinessNotificationPreferences> {
  const { data, error } = await supabase.rpc(
    "notifications_set_business_preferences",
    {
      p_business_id: businessId,
      p_notify_owner_on_cancellation: notifyOwnerOnCancellation,
    },
  );
  if (error) throw error;
  return data as unknown as BusinessNotificationPreferences;
}

/** No location_id: the RPC resolves the caller's own business_users row for
 * this business server-side, so this can never mint a link for someone
 * else's Telegram account. */
export async function createOwnerPairingToken(
  businessId: string,
): Promise<TelegramPairingToken> {
  const { data, error } = await supabase.rpc(
    "notifications_create_telegram_pairing_token",
    {
      p_destination_type: "business_user",
      p_business_id: businessId,
    },
  );
  if (error) throw error;
  return data as unknown as TelegramPairingToken;
}
