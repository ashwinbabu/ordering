import { Plus } from "lucide-react";
import { useState } from "react";
import type { DeliveryAddress, ResourceState, Venue } from "../../domain/storefront";
import { CustomerPageHeader } from "../venue/customer-page-header";
import { AddressCard } from "./address-card";
import { AddressForm, type AddressDraft } from "./address-form";
import { DeleteAddressSheet } from "./delete-address-sheet";

interface SavedAddressesScreenProps {
  addresses: DeliveryAddress[];
  onBack: () => void;
  onDelete: (id: string) => void | Promise<unknown>;
  onRetry?: () => void;
  onSave: (draft: AddressDraft, editingId?: string) => void | Promise<unknown>;
  state?: ResourceState;
  venue: Venue;
}

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function SavedAddressesScreen({ addresses, onBack, onDelete, onRetry, onSave, state = "ready", venue }: SavedAddressesScreenProps) {
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [deletingAddress, setDeletingAddress] = useState<DeliveryAddress>();
  const [deleteError, setDeleteError] = useState<string>();

  function closeForm() { setIsFormOpen(false); setEditingAddress(undefined); setFormError(undefined); }
  function openCreate() { setEditingAddress(undefined); setFormError(undefined); setIsFormOpen(true); }
  async function saveAddress(draft: AddressDraft) {
    try {
      await onSave(draft, editingAddress?.id);
      closeForm();
    } catch (error) {
      setFormError(errorMessage(error, "Couldn't save this address. Please try again."));
    }
  }

  return <main className="ordering-app customer-page saved-addresses-page">
    <CustomerPageHeader title="Saved addresses" venue={venue} onBack={onBack} />
    <div className="customer-page-shell">
      {state === "loading" ? <section className="customer-empty-state"><h2>Loading saved addresses</h2><p>Just a moment while we get your delivery details.</p></section> : null}
      {state === "error" ? <section className="customer-empty-state"><h2>Couldn’t load addresses</h2><p>Please try again. Your saved addresses are unchanged.</p><button className="primary-button" type="button" onClick={onRetry}>Try again</button></section> : null}
      {state === "ready" && addresses.length === 0 ? <section className="customer-empty-state"><h2>No saved addresses yet</h2><p>Save an address to make checkout faster next time.</p><button className="primary-button" type="button" onClick={openCreate}><Plus aria-hidden="true" size={19} />Add address</button></section> : null}
      {state === "ready" && addresses.length > 0 ? <section className="saved-addresses-list" aria-label="Saved addresses">
        {addresses.map((address) => <AddressCard key={address.id} address={address} onEdit={() => { setEditingAddress(address); setFormError(undefined); setIsFormOpen(true); }} onDelete={() => { setDeleteError(undefined); setDeletingAddress(address); }} />)}
        <button className="add-address-row saved-addresses-list__add" type="button" onClick={openCreate}><Plus aria-hidden="true" size={19} />Add new address</button>
      </section> : null}
    </div>
    {isFormOpen ? <div className="sheet-layer" role="presentation"><button aria-label="Close address form" className="sheet-scrim" type="button" onClick={closeForm} /><section className="bottom-sheet address-form-sheet" role="dialog" aria-modal="true" aria-label={editingAddress ? "Edit address" : "Add delivery address"}>{formError ? <p className="address-error" role="alert">{formError}</p> : null}<AddressForm key={editingAddress?.id ?? "new-address"} initialValue={editingAddress} mode={editingAddress ? "edit" : "create"} onCancel={closeForm} onSave={saveAddress} /></section></div> : null}
    {deletingAddress ? <DeleteAddressSheet address={deletingAddress} error={deleteError} onCancel={() => setDeletingAddress(undefined)} onConfirm={() => {
      void Promise.resolve(onDelete(deletingAddress.id))
        .then(() => setDeletingAddress(undefined))
        .catch((error: unknown) => setDeleteError(errorMessage(error, "Couldn't delete this address. Please try again.")));
    }} /> : null}
  </main>;
}
