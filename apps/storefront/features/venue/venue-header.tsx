import { CircleUserRound, Download, MapPin, ShoppingBag } from "lucide-react";
import type { Venue } from "../../domain/storefront";
import { useInstallPrompt } from "./use-install-prompt";

interface VenueHeaderProps {
  cartItemCount: number;
  onGoToCart: () => void;
  onOpenAccount: () => void;
  venue: Venue;
}

export function VenueHeader({ cartItemCount, onGoToCart, onOpenAccount, venue }: VenueHeaderProps) {
  const { canInstall, promptInstall } = useInstallPrompt();

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
        <div className="header-actions">
          {canInstall ? (
            <button className="install-button" type="button" onClick={promptInstall}>
              <Download aria-hidden="true" size={15} strokeWidth={2.2} />
              Install
            </button>
          ) : null}
          <button className="header-bag" type="button" onClick={onGoToCart} aria-label={cartItemCount ? `Open cart, ${cartItemCount} items` : "Open cart"}>
            <ShoppingBag aria-hidden="true" size={20} strokeWidth={2} />
            {cartItemCount > 0 ? <span>{cartItemCount}</span> : null}
          </button>
          <button className="venue-account-button" type="button" onClick={onOpenAccount} aria-label="Open account"><CircleUserRound aria-hidden="true" size={22} /></button>
        </div>
      </div>
    </header>
  );
}
