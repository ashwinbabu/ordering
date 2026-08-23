import type { ReactNode } from "react";
import { setStorefrontContext } from "../lib/storefront/storefront-context";
import { useStorefrontContextQuery } from "../lib/storefront/storefront-context-query";

// Production always resolves the real hostname. This override exists only
// for local dev, where `localhost` cannot match a storefront_domain row --
// it still round-trips through the same RPC, it just supplies a different
// hostname to resolve. A production build must never have this var set.
const hostname =
  import.meta.env.VITE_STOREFRONT_HOSTNAME_OVERRIDE ?? window.location.hostname;

/**
 * Resolves the hostname to a business/location before rendering anything
 * that depends on it, and gates on failure instead of falling back to any
 * default restaurant. Mutates the storefrontContext singleton in place
 * during render (not in an effect) -- see storefront-context.ts for why:
 * effects run after children have already rendered once, which is too late
 * for the default-parameter call sites that read it.
 */
export function StorefrontBootstrap({ children }: { children: ReactNode }) {
  const contextResource = useStorefrontContextQuery(hostname);

  if (contextResource.status === "pending") {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" aria-busy="true">
          <h1>Loading</h1>
          <p>Finding your restaurant.</p>
        </section>
      </main>
    );
  }

  if (contextResource.status === "error") {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" role="alert">
          <h1>Something went wrong</h1>
          <p>{contextResource.error.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void contextResource.refetch()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (!contextResource.data) {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" role="alert">
          <h1>Restaurant not found</h1>
          <p>This link doesn&rsquo;t match an active restaurant.</p>
        </section>
      </main>
    );
  }

  setStorefrontContext(contextResource.data);

  return <>{children}</>;
}
