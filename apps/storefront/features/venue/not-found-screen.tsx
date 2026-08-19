import type { Venue } from "../../domain/storefront";

interface NotFoundScreenProps {
  onBrowseMenu: () => void;
  venue: Venue;
}

/**
 * The generic storefront 404 -- an unrecognised path (`*`), not to be
 * confused with a recognised /orders/:orderId whose order query came back
 * empty/denied (that's LinkUnavailablePage, a distinct condition with its
 * own copy). Mirrors LinkUnavailablePage's structure deliberately, since
 * both are "you're on this storefront, but there's nothing here" states.
 */
export function NotFoundScreen({ onBrowseMenu, venue }: NotFoundScreenProps) {
  return (
    <section className="link-unavailable">
      <span className="link-unavailable__mark" aria-hidden="true">{venue.displayName}</span>
      <h1>Page not found</h1>
      <p>The page you&rsquo;re looking for doesn&rsquo;t exist.</p>
      <button className="link-unavailable__cta" type="button" onClick={onBrowseMenu}>Browse the menu</button>
    </section>
  );
}
