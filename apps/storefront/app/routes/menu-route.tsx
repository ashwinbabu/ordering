import { useNavigate, useOutletContext } from "react-router";
import { useCustomerSession } from "../../features/auth/customer-session";
import { MenuScreen } from "../../features/menu/menu-screen";
import { VenueFooter } from "../../features/venue/venue-footer";
import { VenueHeader } from "../../features/venue/venue-header";
import type { StorefrontLayoutContext } from "../storefront-layout";

/** `/` -- the main storefront/menu screen. Unchanged from before routing; only navigation moved to the router. */
export function MenuRoute() {
  const {
    cartItemCount,
    cartQuantities,
    cartTotal,
    menu,
    openAuth,
    openProductConfiguration,
    adjustConfigurableProductQuantity,
    changeSimpleProductQuantity,
    venue,
    viewProduct,
  } = useOutletContext<StorefrontLayoutContext>();
  const { customer } = useCustomerSession();
  const navigate = useNavigate();

  function openCart() {
    navigate("/cart");
    window.scrollTo({ top: 0 });
  }

  function requestAccountAuthentication() {
    // A signed-in customer goes straight to their account; only an anonymous
    // visitor needs the phone/OTP sheet.
    if (customer) {
      navigate("/account");
      return;
    }
    openAuth({ context: "account", onSuccess: () => navigate("/account") });
  }

  return (
    <div className="ordering-app">
      <VenueHeader
        cartItemCount={cartItemCount}
        venue={venue}
        onGoToCart={openCart}
        onOpenAccount={requestAccountAuthentication}
      />
      <MenuScreen
        cartItemCount={cartItemCount}
        cartQuantities={cartQuantities}
        cartTotal={cartTotal}
        footer={<VenueFooter venue={venue} />}
        isAcceptingOrders={venue.isAcceptingOrders}
        locationName={venue.locationName}
        menu={menu}
        onAddProduct={openProductConfiguration}
        onAdjustQuantity={adjustConfigurableProductQuantity}
        onGoToCart={openCart}
        onQuantityChange={changeSimpleProductQuantity}
        onViewProduct={(product) => viewProduct(product.id)}
        orderingStatus={venue.orderingStatus}
      />
    </div>
  );
}
