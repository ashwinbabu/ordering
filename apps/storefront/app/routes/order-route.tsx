import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { currentOrderStatuses } from "../../domain/storefront";
import { useCustomerSession } from "../../features/auth/customer-session";
import { cancelOrder as cancelOrderRequest, type ServerOrder } from "../../features/checkout/api/storefront-checkout-api";
import { checkoutErrorMessage, checkoutOrderQueryKey } from "../../features/checkout/use-checkout-flow";
import { OrderDetailsScreen } from "../../features/orders/order-details-screen";
import { OrderTrackingScreen } from "../../features/orders/order-tracking-screen";
import { useOrderById } from "../../features/orders/use-order-by-id";
import { LinkUnavailablePage } from "../../features/venue/link-unavailable-page";
import type { StorefrontLayoutContext } from "../storefront-layout";

/**
 * `/orders/:orderId` -- order tracking or order details, chosen by the
 * order's own status (via the shared `currentOrderStatuses` partition, the
 * same one that splits the /orders list into "Current"/"Past"). Fed
 * entirely by useOrderById, a standalone query keyed on the URL param --
 * this route works on a cold load (refresh, direct URL, new tab) with no
 * dependency on `checkout.order` or the order-history list. `checkout.order`
 * is used only to seed the very first paint when it already matches this id
 * (the just-completed-checkout handoff), never as a requirement.
 */
export function OrderRoute() {
  const { orderId } = useParams<{ orderId: string }>();
  const { checkout, replaceCartWithOrder, venue } = useOutletContext<StorefrontLayoutContext>();
  const { customerId } = useCustomerSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string>();

  // A reasonable seed, not a general-purpose guess: this only applies in the
  // same session that just created the order (checkout.order.id === orderId),
  // and every order checkout creates starts out 'placed' in the database --
  // the real query below still resolves independently and corrects this if
  // anything has changed by the time it lands.
  const initialData: ServerOrder | undefined = checkout.order && checkout.order.id === orderId
    ? { order: checkout.order, databaseStatus: "placed" }
    : undefined;

  const orderQuery = useOrderById(orderId, customerId, initialData);

  async function handleCancel() {
    if (!orderQuery.data || cancelling) return;
    setCancelling(true);
    setCancelError(undefined);
    try {
      const result = await cancelOrderRequest(orderQuery.data.order.id, orderQuery.data.databaseStatus, "Cancelled by customer");
      queryClient.setQueryData(checkoutOrderQueryKey(orderId ?? null), result);
    } catch (error) {
      setCancelError(checkoutErrorMessage(error, "We couldn't cancel this order. It may have already been accepted."));
      void orderQuery.refetch();
    } finally {
      setCancelling(false);
    }
  }

  function returnToRestaurant() {
    navigate("/", { replace: true });
  }

  if (orderQuery.isError) {
    return <LinkUnavailablePage venue={venue} onBrowseMenu={returnToRestaurant} />;
  }

  if (!orderQuery.data) {
    return <main className="ordering-app"><section className="customer-empty-state" aria-busy="true"><h1>Loading your order</h1><p>Fetching the latest status.</p></section></main>;
  }

  const { order } = orderQuery.data;
  const isCurrent = currentOrderStatuses.has(order.trackingOrder.status);

  if (isCurrent) {
    return <OrderTrackingScreen cancelError={cancelError} cancelling={cancelling} onBackToRestaurant={returnToRestaurant} onCancel={() => void handleCancel()} order={order} venue={venue} />;
  }

  return <OrderDetailsScreen
    order={order.trackingOrder}
    onBack={() => navigate("/orders")}
    onOrderAgain={(pastOrder) => {
      // Matches the pre-routing "Order again": navigate immediately, let the
      // cart replacement run in the background (replaceCartWithOrder reports
      // its own failures via cartActionError).
      void replaceCartWithOrder(pastOrder);
      navigate("/");
    }}
    venue={venue}
  />;
}
