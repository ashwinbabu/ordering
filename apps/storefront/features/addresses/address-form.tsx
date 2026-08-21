import { Check, ChevronDown, MapPin, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { AddressLabel, DeliveryAddress } from "../../domain/storefront";
import {
  defaultCountryIso2,
  isValidPhoneNumber,
  normalizePhoneInput,
  splitE164,
  toE164,
  type PhoneNumber,
} from "../../domain/phone";
import { InternationalPhoneField } from "../auth/international-phone-field";
import { areaCoordinates } from "./area-coordinates";

export type AddressDraft = Omit<DeliveryAddress, "id">;

interface AddressFormProps {
  defaultRecipientPhone?: PhoneNumber;
  initialValue?: DeliveryAddress;
  mode: "create" | "edit";
  onCancel: () => void;
  onSave: (address: AddressDraft) => void | Promise<unknown>;
}

const areas = ["Mandrem", "Arambol", "Ashwem", "Morjim"];
const addressLabels: AddressLabel[] = ["Home", "Hotel", "Work", "Other"];
const emptyDraft: AddressDraft = {
  label: "Home",
  recipientName: "",
  recipientPhoneE164: "",
  recipientPhoneCountryIso2: defaultCountryIso2,
  recipientPhone: "",
  preferredContactMethod: "whatsapp",
  line1: "",
  line2: "",
  locality: "Mandrem",
  city: "North Goa",
  state: "Goa",
  postalCode: "403527",
  landmark: "",
  instructions: "",
  isDefault: false,
  ...areaCoordinates.Mandrem,
};

function toDraft(
  address?: DeliveryAddress,
  defaultRecipientPhone?: PhoneNumber,
): AddressDraft {
  if (!address)
    return defaultRecipientPhone
      ? {
          ...emptyDraft,
          recipientPhone: defaultRecipientPhone.phone,
          recipientPhoneE164: toE164(defaultRecipientPhone) ?? "",
          recipientPhoneCountryIso2: defaultRecipientPhone.countryIso2,
        }
      : emptyDraft;
  return {
    label: address.label,
    customLabel: address.customLabel,
    recipientName: address.recipientName,
    recipientPhoneE164: address.recipientPhoneE164,
    recipientPhoneCountryIso2: address.recipientPhoneCountryIso2,
    recipientPhone: address.recipientPhone,
    preferredContactMethod: address.preferredContactMethod,
    telegramUsername: address.telegramUsername,
    line1: address.line1,
    line2: address.line2,
    locality: address.locality,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    landmark: address.landmark,
    instructions: address.instructions,
    isDefault: address.isDefault,
    latitude: address.latitude,
    longitude: address.longitude,
  };
}

export function AddressForm({
  defaultRecipientPhone,
  initialValue,
  mode,
  onCancel,
  onSave,
}: AddressFormProps) {
  const [draft, setDraft] = useState(() =>
    toDraft(initialValue, defaultRecipientPhone),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isAreaPickerOpen, setIsAreaPickerOpen] = useState(false);
  const lineOneRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  function setField<Key extends keyof AddressDraft>(
    key: Key,
    value: AddressDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.recipientName.trim())
      nextErrors.recipientName = "Enter the recipient's name";
    if (
      !draft.recipientPhoneE164 ||
      !isValidPhoneNumber(
        normalizePhoneInput(
          draft.recipientPhone,
          draft.recipientPhoneCountryIso2,
        ),
      )
    )
      nextErrors.recipientPhone = "Enter a valid mobile number";
    if (draft.preferredContactMethod === "telegram" && !draft.telegramUsername?.trim())
      nextErrors.telegramUsername = "Enter a Telegram username";
    if (!draft.line1.trim()) nextErrors.line1 = "Enter your delivery address";
    if (!draft.locality.trim()) nextErrors.locality = "Choose an area";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      if (nextErrors.line1) lineOneRef.current?.focus();
      return;
    }
    setSaveError(undefined);
    setIsSaving(true);
    try {
      await onSave({
        ...draft,
        recipientName: draft.recipientName.trim(),
        recipientPhone: draft.recipientPhone,
        recipientPhoneE164: draft.recipientPhoneE164,
        recipientPhoneCountryIso2: draft.recipientPhoneCountryIso2,
        telegramUsername: draft.telegramUsername?.replace(/^@/, "").trim() || undefined,
      });
    } catch (e) {
      console.log(e);
      setSaveError("We couldn't save this address. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="sheet-title-row">
        <div>
          <p className="section-kicker">Delivery</p>
          <h2 id={titleId}>
            {mode === "create" ? "Add an address" : "Edit address"}
          </h2>
          <p>We calculate delivery only after you choose a precise area.</p>
        </div>
        <button
          aria-label="Close address form"
          className="icon-button sheet-close"
          type="button"
          onClick={onCancel}
        >
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <form
        className="address-form"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
      >
        <div className="address-form__fields">
          <div className="form-row form-row--two">
            <Field label="Name" error={errors.recipientName}>
              <input
                value={draft.recipientName}
                onChange={(event) =>
                  setField("recipientName", event.target.value)
                }
                autoComplete="name"
                placeholder="Your name"
              />
            </Field>
            <InternationalPhoneField
              error={errors.recipientPhone}
              id="address-phone"
              onChange={(phone) =>
                setDraft((current) => ({
                  ...current,
                  recipientPhone: phone.phone,
                  recipientPhoneE164: `${phone.countryCode}${phone.phone}`,
                  recipientPhoneCountryIso2: phone.countryIso2,
                }))
              }
              value={splitE164(
                draft.recipientPhoneE164 ||
                  toE164(
                    normalizePhoneInput(
                      draft.recipientPhone,
                      draft.recipientPhoneCountryIso2,
                    ),
                  ) || "",
                draft.recipientPhoneCountryIso2,
              )}
            />
          </div>
          <Field
            label="Hotel, villa, hostel or street address"
            error={errors.line1}
          >
            <input
              ref={lineOneRef}
              value={draft.line1}
              onChange={(event) => setField("line1", event.target.value)}
              placeholder="e.g. Palm Grove Guest House"
              autoComplete="address-line1"
            />
          </Field>
          <div className="form-row form-row--two">
            <Field label="Room / flat" hint="Optional">
              <input
                value={draft.line2}
                onChange={(event) => setField("line2", event.target.value)}
                placeholder="e.g. Room 204"
                autoComplete="address-line2"
              />
            </Field>
            <Field label="Area" error={errors.locality}>
              <div className="custom-select">
                <input type="hidden" value={draft.locality} readOnly />
                <button
                  type="button"
                  className="custom-select__trigger"
                  aria-expanded={isAreaPickerOpen}
                  onClick={() => setIsAreaPickerOpen((open) => !open)}
                >
                  <MapPin aria-hidden="true" size={18} />
                  <span>{draft.locality || "Select area"}</span>
                  <ChevronDown aria-hidden="true" size={18} />
                </button>
                {isAreaPickerOpen ? (
                  <div
                    className="custom-select__options"
                    role="radiogroup"
                    aria-label="Delivery area"
                  >
                    {areas.map((area) => (
                      <button
                        key={area}
                        role="radio"
                        aria-checked={draft.locality === area}
                        type="button"
                        onClick={() => {
                          setField("locality", area);
                          setDraft((current) => ({
                            ...current,
                            ...areaCoordinates[area],
                          }));
                          setIsAreaPickerOpen(false);
                        }}
                      >
                        <span>{area}</span>
                        {draft.locality === area ? (
                          <Check aria-hidden="true" size={18} />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>
          </div>
          <Field label="Nearby landmark" hint="Optional">
            <input
              value={draft.landmark}
              onChange={(event) => setField("landmark", event.target.value)}
              placeholder="e.g. Opposite Mandrem Church"
            />
          </Field>
        </div>

        <fieldset className="address-labels">
          <legend>Best way to reach you</legend>
          <div>
            {(["whatsapp", "phone", "telegram"] as const).map((method) => (
              <label key={method}>
                <input
                  type="radio"
                  name="preferred-contact-method"
                  checked={draft.preferredContactMethod === method}
                  onChange={() => setField("preferredContactMethod", method)}
                />
                <span>{method === "whatsapp" ? "WhatsApp" : method === "phone" ? "Phone call" : "Telegram"}</span>
              </label>
            ))}
          </div>
          <p>Messaging is usually easiest for delivery updates and avoids international call charges.</p>
        </fieldset>
        {draft.preferredContactMethod === "telegram" ? (
          <Field label="Telegram username" error={errors.telegramUsername}>
            <input
              value={draft.telegramUsername ? `@${draft.telegramUsername.replace(/^@/, "")}` : ""}
              onChange={(event) => setField("telegramUsername", event.target.value.replace(/^@/, ""))}
              placeholder="@username"
              autoComplete="off"
            />
          </Field>
        ) : null}

        <fieldset className="address-labels">
          <legend>Save as</legend>
          <div>
            {addressLabels.map((label) => (
              <label key={label}>
                <input
                  type="radio"
                  name="address-label"
                  checked={draft.label === label}
                  onChange={() => setField("label", label)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {draft.label === "Other" ? (
          <Field label="Address label">
            <input
              value={draft.customLabel ?? ""}
              onChange={(event) => setField("customLabel", event.target.value)}
              placeholder="e.g. Beach house"
            />
          </Field>
        ) : null}
        {saveError ? (
          <p className="section-error" role="alert">
            {saveError}
          </p>
        ) : null}
        <div className="address-form__actions">
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? "Saving address…" : "Save and check delivery"}
          </button>
        </div>
      </form>
    </>
  );
}

function Field({
  children,
  error,
  hint,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  label: string;
}) {
  return (
    <label className="form-field">
      <span>
        {label} {hint ? <em>{hint}</em> : null}
      </span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  );
}
