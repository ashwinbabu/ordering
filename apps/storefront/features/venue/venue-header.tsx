import { MapPin } from "lucide-react";
import type { Venue } from "../../domain/storefront";

interface VenueHeaderProps {
  venue: Venue;
}

export function VenueHeader({ venue }: VenueHeaderProps) {
  return (
    <header className="outlet-header">
      <div className="outlet-header__inner">
        <div className="brand-lockup" aria-label={venue.businessName}>
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            {venue.displayName}
          </span>
          <div>
            <p className="brand-name">{venue.displayName}</p>
            <p className="brand-location">
              <MapPin aria-hidden="true" size={13} strokeWidth={2.1} />
              {venue.locationName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
