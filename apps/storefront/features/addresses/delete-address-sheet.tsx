import { X } from "lucide-react";
import type { DeliveryAddress } from "../../domain/storefront";

interface DeleteAddressSheetProps {
  address: DeliveryAddress;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAddressSheet({ address, onCancel, onConfirm }: DeleteAddressSheetProps) {
  const label = address.customLabel || address.label;
  return <div className="sheet-layer" role="presentation">
    <button aria-label="Close remove address confirmation" className="sheet-scrim" type="button" onClick={onCancel} />
    <section className="bottom-sheet confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="remove-address-title">
      <div className="sheet-title-row"><div><p className="eyebrow">Saved address</p><h2 id="remove-address-title">Remove this address?</h2></div><button className="icon-button sheet-close" type="button" onClick={onCancel} aria-label="Close remove address confirmation"><X aria-hidden="true" size={20} /></button></div>
      <div className="confirmation-sheet__body"><strong>{label}</strong><p>{address.line1}, {address.locality}, {address.city}</p><small>You can add it again later if needed.</small></div>
      <div className="confirmation-sheet__actions"><button className="danger-button" type="button" onClick={onConfirm}>Remove address</button><button className="text-button" type="button" onClick={onCancel}>Cancel</button></div>
    </section>
  </div>;
}
