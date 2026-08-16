import { supabase } from "@/lib/supabase/client";

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

export async function getOrderingStatus(locationId: string) {
  const { data, error } = await supabase
    .schema("ordering")
    .from("restaurant_settings")
    .select("ordering_enabled")
    .eq("location_id", locationId)
    .single();
  throwIfError(error);
  if (!data)
    throw new Error("Ordering status is not configured for this outlet.");
  return data.ordering_enabled;
}

export async function setOrderingStatus(
  locationId: string,
  orderingEnabled: boolean,
) {
  const { data, error } = await supabase
    .schema("ordering")
    .from("restaurant_settings")
    .update({ ordering_enabled: orderingEnabled })
    .eq("location_id", locationId)
    .select("ordering_enabled")
    .single();
  throwIfError(error);
  if (!data)
    throw new Error("Ordering status could not be updated for this outlet.");
  return data.ordering_enabled;
}

export interface TodayOpeningHours {
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

/** ISO day-of-week (1=Mon..7=Sun) for the outlet's configured opening hours. */
function isoDayOfWeek(date: Date) {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export async function getTodayOpeningHours(
  locationId: string,
): Promise<TodayOpeningHours | null> {
  const { data, error } = await supabase
    .schema("ordering")
    .from("opening_hours")
    .select("is_closed, opens_at, closes_at")
    .eq("location_id", locationId)
    .eq("day_of_week", isoDayOfWeek(new Date()))
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return {
    isClosed: data.is_closed,
    opensAt: data.opens_at,
    closesAt: data.closes_at,
  };
}
