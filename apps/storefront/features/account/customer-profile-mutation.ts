import { useMutation } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase/client";
import { callUntypedRpc } from "../../lib/supabase/untyped-rpc";
import {
  readNullableString,
  readRecord,
  readString,
} from "../../lib/supabase/json-parsing";

export interface UpdatedCustomerProfile {
  id: string;
  displayName: string;
  email: string | null;
}

/**
 * Persists the signed-in customer's own name and email via
 * core.update_customer_profile. Phone number is deliberately not editable
 * here -- it is owned by the auth trigger, and changing it is an
 * identity change that has to go back through OTP verification.
 */
export async function updateCustomerProfile(
  displayName: string,
  email: string | null,
): Promise<UpdatedCustomerProfile> {
  const result = await callUntypedRpc(
    getSupabaseClient().schema("core"),
    "update_customer_profile",
    {
      p_display_name: displayName,
      p_email: email,
    },
  );
  if (result.error) throw result.error;

  const profile = readRecord(
    result.data as never,
    "The updated customer profile",
  );
  return {
    id: readString(profile.id, "The customer ID"),
    displayName:
      readNullableString(profile.display_name, "The customer display name") ??
      "",
    email: readNullableString(profile.email, "The customer email"),
  };
}

export function useUpdateCustomerProfileMutation() {
  return useMutation({
    mutationFn: (args: { displayName: string; email: string | null }) =>
      updateCustomerProfile(args.displayName, args.email),
    retry: false,
  });
}
