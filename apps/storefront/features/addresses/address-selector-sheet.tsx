import { Check, Plus, X } from "lucide-react";
import type { DeliveryAddress } from "../../domain/storefront";

interface AddressSelectorSheetProps {
  addresses: DeliveryAddress[];
  onAdd: () => void;
  onClose: () => void;
  onSelect: (address: DeliveryAddress) => void;
  selectedAddressId?: string;
}

export function AddressSelectorSheet({
  addresses,
  onAdd,
  onClose,
  onSelect,
  selectedAddressId,
}: AddressSelectorSheetProps) {
  return (
    <div className="sheet-layer" role="presentation" onMouseDown={onClose}>
      <button
        aria-label="Close address selector"
        className="sheet-scrim"
        type="button"
        onClick={onClose}
      />
      <section
        className="bottom-sheet address-selector-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-selector-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-title-row">
          <div>
            <p className="eyebrow">Delivery</p>
            <h2 id="address-selector-title">Choose delivery address</h2>
          </div>
          <button
            className="icon-button sheet-close"
            type="button"
            onClick={onClose}
            aria-label="Close address selector"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="address-selector">
          <div
            className="address-selector__list"
            role="radiogroup"
            aria-label="Saved addresses"
          >
            {addresses.map((address) => {
              const isSelected = selectedAddressId === address.id;
              return (
                <button
                  aria-checked={isSelected}
                  className={isSelected ? "is-active" : undefined}
                  key={address.id}
                  role="radio"
                  type="button"
                  onClick={() => onSelect(address)}
                >
                  <span className="selector-check" aria-hidden="true">
                    {isSelected ? (
                      <Check aria-hidden="true" size={13} strokeWidth={2.6} />
                    ) : null}
                  </span>
                  <span>
                    <strong>{address.customLabel || address.label}</strong>
                    {address.isDefault ? <small>Default</small> : null}
                    <em>{address.line1}</em>
                    <em>
                      {address.locality}, {address.city}
                    </em>
                    <em>
                      {address.preferredContactMethod === "telegram"
                        ? `Telegram · @${address.telegramUsername ?? ""}`
                        : `${address.preferredContactMethod === "whatsapp" ? "WhatsApp" : "Phone call"} · ${address.recipientPhoneE164}`}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="add-another-address" type="button" onClick={onAdd}>
            <Plus aria-hidden="true" size={17} />
            Add another address
          </button>
        </div>
      </section>
    </div>
  );
}
