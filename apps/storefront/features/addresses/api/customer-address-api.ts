import { getSupabaseClient } from "../../../lib/supabase/client";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";
import { resolveCustomerBusinessId } from "../../auth/api/customer-business-api";
import type { AddressLabel, DeliveryAddress } from "../../../domain/storefront";
import type { AddressDraft } from "../address-form";

// Re-exported so existing address call sites keep their import path; the
// lookup itself is owned by the auth feature now that the cart needs it too.
export { resolveCustomerBusinessId };

// core.customer_business_addresses rows are reachable directly: the table has
// an RLS select policy scoped to the owning customer, so a plain select is
// already safe. Writes go through the existing security-definer RPCs
// (create/update/delete/set_default_customer_business_address), which are the
// only granted write path -- the table itself has no write policy.
interface CustomerAddressRow {
  id: string;
  label: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  delivery_instructions: string | null;
  is_default: boolean | null;
}

const knownLabels: AddressLabel[] = ["Home", "Hotel", "Work", "Other"];

function readCoordinate(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The database stores a free-text label; the UI offers a fixed set plus a
 * custom name. Anything outside the fixed set round-trips through "Other" +
 * customLabel so an operator- or API-created label is never silently lost.
 */
function addressFromRow(row: CustomerAddressRow): DeliveryAddress {
  const storedLabel = row.label?.trim() ?? "";
  const matchedLabel = knownLabels.find(
    (label) => label.toLowerCase() === storedLabel.toLowerCase(),
  );

  return {
    id: row.id,
    label: matchedLabel ?? "Other",
    customLabel: matchedLabel || !storedLabel ? undefined : storedLabel,
    recipientName: row.recipient_name ?? "",
    recipientPhone: row.recipient_phone ?? "",
    line1: row.address_line_1 ?? "",
    line2: row.address_line_2 ?? "",
    locality: row.locality ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    landmark: row.landmark ?? "",
    instructions: row.delivery_instructions ?? "",
    isDefault: row.is_default ?? false,
    latitude: readCoordinate(row.latitude),
    longitude: readCoordinate(row.longitude),
  };
}

function labelForStorage(draft: AddressDraft) {
  return draft.label === "Other"
    ? draft.customLabel?.trim() || "Other"
    : draft.label;
}

export async function listCustomerAddresses(
  businessId: string,
  customerId: string,
): Promise<DeliveryAddress[]> {
  const result = await getSupabaseClient()
    .schema("core")
    .from("customer_business_addresses")
    .select(
      "id, label, recipient_name, recipient_phone, address_line_1, address_line_2, landmark, locality, city, state, postal_code, latitude, longitude, delivery_instructions, is_default",
    )
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (result.error) throw result.error;
  return (result.data as CustomerAddressRow[]).map(addressFromRow);
}

export async function createCustomerAddress(
  customerBusinessId: string,
  draft: AddressDraft,
): Promise<string> {
  const result = await callUntypedRpc(
    getSupabaseClient().schema("core"),
    "create_customer_business_address",
    {
      p_customer_business_id: customerBusinessId,
      p_label: labelForStorage(draft),
      p_recipient_name: draft.recipientName,
      p_recipient_phone: draft.recipientPhone,
      p_address_line_1: draft.line1,
      p_locality: draft.locality,
      p_city: draft.city,
      p_state: draft.state,
      p_latitude: draft.latitude ?? null,
      p_longitude: draft.longitude ?? null,
      p_address_line_2: draft.line2 || null,
      p_landmark: draft.landmark || null,
      p_postal_code: draft.postalCode || null,
      p_delivery_instructions: draft.instructions || null,
      p_is_default: draft.isDefault,
    },
  );
  if (result.error) throw result.error;
  return typeof result.data === "string" ? result.data : "";
}

export async function updateCustomerAddress(
  addressId: string,
  draft: AddressDraft,
): Promise<void> {
  const result = await callUntypedRpc(
    getSupabaseClient().schema("core"),
    "update_customer_business_address",
    {
      p_address_id: addressId,
      p_label: labelForStorage(draft),
      p_recipient_name: draft.recipientName,
      p_recipient_phone: draft.recipientPhone,
      p_address_line_1: draft.line1,
      p_locality: draft.locality,
      p_city: draft.city,
      p_state: draft.state,
      p_latitude: draft.latitude ?? null,
      p_longitude: draft.longitude ?? null,
      p_is_default: draft.isDefault,
      p_address_line_2: draft.line2 || null,
      p_landmark: draft.landmark || null,
      p_postal_code: draft.postalCode || null,
      p_delivery_instructions: draft.instructions || null,
    },
  );
  if (result.error) throw result.error;
}

export async function deleteCustomerAddress(addressId: string): Promise<void> {
  const result = await callUntypedRpc(
    getSupabaseClient().schema("core"),
    "delete_customer_business_address",
    {
      p_address_id: addressId,
    },
  );
  if (result.error) throw result.error;
}

export async function setDefaultCustomerAddress(
  customerBusinessId: string,
  addressId: string,
): Promise<void> {
  const result = await callUntypedRpc(
    getSupabaseClient().schema("core"),
    "set_default_customer_business_address",
    {
      p_customer_business_id: customerBusinessId,
      p_address_id: addressId,
    },
  );
  if (result.error) throw result.error;
}
