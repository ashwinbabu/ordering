import { MapPin, Pencil, Trash2 } from "lucide-react";
import type { DeliveryAddress } from "../../domain/storefront";

interface AddressCardProps {
  address: DeliveryAddress;
  onDelete: () => void;
  onEdit: () => void;
}

export function AddressCard({ address, onDelete, onEdit }: AddressCardProps) {
  const label = address.customLabel || address.label;
  return (
    <article className="saved-address-card">
      <div className="saved-address-card__icon">
        <MapPin aria-hidden="true" size={20} />
      </div>
      <div className="saved-address-card__copy">
        <div>
          <h2>{label}</h2>
          {address.isDefault ? <span>Default</span> : null}
        </div>
        {address.recipientName ? <p>{address.recipientName}</p> : null}
        <p>
          {address.line1}
          {address.line2 ? `, ${address.line2}` : ""}
        </p>
        <p>
          {address.locality}, {address.city}
        </p>
        {address.landmark ? <small>{address.landmark}</small> : null}
      </div>
      <div className="saved-address-card__actions">
        <button type="button" onClick={onEdit}>
          <Pencil aria-hidden="true" size={16} />
          Edit
        </button>
        <button className="danger-text-button" type="button" onClick={onDelete}>
          <Trash2 aria-hidden="true" size={16} />
          Delete
        </button>
      </div>
    </article>
  );
}
