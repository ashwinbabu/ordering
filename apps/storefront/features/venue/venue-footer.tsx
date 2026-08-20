import type { Venue } from "../../domain/storefront";

interface VenueFooterProps {
  venue: Venue;
}

export function VenueFooter({ venue }: VenueFooterProps) {
  return (
    <footer className="menu-footer">
      <span aria-hidden="true" className="brand-mark brand-mark--small">
        {venue.displayName}
      </span>
      <p>Prepared fresh in {venue.locationName.replace(", Goa", "")}</p>
      <small>{venue.address}</small>
    </footer>
  );
}
