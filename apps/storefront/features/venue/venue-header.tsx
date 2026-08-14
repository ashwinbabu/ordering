import { CircleUserRound, MapPin } from "lucide-react";
import type { Venue } from "../../domain/storefront";

interface VenueHeaderProps {
  onOpenAccount: () => void;
  venue: Venue;
}

export function VenueHeader({ onOpenAccount, venue }: VenueHeaderProps) {
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
        <button className="venue-account-button" type="button" onClick={onOpenAccount} aria-label="Open account"><CircleUserRound aria-hidden="true" size={22} /></button>
      </div>
    </header>
  );
}
