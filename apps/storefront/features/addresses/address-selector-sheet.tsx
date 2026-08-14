import { Check, ChevronRight, Pencil, Plus, X } from "lucide-react";
import type { DeliveryAddress } from "../../domain/storefront";

interface AddressSelectorSheetProps {
  addresses: DeliveryAddress[];
  onAdd: () => void;
  onClose: () => void;
  onEdit: (address: DeliveryAddress) => void;
  onSelect: (address: DeliveryAddress) => void;
  selectedAddressId?: string;
}

export function AddressSelectorSheet({ addresses, onAdd, onClose, onEdit, onSelect, selectedAddressId }: AddressSelectorSheetProps) {
  return <div className="sheet-layer" role="presentation" onMouseDown={onClose}>
    <button aria-label="Close address selector" className="sheet-scrim" type="button" onClick={onClose} />
    <section className="bottom-sheet address-selector-sheet" role="dialog" aria-modal="true" aria-labelledby="address-selector-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="sheet-title-row"><div><p className="eyebrow">Delivery</p><h2 id="address-selector-title">Choose delivery address</h2></div><button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close address selector"><X aria-hidden="true" size={20} /></button></div>
      <div className="address-selector-sheet__body">
        {addresses.map((address) => <div className="address-option" key={address.id} data-selected={selectedAddressId === address.id}><button type="button" onClick={() => onSelect(address)}><span className="address-option__radio" aria-hidden="true">{selectedAddressId === address.id ? <Check size={14} /> : null}</span><span><strong>{address.customLabel || address.label}</strong>{address.isDefault ? <small>Default</small> : null}<em>{address.line1}</em><em>{address.locality}, {address.city}</em></span><ChevronRight aria-hidden="true" size={18} /></button><button type="button" className="address-option__edit" onClick={() => onEdit(address)} aria-label={`Edit ${address.customLabel || address.label}`}><Pencil aria-hidden="true" size={16} /></button></div>)}
        <button className="add-address-row" type="button" onClick={onAdd}><Plus aria-hidden="true" size={19} />Add new address</button>
      </div>
    </section>
  </div>;
}
