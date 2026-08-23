import { Route, Routes } from "react-router";
import { RequireCustomer } from "./require-customer";
import { AccountRoute } from "./routes/account-route";
import { AddressesRoute } from "./routes/addresses-route";
import { CartRoute } from "./routes/cart-route";
import { MenuRoute } from "./routes/menu-route";
import { NotFoundRoute } from "./routes/not-found-route";
import { OrderRoute } from "./routes/order-route";
import { OrdersRoute } from "./routes/orders-route";
import { StorefrontLayout } from "./storefront-layout";

/**
 * The storefront's route table. `/` and `/cart` are open to anonymous
 * customers (existing anonymous-browsing/guest-cart behaviour is
 * unchanged); `/orders`, `/orders/:orderId`, `/account` and
 * `/your-addresses` are gated by RequireCustomer, which reuses the existing
 * session/auth-sheet machinery rather than a separate auth system.
 */
export function StorefrontRoutes() {
  return (
    <Routes>
      <Route element={<StorefrontLayout />}>
        <Route index element={<MenuRoute />} />
        <Route path="cart" element={<CartRoute />} />
        <Route element={<RequireCustomer />}>
          <Route path="orders" element={<OrdersRoute />} />
          <Route path="orders/:orderId" element={<OrderRoute />} />
          <Route path="account" element={<AccountRoute />} />
          <Route path="your-addresses" element={<AddressesRoute />} />
        </Route>
        <Route path="*" element={<NotFoundRoute />} />
      </Route>
    </Routes>
  );
}
