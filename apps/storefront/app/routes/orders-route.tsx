import { useNavigate, useOutletContext } from "react-router";
import { OrdersScreen } from "../../features/orders/orders-screen";
import type { StorefrontLayoutContext } from "../storefront-layout";

/**
 * `/orders` -- the order-history screen. Reuses the existing
 * useCustomerOrdersQuery data from the layout unchanged; only navigation
 * changed. Tapping an order now links to /orders/:orderId using the real
 * row UUID (`order.orderId`) -- never the human order number
 * (`order.id`), which get_order does not accept.
 */
export function OrdersRoute() {
  const { currentOrders, pastOrders, ordersResource, venue } = useOutletContext<StorefrontLayoutContext>();
  const navigate = useNavigate();

  return <OrdersScreen
    currentOrders={currentOrders}
    pastOrders={pastOrders}
    onBack={() => navigate("/account")}
    onBrowseMenu={() => navigate("/")}
    onOpenOrder={(order) => navigate(`/orders/${order.orderId}`)}
    state={ordersResource.isPending ? "loading" : ordersResource.isError ? "error" : "ready"}
    venue={venue}
  />;
}
