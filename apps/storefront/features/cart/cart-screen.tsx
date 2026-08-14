import { ArrowLeft, Clock3, Minus, Pencil, Plus, Store, Tag, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddressForm, type AddressDraft } from "../addresses/address-form";
import { AddressSelectorSheet } from "../addresses/address-selector-sheet";
import { SelectedAddressCard } from "../addresses/selected-address-card";
import { CustomerDetailsSection } from "./customer-details-section";
import type { AuthFlowRequest } from "../auth/auth-flow-sheet";
import { MenuImage } from "../menu/menu-image";
import { formatRupees, productById, type CartLine, type CheckoutRequest, type CustomerDetails, type DeliveryAddress, type FulfilmentType, type Menu, type Venue } from "../../domain/storefront";

interface CartScreenProps {
  cart: CartLine[];
  customerDetails: CustomerDetails;
  isCustomerVerified: boolean;
  menu: Menu;
  onBack: () => void;
  onCheckoutAttempt: (request: CheckoutRequest) => void;
  onCustomerDetailsChange: (details: CustomerDetails) => void;
  onEditConfiguration: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRequestAuthentication: (request: AuthFlowRequest) => void;
  onSavedAddressesChange: (addresses: DeliveryAddress[]) => void;
  savedAddresses: DeliveryAddress[];
  venue: Venue;
}
type InvalidSection = "customer" | "address" | null;

