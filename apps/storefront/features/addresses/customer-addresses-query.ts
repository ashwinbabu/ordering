import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  listCustomerAddresses,
  resolveCustomerBusinessId,
  updateCustomerAddress,
} from "./api/customer-address-api";
import type { AddressDraft } from "./address-form";
import { storefrontContext, type StorefrontContext } from "../../lib/storefront/storefront-context";

export function customerAddressesQueryKey(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return ["storefront", "customer-addresses", context.businessId, customerId] as const;
}

/**
 * Saved addresses are per (customer, business). With no signed-in customer the
 * query stays disabled and the screens fall back to their empty state rather
 * than erroring -- an anonymous browser legitimately has no saved addresses.
 */
export function useCustomerAddressesQuery(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return useQuery({
    queryKey: customerAddressesQueryKey(customerId, context),
    queryFn: () => listCustomerAddresses(context.businessId, customerId!),
    enabled: Boolean(customerId),
    staleTime: 60_000,
    retry: false,
  });
}

function useAddressMutation<TArgs, TResult>(
  customerId: string | null,
  context: StorefrontContext,
  run: (args: TArgs, customerBusinessId: string) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      if (!customerId) throw new Error("Sign in to manage your saved addresses.");
      const customerBusinessId = await resolveCustomerBusinessId(context.businessId, customerId);
      return run(args, customerBusinessId);
    },
    // The write RPCs return only an id, and setting a new default clears the
    // flag on sibling rows server-side, so refetching the list is the only way
    // to stay consistent with what the database actually holds.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerAddressesQueryKey(customerId, context), exact: true }),
    retry: false,
  });
}

export function useSaveCustomerAddressMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return useAddressMutation<{ draft: AddressDraft; addressId?: string }, string>(
    customerId,
    context,
    async ({ draft, addressId }, customerBusinessId) => {
      if (addressId) {
        await updateCustomerAddress(addressId, draft);
        return addressId;
      }
      return createCustomerAddress(customerBusinessId, draft);
    },
  );
}

export function useDeleteCustomerAddressMutation(customerId: string | null, context: StorefrontContext = storefrontContext) {
  return useAddressMutation<{ addressId: string }, void>(
    customerId,
    context,
    ({ addressId }) => deleteCustomerAddress(addressId),
  );
}
