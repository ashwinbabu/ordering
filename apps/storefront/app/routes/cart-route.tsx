import { useNavigate, useOutletContext } from "react-router";
import type { CheckoutRequest } from "../../domain/storefront";
import { useCustomerSession } from "../../features/auth/customer-session";
import { CartScreen } from "../../features/cart/cart-screen";
import { PaymentFlowScreen } from "../../features/checkout/payment-flow-screen";
import type { StorefrontLayoutContext } from "../storefront-layout";

/**
 * `/cart` -- the cart screen, or PaymentFlowScreen while a checkout is in
 * progress. Payment/checkout is deliberately transient state layered on
 * this one route rather than a separate /checkout route: Razorpay's
 * checkout.js widget opens in-page (no redirect, no return URL), so the
 * whole quote -> create-order -> widget -> verify sequence completes
 * without ever leaving this page. On success it navigates to
 * /orders/:orderId with `replace`, so Back from tracking doesn't land back
 * inside a finished payment.
 */
export function CartRoute() {
  const {
    cart,
    cartActionError,
    dismissCartError,
    cartResource,
    lines,
    settings,
    customerDetails,
    checkout,
    openAuth,
    openConfigurationForLine,
    materializePendingAddress,
    changeCartLineQuantity,
    saveAddress,
    pendingGuestAddress,
    savedAddresses,
    venue,
  } = useOutletContext<StorefrontLayoutContext>();
  const { customer } = useCustomerSession();
  const navigate = useNavigate();

  function returnToRestaurant() {
    navigate("/", { replace: true });
  }

  function beginCheckout(request: CheckoutRequest) {
    void checkout.begin(request);
  }

  function beginCashOnDeliveryCheckout(request: CheckoutRequest) {
    void checkout.beginCashOnDelivery(request).then((order) => {
      if (!order) return;
      // Cash orders are already placed by checkout_cart, so there is no
      // payment result to confirm -- go straight to the same order-tracking
      // route an online payment success lands on.
      navigate(`/orders/${order.id}`, { replace: true });
    });
  }

  function onConfirmed() {
    if (!checkout.order) return;
    navigate(`/orders/${checkout.order.id}`, { replace: true });
  }

  if (checkout.phase !== "idle") {
    return (
      <PaymentFlowScreen
        onAcceptQuote={checkout.acceptUpdatedQuote}
        onBackToRestaurant={returnToRestaurant}
        onConfirmed={onConfirmed}
        onRetry={checkout.retryPayment}
        onVerify={() => void checkout.verify()}
        canAcceptUpdatedQuote={checkout.canAcceptUpdatedQuote}
        order={checkout.order}
        phase={checkout.phase}
        startError={checkout.startError}
        updatedAmount={checkout.updatedAmount}
        venue={venue}
      />
    );
  }

  return (
    <CartScreen
      cart={cart}
      cartError={cartActionError}
      onDismissCartError={dismissCartError}
      isCartLoading={cartResource.isPending}
      lines={lines}
      settings={settings}
      customerDetails={customerDetails}
      isCustomerVerified={Boolean(customer?.isPhoneVerified)}
      onBack={() => {
        navigate("/");
        requestAnimationFrame(() =>
          document
            .querySelector(".category-discovery")
            ?.scrollIntoView({ block: "start" }),
        );
      }}
      onCashCheckoutAttempt={beginCashOnDeliveryCheckout}
      onCheckoutAttempt={beginCheckout}
      onEditConfiguration={openConfigurationForLine}
      onMaterializePendingAddress={materializePendingAddress}
      onQuantityChange={changeCartLineQuantity}
      onRequestAuthentication={openAuth}
      onSaveAddress={saveAddress}
      pendingAddress={pendingGuestAddress}
      savedAddresses={savedAddresses}
      venue={venue}
    />
  );
}
