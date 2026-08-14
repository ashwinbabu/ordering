import { Check, ChevronDown, MapPin } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { AddressLabel, DeliveryAddress } from "../../domain/storefront";

export type AddressDraft = Omit<DeliveryAddress, "id">;

interface AddressFormProps {
  initialValue?: DeliveryAddress;
  mode: "create" | "edit";
  onCancel: () => void;
  onSave: (address: AddressDraft) => void;
}

const areas = ["Mandrem", "Arambol", "Ashwem", "Morjim"];
const emptyDraft: AddressDraft = {
  label: "Home", recipientName: "", recipientPhone: "", line1: "", line2: "", locality: "Mandrem",
  city: "North Goa", state: "Goa", postalCode: "403527", landmark: "", instructions: "", isDefault: false,
};

function toDraft(address?: DeliveryAddress): AddressDraft {
  if (!address) return emptyDraft;
  return {
    label: address.label, customLabel: address.customLabel, recipientName: address.recipientName,
    recipientPhone: address.recipientPhone, line1: address.line1, line2: address.line2,
    locality: address.locality, city: address.city, state: address.state, postalCode: address.postalCode,
    landmark: address.landmark, instructions: address.instructions, isDefault: address.isDefault,
  };
}

export function AddressForm({ initialValue, mode, onCancel, onSave }: AddressFormProps) {
  const [draft, setDraft] = useState(() => toDraft(initialValue));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAreaPickerOpen, setIsAreaPickerOpen] = useState(false);
  const lineOneRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  function setField<Key extends keyof AddressDraft>(key: Key, value: AddressDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.recipientName.trim()) nextErrors.recipientName = "Enter the recipient's name";
    if (!/^\d{10}$/.test(draft.recipientPhone.replace(/\D/g, ""))) nextErrors.recipientPhone = "Enter a valid 10-digit mobile number";
    if (!draft.line1.trim()) nextErrors.line1 = "Enter your delivery address";
    if (!draft.locality.trim()) nextErrors.locality = "Choose an area";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.line1) lineOneRef.current?.focus();
      return;
    }
    onSave({ ...draft, recipientName: draft.recipientName.trim(), recipientPhone: draft.recipientPhone.replace(/\D/g, "") });
  }

  return (
    <form className="address-form" aria-labelledby={titleId} onSubmit={submit} noValidate>
      <div className="address-form__intro">
        <p className="section-kicker">Delivery</p>
        <h2 id={titleId}>{mode === "create" ? "Add an address" : "Edit address"}</h2>
        <p>We calculate delivery only after you choose a precise area.</p>
      </div>

      <div className="form-grid">
        <Field label="Recipient name" error={errors.recipientName}>
          <input value={draft.recipientName} onChange={(event) => setField("recipientName", event.target.value)} autoComplete="name" />
        </Field>
        <Field label="Recipient phone" error={errors.recipientPhone}>
          <div className="phone-input"><span>+91</span><input value={draft.recipientPhone} onChange={(event) => setField("recipientPhone", event.target.value)} inputMode="numeric" autoComplete="tel" placeholder="98765 43210" /></div>
        </Field>
        <Field label="Hotel, villa, hostel or street address" error={errors.line1}>
          <input ref={lineOneRef} value={draft.line1} onChange={(event) => setField("line1", event.target.value)} placeholder="e.g. Palm Grove Guest House" autoComplete="address-line1" />
        </Field>
        <Field label="Room / flat" hint="Optional">
          <input value={draft.line2} onChange={(event) => setField("line2", event.target.value)} placeholder="e.g. Room 204" autoComplete="address-line2" />
        </Field>
        <Field label="Area" error={errors.locality}>
          <div className="area-picker">
            <button type="button" className="area-picker__button" aria-expanded={isAreaPickerOpen} onClick={() => setIsAreaPickerOpen((open) => !open)}>
              <MapPin aria-hidden="true" size={18} /><span>{draft.locality || "Select area"}</span><ChevronDown aria-hidden="true" size={18} />
            </button>
            {isAreaPickerOpen ? <div className="area-picker__list" role="radiogroup" aria-label="Delivery area">
              {areas.map((area) => <button key={area} role="radio" aria-checked={draft.locality === area} type="button" onClick={() => { setField("locality", area); setIsAreaPickerOpen(false); }}><span>{area}</span>{draft.locality === area ? <Check aria-hidden="true" size={18} /> : null}</button>)}
            </div> : null}
          </div>
        </Field>
        <div className="address-form__split">
          <Field label="City"><input value={draft.city} onChange={(event) => setField("city", event.target.value)} autoComplete="address-level2" /></Field>
          <Field label="Postal code"><input value={draft.postalCode} onChange={(event) => setField("postalCode", event.target.value)} inputMode="numeric" autoComplete="postal-code" /></Field>
        </div>
        <Field label="Nearby landmark" hint="Optional"><input value={draft.landmark} onChange={(event) => setField("landmark", event.target.value)} placeholder="e.g. Opposite Mandrem Church" /></Field>
        <Field label="Delivery instructions" hint="Optional"><textarea value={draft.instructions} onChange={(event) => setField("instructions", event.target.value)} placeholder="Anything that helps us find you?" rows={2} /></Field>
      </div>

      <fieldset className="address-labels"><legend>Save as</legend><div>{(["Home", "Work", "Other"] as AddressLabel[]).map((label) => <label key={label}><input type="radio" name="address-label" checked={draft.label === label} onChange={() => setField("label", label)} /><span>{label}</span></label>)}</div></fieldset>
      {draft.label === "Other" ? <Field label="Address label"><input value={draft.customLabel ?? ""} onChange={(event) => setField("customLabel", event.target.value)} placeholder="e.g. Beach house" /></Field> : null}
      <label className="default-address"><input type="checkbox" checked={draft.isDefault} onChange={(event) => setField("isDefault", event.target.checked)} />Make this my default address</label>
      <div className="address-form__actions"><button className="text-button" type="button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">{mode === "create" ? "Save address" : "Save changes"}</button></div>
    </form>
  );
}

function Field({ children, error, hint, label }: { children: React.ReactNode; error?: string; hint?: string; label: string }) {
  return <label className="form-field"><span>{label} {hint ? <em>{hint}</em> : null}</span>{children}{error ? <small role="alert">{error}</small> : null}</label>;
}
