import type { Venue } from "../../domain/storefront";

interface LinkUnavailablePageProps {
  onBrowseMenu: () => void;
  venue: Venue;
}

export function LinkUnavailablePage({
  onBrowseMenu,
  venue,
}: LinkUnavailablePageProps) {
  return (
    <section className="link-unavailable">
      <span className="link-unavailable__mark" aria-hidden="true">
        {venue.displayName}
      </span>
      <h1>This link isn&rsquo;t available</h1>
      <p>
        The order you&rsquo;re looking for may have expired or the link is no
        longer valid.
      </p>
      <button
        className="link-unavailable__cta"
        type="button"
        onClick={onBrowseMenu}
      >
        Browse the menu
      </button>
    </section>
  );
}
