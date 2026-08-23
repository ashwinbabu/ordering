import { ArrowLeft } from "lucide-react";
import type { Venue } from "../../domain/storefront";

interface CustomerPageHeaderProps {
  onBack: () => void;
  subtitle?: string;
  title: string;
  venue: Venue;
}

export function CustomerPageHeader({
  onBack,
  subtitle,
  title,
  venue,
}: CustomerPageHeaderProps) {
  return (
    <header className="cart-header customer-page-header">
      <div className="cart-header__inner">
        <button
          className="icon-button"
          type="button"
          onClick={onBack}
          aria-label="Go back"
        >
          <ArrowLeft aria-hidden="true" size={24} />
        </button>
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <span className="brand-mark" aria-label={`${venue.displayName} logo`}>
          {venue.displayName}
        </span>
      </div>
    </header>
  );
}
