import { useNavigate, useOutletContext } from "react-router";
import { AccountScreen } from "../../features/account/account-screen";
import { useCustomerSession } from "../../features/auth/customer-session";
import type { StorefrontLayoutContext } from "../storefront-layout";

/** `/account` -- gated by RequireCustomer, so `customer` is always present here. */
export function AccountRoute() {
  const { openAuth, savedAddresses, venue } =
    useOutletContext<StorefrontLayoutContext>();
  const customerSession = useCustomerSession();
  const customer = customerSession.customer!;
  const navigate = useNavigate();

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
          phone: { countryCode: customer.countryCode, phone: customer.phone },
          onSuccess: () => {},
        })
      }
      onSaveCustomer={customerSession.updateLocalProfile}
      onSignOut={() => {
        void customerSession.signOut();
        navigate("/");
      }}
      venue={venue}
    />
  );
}
