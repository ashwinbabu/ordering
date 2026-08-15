import { Check, MapPin, Pencil } from "lucide-react";
import { formatRupees, type DeliveryAddress } from "../../domain/storefront";

interface SelectedAddressCardProps { address: DeliveryAddress; deliveryFee?: number; distanceKm?: number; onChange: () => void; onEdit: () => void; venueDisplayName: string; }

export function SelectedAddressCard({ address, deliveryFee, distanceKm, onChange, onEdit, venueDisplayName }: SelectedAddressCardProps) {
  const label = address.customLabel || address.label;
  return <>
    {deliveryFee !== undefined ? (
      <div className="quote-state quote-state--success">
        <span className="quote-check"><Check aria-hidden="true" size={19} /></span>
        <span>
          <strong>Delivery available</strong>
          <small>{distanceKm !== undefined ? `${distanceKm.toFixed(1)} km from ${venueDisplayName} · ` : ""}{formatRupees(deliveryFee)} delivery</small>
        </span>
      </div>
    ) : null}
    <div className="selected-address-card">
      <span className="address-card-icon"><MapPin aria-hidden="true" size={18} /></span>
      <div>
        <div className="selected-address-card__title">
          <strong>{label}{address.isDefault ? " · Default" : ""}</strong>
          <button type="button" onClick={onChange}>Change</button>
        </div>
        <p>{address.line1}, {address.locality}, {address.city}</p>
        <span><button type="button" onClick={onEdit}><Pencil aria-hidden="true" size={13} />Edit</button></span>
      </div>
    </div>
  </>;
}
