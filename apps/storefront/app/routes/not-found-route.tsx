import { useNavigate, useOutletContext } from "react-router";
import { NotFoundScreen } from "../../features/venue/not-found-screen";
import type { StorefrontLayoutContext } from "../storefront-layout";

/** `*` -- any unrecognised path. Distinct from a recognised /orders/:orderId whose order query failed -- see order-route.tsx. */
export function NotFoundRoute() {
  const { venue } = useOutletContext<StorefrontLayoutContext>();
  const navigate = useNavigate();
  return <NotFoundScreen venue={venue} onBrowseMenu={() => navigate("/")} />;
}
