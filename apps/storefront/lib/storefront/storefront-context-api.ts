import type { Json } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/client";
import { callUntypedRpc } from "../supabase/untyped-rpc";
import { readRecord, readString } from "../supabase/json-parsing";
import type { StorefrontContext } from "./storefront-context";

/**
 * Resolves a hostname to exactly one business/location via
 * ordering.resolve_storefront_context. A null result means the hostname has
 * no active storefront -- there is no fallback, by design.
 */
export async function resolveStorefrontContext(
  hostname: string,
): Promise<StorefrontContext | null> {
  const client = getSupabaseClient().schema("ordering");
  const result = await callUntypedRpc(client, "resolve_storefront_context", {
    p_hostname: hostname,
  });
  if (result.error) throw result.error;
  if (result.data === null) return null;

  const context = readRecord(
    result.data as Json,
    "The storefront context response",
  );
  return {
    businessId: readString(
      context.businessId,
      "The storefront context business ID",
    ),
    locationId: readString(
      context.locationId,
      "The storefront context location ID",
    ),
    businessName: readString(
      context.businessName,
      "The storefront context business name",
    ),
    locationName: readString(
      context.locationName,
      "The storefront context location name",
    ),
  };
}
