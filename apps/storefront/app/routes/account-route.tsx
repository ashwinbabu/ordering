import { useNavigate, useOutletContext } from "react-router";
import { AccountScreen } from "../../features/account/account-screen";
import { useCustomerSession } from "../../features/auth/customer-session";
import { useUpdateCustomerProfileMutation } from "../../features/account/customer-profile-mutation";
import { normalizePhoneInput } from "../../domain/phone";
import type { StorefrontLayoutContext } from "../storefront-layout";

/** `/account` -- gated by RequireCustomer, so `customer` is always present here. */
export function AccountRoute() {
  const { openAuth, savedAddresses, venue } =
    useOutletContext<StorefrontLayoutContext>();
  const customerSession = useCustomerSession();
  const customer = customerSession.customer!;
  const navigate = useNavigate();
  const updateCustomerProfile = useUpdateCustomerProfileMutation();

  return (
    <AccountScreen
      addressCount={savedAddresses.length}
      customer={customer}
      onBack={() => navigate("/")}
      onOpenAddresses={() => navigate("/your-addresses")}
      onOpenOrders={() => navigate("/orders")}
      onRequestPhoneChange={() =>
        openAuth({
          context: "account",
          initialStep: "phone",
          phone: normalizePhoneInput(customer.phone, customer.countryIso2),
          onSuccess: () => {},
        })
      }
      onSaveCustomer={async ({ name, email }) => {
        const updated = await updateCustomerProfile.mutateAsync({
          displayName: name,
          email: email ?? null,
        });
        customerSession.applyPersistedProfile({
          name: updated.displayName,
          email: updated.email ?? undefined,
        });
      }}
      onSignOut={() => {
        void customerSession.signOut();
        navigate("/");
      }}
      venue={venue}
    />
  );
}
