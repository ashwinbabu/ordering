import { MapPin } from "lucide-react";
import type { DeliveryAddress } from "../../domain/storefront";

interface SelectedAddressCardProps { address: DeliveryAddress; onChange: () => void; onEdit: () => void; }

export function SelectedAddressCard({ address, onChange, onEdit }: SelectedAddressCardProps) {
  return <article className="selected-address-card"><div className="selected-address-card__icon"><MapPin aria-hidden="true" size={23} /></div><div className="selected-address-card__copy"><div><strong>{address.customLabel || address.label}</strong>{address.isDefault ? <small>Default</small> : null}</div><p>{address.line1}</p><p>{address.locality}, {address.city}</p></div><div className="selected-address-card__actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onChange}>Change address</button></div></article>;
}
