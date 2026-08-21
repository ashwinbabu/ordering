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