export function CartScreen({ cart, customerDetails, isCustomerVerified, menu, onBack, onCheckoutAttempt, onCustomerDetailsChange, onEditConfiguration, onQuantityChange, onRequestAuthentication, onSavedAddressesChange, savedAddresses, venue }: CartScreenProps) {
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("delivery");
  const [selectedAddressId, setSelectedAddressId] = useState<string>();
  const [addressSheet, setAddressSheet] = useState<"selector" | "form" | null>(null);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress>();
  const [invalidSection, setInvalidSection] = useState<InvalidSection>(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [coupon, setCoupon] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!selectedAddressId) setSelectedAddressId(savedAddresses.find((address) => address.isDefault)?.id);
  }, [savedAddresses, selectedAddressId]);

  const lines = useMemo(() => cart.flatMap((line) => { const product = productById(menu, line.productId); return product ? [{ ...line, product }] : []; }), [cart, menu]);
  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId);
  const deliveryFee = fulfilment === "delivery" && selectedAddress ? 39 : 0;
  const taxes = Math.round(subtotal * 0.18);
  const total = subtotal + deliveryFee + taxes;
  const customerError = invalidSection === "customer" ? (!customerDetails.name.trim() ? "name" : "phone") : undefined;

  function openAddressForm(address?: DeliveryAddress) { setEditingAddress(address); setAddressSheet("form"); }
  function saveAddress(draft: AddressDraft) {
    const id = editingAddress?.id ?? `address-${Date.now()}`;
    const next = { ...draft, id };
    onSavedAddressesChange(editingAddress
      ? savedAddresses.map((address) => address.id === id ? next : draft.isDefault ? { ...address, isDefault: false } : address)
      : [...savedAddresses.map((address) => draft.isDefault ? { ...address, isDefault: false } : address), next]);
    setSelectedAddressId(id); setEditingAddress(undefined); setAddressSheet(null); setInvalidSection(null);
  }
  function continueToPayment() {
    const hasCustomer = Boolean(customerDetails.name.trim()) && /^\d{10}$/.test(customerDetails.phone);
    if (!hasCustomer) { setInvalidSection("customer"); document.getElementById("customer-details")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (fulfilment === "delivery" && !selectedAddress) { setInvalidSection("address"); if (savedAddresses.length) setAddressSheet("selector"); else openAddressForm(); document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const checkoutRequest: CheckoutRequest = {
      cart,
      customer: customerDetails,
      deliveryAddress: selectedAddress,
      displayedTotal: total,
      fulfilment,
      items: lines.map(({ id, product, quantity, selectedOptions, unitPrice }) => ({ id, productId: product.id, name: product.name, quantity, unitPrice, selectedOptions: selectedOptions.map((option) => option.optionName) })),
      subtotal,
      deliveryFee,
      taxes,
    };
    if (isCustomerVerified) { onCheckoutAttempt(checkoutRequest); return; }
    onRequestAuthentication({
      context: "checkout",
      initialStep: "otp",
      onChangePhone: () => requestAnimationFrame(() => document.getElementById("customer-phone")?.focus()),
      onSuccess: () => onCheckoutAttempt(checkoutRequest),
      phone: { countryCode: customerDetails.countryCode, phone: customerDetails.phone },
    });
  }
  function selectAddress(address: DeliveryAddress) { setSelectedAddressId(address.id); setAddressSheet(null); setInvalidSection(null); }

  if (!cart.length) {
    return <main className="cart-page"><header className="cart-header"><div className="cart-header__inner"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to menu"><ArrowLeft aria-hidden="true" size={25} /></button><div><h1>Your cart</h1><p>0 items</p></div><span className="brand-mark" aria-label={`${venue.displayName} logo`}>{venue.displayName}</span></div></header><section className="empty-cart"><h2>Your cart is empty</h2><p>There’s plenty waiting for you on the menu.</p><button className="primary-button" type="button" onClick={onBack}>Browse menu</button></section></main>;
  }

  return <main className="cart-page">
    <header className="cart-header"><div className="cart-header__inner"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to menu"><ArrowLeft aria-hidden="true" size={25} /></button><div><h1>Your cart</h1><p>{cart.reduce((count, line) => count + line.quantity, 0)} {cart.reduce((count, line) => count + line.quantity, 0) === 1 ? "item" : "items"}</p></div><span className="brand-mark" aria-label={`${venue.displayName} logo`}>{venue.displayName}</span></div></header>
    <div className="cart-shell">
      <section className="cart-section cart-order" aria-labelledby="cart-order-title"><div className="cart-section__heading"><h2 id="cart-order-title">Your order</h2><button className="text-button" type="button" onClick={onBack}>Add more</button></div>{lines.map(({ id, product, quantity, selectedOptions, unitPrice }) => <article className="cart-line" key={id}><MenuImage src={product.imageUrl} alt={product.name} className="cart-line__image" /><div className="cart-line__copy"><div><h3>{product.name}</h3><strong>{formatRupees(unitPrice * quantity)}</strong></div><p>{selectedOptions.length ? selectedOptions.map((option) => option.optionName).join(" · ") : product.badges?.[0] ?? "Freshly made"}</p><div className="cart-line__actions">{(product.optionGroups?.length ?? 0) > 0 ? <button type="button" onClick={() => onEditConfiguration(id)}><Pencil aria-hidden="true" size={16} />Edit</button> : null}<button type="button" onClick={() => onQuantityChange(id, 0)}><Trash2 aria-hidden="true" size={16} />Remove</button></div><div className="quantity-control quantity-control--cart" aria-label={`Quantity of ${product.name}`}><button type="button" onClick={() => onQuantityChange(id, quantity - 1)} aria-label="Decrease quantity"><Minus aria-hidden="true" size={18} /></button><span>{quantity}</span><button type="button" onClick={() => onQuantityChange(id, quantity + 1)} aria-label="Increase quantity"><Plus aria-hidden="true" size={18} /></button></div></div></article>)}</section>
      <section className="cart-section instructions" aria-labelledby="instructions-title"><div className="cart-section__heading"><h2 id="instructions-title">Special instructions</h2><span>{specialInstructions.length}/200</span></div><p className="cart-section__description">For the kitchen, not a replacement for item options.</p><label className="sr-only" htmlFor="special-instructions">Special instructions for the restaurant</label><textarea id="special-instructions" value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value.slice(0, 200))} placeholder="e.g. Please make it less spicy" /></section>
      <section className="cart-section coupon-section" aria-label="Add a discount code"><button type="button" onClick={() => setCouponOpen((open) => !open)}><span className="coupon-section__icon"><Tag aria-hidden="true" size={22} /></span><span><strong>Add a discount code</strong><small>Have an offer code?</small></span></button>{couponOpen ? <div className="coupon-entry"><label className="sr-only" htmlFor="coupon-code">Discount code</label><input id="coupon-code" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} placeholder="Enter code" /><button type="button" disabled={!coupon}>Apply</button></div> : null}</section>
      <CustomerDetailsSection details={customerDetails} error={customerError} focusInvalid={invalidSection === "customer"} onChange={(details) => { onCustomerDetailsChange(details); setInvalidSection(null); }} />
      <section className="cart-section fulfilment-section" aria-labelledby="fulfilment-title"><p className="section-kicker">How should we get it to you?</p><h2 id="fulfilment-title">Fulfilment</h2><div className="fulfilment-options" role="radiogroup" aria-label="Fulfilment method"><label data-selected={fulfilment === "delivery"}><input type="radio" name="fulfilment" checked={fulfilment === "delivery"} onChange={() => setFulfilment("delivery")} /><Truck aria-hidden="true" size={25} /><span><strong>Delivery</strong><small>To your door</small></span></label><label data-selected={fulfilment === "pickup"}><input type="radio" name="fulfilment" checked={fulfilment === "pickup"} onChange={() => setFulfilment("pickup")} /><Store aria-hidden="true" size={25} /><span><strong>Pickup</strong><small>From {venue.locationName.replace(", Goa", "")}</small></span></label></div>
        {fulfilment === "pickup" ? <p className="pickup-note">Your order will be ready for collection from {venue.address}.</p> : null}
        {fulfilment === "delivery" ? <section id="delivery-address" className="delivery-address" aria-labelledby="delivery-address-title"><div className="cart-section__heading"><div><p className="section-kicker">Deliver to</p><h3 id="delivery-address-title">Delivery address</h3></div></div>{selectedAddress ? <><SelectedAddressCard address={selectedAddress} onChange={() => setAddressSheet("selector")} onEdit={() => openAddressForm(selectedAddress)} /><div className="delivery-available"><span>✓</span><div><strong>Delivery available · 30–35 min</strong><small>2.1 km from {venue.displayName} · {formatRupees(deliveryFee)} delivery</small></div></div></> : <button className="add-delivery-address" type="button" onClick={() => savedAddresses.length ? setAddressSheet("selector") : openAddressForm()} aria-describedby={invalidSection === "address" ? "address-error" : undefined}><strong>Add delivery address</strong><span>Needed to calculate fee and ETA</span></button>}{invalidSection === "address" && !selectedAddress ? <p id="address-error" className="section-error" role="alert">Add a delivery address to continue.</p> : null}</section> : null}
      </section>
      <section className="cart-section payment-summary" aria-labelledby="payment-summary-title"><h2 id="payment-summary-title">Payment summary</h2><dl><div><dt>Subtotal</dt><dd>{formatRupees(subtotal)}</dd></div><div><dt>Delivery fee</dt><dd>{fulfilment === "delivery" && !selectedAddress ? "Calculated after address" : formatRupees(deliveryFee)}</dd></div><div><dt>Taxes</dt><dd>{formatRupees(taxes)}</dd></div><div className="payment-summary__total"><dt>Total</dt><dd>{formatRupees(total)}</dd></div></dl><p>Final prices are rechecked before the secure payment hand-off.</p></section>
    </div>
    <footer className="cart-cta"><div>{fulfilment === "delivery" && selectedAddress ? <span><Clock3 aria-hidden="true" size={18} />Estimated arrival 30–35 min</span> : <strong>{formatRupees(total)} total</strong>}<button type="button" onClick={continueToPayment}>Continue to payment</button></div></footer>
    {addressSheet === "selector" ? <AddressSelectorSheet addresses={savedAddresses} onAdd={() => openAddressForm()} onClose={() => setAddressSheet(null)} onEdit={openAddressForm} onSelect={selectAddress} selectedAddressId={selectedAddressId} /> : null}
    {addressSheet === "form" ? <div className="sheet-layer" role="presentation"><button aria-label="Close address form" className="sheet-scrim" type="button" onClick={() => setAddressSheet(null)} /><section className="bottom-sheet address-form-sheet" role="dialog" aria-modal="true" aria-label={editingAddress ? "Edit address" : "Add an address"}><AddressForm key={editingAddress?.id ?? "new-address"} initialValue={editingAddress} mode={editingAddress ? "edit" : "create"} onCancel={() => setAddressSheet(null)} onSave={saveAddress} /></section></div> : null}
  </main>;
}
