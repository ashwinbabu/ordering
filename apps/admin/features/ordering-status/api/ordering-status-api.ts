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
