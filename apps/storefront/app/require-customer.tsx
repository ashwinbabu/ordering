import { useEffect, useRef } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router";
import { useCustomerSession } from "../features/auth/customer-session";
import type { StorefrontLayoutContext } from "./storefront-layout";

/**
 * Gates /orders, /orders/:orderId, /account and /your-addresses on an
 * authenticated customer, reusing the existing session/auth-sheet
 * machinery -- no separate auth system for routing.
 *
 * Deliberately three states, not two: `customer === null` alone can't tell
 * "not signed in" apart from "signed in, but the customer-row lookup itself
 * failed" (see customerLoadError in customer-session.tsx) -- re-opening the
 * OTP sheet for the latter would be a pointless loop, since the person is
 * already authenticated and OTP can't repair a failed database read.
 */
export function RequireCustomer() {
  const { customer, isLoading, customerLoadError, retryCustomerLoad } =
    useCustomerSession();
  const layoutContext = useOutletContext<StorefrontLayoutContext>();
  const { openAuth } = layoutContext;
  const navigate = useNavigate();
  const location = useLocation();
  // Guards against re-opening the sheet on every render while it's already
  // showing for this same gate -- reset whenever the settled outcome
  // actually changes (e.g. a sign-out while already on a gated route).
  const requestedAuth = useRef(false);

  useEffect(() => {
    if (isLoading || customerLoadError) return;
    if (customer) {
      requestedAuth.current = false;
      return;
    }
    if (requestedAuth.current) return;
    requestedAuth.current = true;
    const intendedPath = location.pathname;
    openAuth({
      context: "account",
      onCancel: () => navigate("/", { replace: true }),
      onSuccess: () => navigate(intendedPath, { replace: true }),
    });
    // Only re-run when the settled auth outcome changes, not on every
    // location/openAuth identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, customerLoadError, customer]);

  if (isLoading) {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" aria-busy="true">
          <h1>Loading your account</h1>
        </section>
      </main>
    );
  }

  if (customerLoadError) {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" role="alert">
          <h1>Couldn&rsquo;t load your account</h1>
          <p>Please try again.</p>
          <button
            className="primary-button"
            type="button"
            onClick={retryCustomerLoad}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" aria-busy="true">
          <h1>Loading your account</h1>
        </section>
      </main>
    );
  }

  return <Outlet context={layoutContext} />;
}
