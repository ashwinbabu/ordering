import { getSupabaseClient } from "../../../lib/supabase/client";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";

/**
 * Resolves this customer's link row for the active business. Several RPCs key
 * off customer_business_id rather than customer_id -- the address writes and
 * ordering.attach_anonymous_cart -- and
 * core.record_customer_business_visit upserts the link and returns its id, so
 * it doubles as "ensure the link exists" for a customer who has never ordered
 * from this outlet before.
 *
 * Owned by the auth feature rather than any one consumer: both addresses and
 * the cart need it, and neither should import from the other.
 */
export async function resolveCustomerBusinessId(
  businessId: string,
  customerId: string,
): Promise<string> {
  const client = getSupabaseClient();
  const existing = await client
    .schema("core")
    .from("customer_businesses")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return (existing.data as { id: string }).id;

  const created = await callUntypedRpc(
    client.schema("core"),
    "record_customer_business_visit",
    {
      p_business_id: businessId,
      p_customer_id: customerId,
    },
  );
  if (created.error) throw created.error;
  if (typeof created.data !== "string")
    throw new Error("Could not link your account to this restaurant.");
  return created.data;
}
