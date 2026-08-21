import {
  Check,
  ChevronRight,
  LogOut,
  MapPin,
  Package,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type { CustomerProfile, Venue } from "../../domain/storefront";
import { formatPhoneForInput } from "../../domain/phone";
import { CustomerPageHeader } from "../venue/customer-page-header";

interface AccountScreenProps {
  addressCount: number;
  customer: CustomerProfile;
  onBack: () => void;
  onOpenAddresses: () => void;
  onOpenOrders: () => void;
  onRequestPhoneChange: () => void;
  onSaveCustomer: (customer: CustomerProfile) => void;
  onSignOut: () => void;
  venue: Venue;
}

type EditState = "editing" | "saving" | "success";

export function AccountScreen({
  addressCount,
  customer,
  onBack,
  onOpenAddresses,
  onOpenOrders,
  onRequestPhoneChange,
  onSaveCustomer,
  onSignOut,
  venue,
}: AccountScreenProps) {
  const [editState, setEditState] = useState<EditState>();
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [error, setError] = useState<string>();

  function openEdit() {
    setName(customer.name);
    setEmail(customer.email ?? "");
    setError(undefined);
    setEditState("editing");
  }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setError(undefined);
    setEditState("saving");
    window.setTimeout(() => {
      onSaveCustomer({
        ...customer,
        name: name.trim(),
        email: email.trim() || undefined,
      });
      setEditState("success");
      window.setTimeout(() => setEditState(undefined), 650);
    }, 300);
  }

  return (
    <main className="ordering-app customer-page account-page">
      <CustomerPageHeader title="Account" venue={venue} onBack={onBack} />
      <div className="customer-page-shell account-page__shell">
        <section
          className="account-identity"
          aria-labelledby="personal-details-title"
        >
          <div className="account-identity__icon">
            <UserRound aria-hidden="true" size={22} />
          </div>
          <div>
            <p className="section-kicker">Personal details</p>
            <h2 id="personal-details-title">{customer.name}</h2>
            <p className="account-identity__phone">
              {customer.countryCode} {formatPhone(customer.phone, customer.countryIso2)}
              {customer.isPhoneVerified ? (
                <Check aria-label="Verified phone number" size={16} />
              ) : null}
            </p>
            {customer.email ? (
              <p>{customer.email}</p>
            ) : (
              <p className="account-identity__add-email">Email · Add email</p>
            )}
          </div>
          <button className="text-button" type="button" onClick={openEdit}>
            <Pencil aria-hidden="true" size={15} />
            Edit
          </button>
        </section>
        <section className="account-navigation" aria-label="Account options">
          <button type="button" onClick={onOpenAddresses}>
            <span className="account-navigation__icon">
              <MapPin aria-hidden="true" size={21} />
            </span>
            <span>
              <strong>Saved addresses</strong>
              <small>
                {addressCount
                  ? `${addressCount} saved ${addressCount === 1 ? "address" : "addresses"}`
                  : "Add your first address"}
              </small>
            </span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
          <button type="button" onClick={onOpenOrders}>
            <span className="account-navigation__icon">
              <Package aria-hidden="true" size={21} />
            </span>
            <span>
              <strong>Your orders</strong>
              <small>View current and previous orders</small>
            </span>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </section>
        <button className="account-sign-out" type="button" onClick={onSignOut}>
          <LogOut aria-hidden="true" size={18} />
          Sign out
        </button>
      </div>
      {editState ? (
        <div className="sheet-layer" role="presentation">
          <button
            aria-label="Close personal details"
            className="sheet-scrim"
            type="button"
            onClick={() => editState !== "saving" && setEditState(undefined)}
          />
          <section
            className="bottom-sheet personal-details-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-personal-details-title"
          >
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Account</p>
                <h2 id="edit-personal-details-title">Edit personal details</h2>
              </div>
              <button
                className="icon-button sheet-close"
                type="button"
                disabled={editState === "saving"}
                onClick={() => setEditState(undefined)}
                aria-label="Close personal details"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            {editState === "success" ? (
              <div className="personal-details-sheet__success" role="status">
                <Check aria-hidden="true" size={22} />
                <strong>Details saved</strong>
              </div>
            ) : (
              <form
                className="personal-details-form"
                onSubmit={save}
                noValidate
              >
                <label className="form-field">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError(undefined);
                    }}
                    autoComplete="name"
                    aria-invalid={Boolean(error)}
                  />
                  {error ? <small role="alert">{error}</small> : null}
                </label>
                <label className="form-field">
                  <span>
                    Email <em>Optional</em>
                  </span>
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(undefined);
                    }}
                    autoComplete="email"
                    inputMode="email"
                    aria-invalid={Boolean(error)}
                    placeholder="name@example.com"
                  />
                </label>
                <div className="verified-phone">
                  <span>Phone</span>
                  <strong>
                    {customer.countryCode} {formatPhone(customer.phone, customer.countryIso2)}{" "}
                    <Check aria-label="Verified phone number" size={15} />
                  </strong>
                  <small>
                    Changing your phone number requires verification.
                  </small>
                  <button
                    className="text-button"
                    type="button"
                    onClick={onRequestPhoneChange}
                  >
                    Change
                  </button>
                </div>
                <div className="personal-details-form__actions">
                  <button
                    className="text-button"
                    type="button"
                    disabled={editState === "saving"}
                    onClick={() => setEditState(undefined)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={editState === "saving"}
                  >
                    {editState === "saving" ? "Saving…" : "Save details"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function formatPhone(phone: string, countryIso2: string) {
  return formatPhoneForInput(phone, countryIso2);
}
