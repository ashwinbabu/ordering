import { useNavigate, useOutletContext } from "react-router";
import { SavedAddressesScreen } from "../../features/addresses/saved-addresses-screen";
import type { StorefrontLayoutContext } from "../storefront-layout";

/** `/your-addresses` -- reuses the existing address fetching/editing logic from the layout, unchanged. */
export function AddressesRoute() {
  const {
    customerAddressesResource,
    removeAddress,
    saveAddress,
    savedAddresses,
    venue,
  } = useOutletContext<StorefrontLayoutContext>();
  const navigate = useNavigate();

  return (
    <SavedAddressesScreen
      addresses={savedAddresses}
      onBack={() => navigate("/account")}
      onDelete={removeAddress}
      onRetry={customerAddressesResource.refetch}
      onSave={saveAddress}
      state={
        customerAddressesResource.isPending
          ? "loading"
          : customerAddressesResource.isError
            ? "error"
            : "ready"
      }
      venue={venue}
    />
  );
}
