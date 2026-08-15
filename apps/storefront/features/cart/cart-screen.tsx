import { ArrowLeft, Check, ChevronDown, Minus, Pencil, Plus, ShoppingBag, Store, Tag, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddressForm, type AddressDraft } from "../addresses/address-form";
import { AddressSelectorSheet } from "../addresses/address-selector-sheet";
import { SelectedAddressCard } from "../addresses/selected-address-card";
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
  onEditConfiguration: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRequestAuthentication: (request: AuthFlowRequest) => void;
  onSavedAddressesChange: (addresses: DeliveryAddress[]) => void;
  savedAddresses: DeliveryAddress[];
  venue: Venue;
}

type CouponState = "collapsed" | "expanded" | "applied";

export function CartScreen({ cart, customerDetails, isCustomerVerified, menu, onBack, onCheckoutAttempt, onEditConfiguration, onQuantityChange, onRequestAuthentication, onSavedAddressesChange, savedAddresses, venue }: CartScreenProps) {
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("delivery");
  const [selectedAddressId, setSelectedAddressId] = useState<string>();
  const [addressSheet, setAddressSheet] = useState<"selector" | "form" | null>(null);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress>();
  const [addressInvalid, setAddressInvalid] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [couponState, setCouponState] = useState<CouponState>("collapsed");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const effectiveAddressId = selectedAddressId ?? savedAddresses.find((address) => address.isDefault)?.id;
  const lines = useMemo(() => cart.flatMap((line) => { const product = productById(menu, line.productId); return product ? [{ ...line, product }] : []; }), [cart, menu]);
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
  const selectedAddress = savedAddresses.find((address) => address.id === effectiveAddressId);
  const deliveryFee = fulfilment === "delivery" && selectedAddress ? 39 : 0;
  const taxes = Math.round(subtotal * 0.18);
  const total = subtotal + deliveryFee + taxes;
  const needsAddress = fulfilment === "delivery" && !selectedAddress;

  function openAddressForm(address?: DeliveryAddress) { setEditingAddress(address); setAddressSheet("form"); }
  function saveAddress(draft: AddressDraft) {
    const id = editingAddress?.id ?? `address-${Date.now()}`;
    const isDefault = editingAddress ? draft.isDefault : savedAddresses.length === 0;
    const next = { ...draft, id, isDefault };
    onSavedAddressesChange(editingAddress
      ? savedAddresses.map((address) => address.id === id ? next : isDefault ? { ...address, isDefault: false } : address)
      : [...savedAddresses.map((address) => isDefault ? { ...address, isDefault: false } : address), next]);
    setSelectedAddressId(id); setEditingAddress(undefined); setAddressSheet(null); setAddressInvalid(false);
  }
  function applyCoupon() {
    if (!couponCode) return;
    setAppliedCoupon(couponCode);
    setCouponState("applied");
  }
  function removeCoupon() {
    setAppliedCoupon("");
    setCouponCode("");
    setCouponState("collapsed");
  }
  function continueToPayment() {
    // Guarded as well as disabled: the operator can pause ordering between the
    // render and the tap, and that arrives over Realtime without user action.
    if (!venue.isAcceptingOrders) return;
    if (needsAddress) { setAddressInvalid(true); if (savedAddresses.length) setAddressSheet("selector"); else openAddressForm(); document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
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
      onChangePhone: () => {},
      onSuccess: () => onCheckoutAttempt(checkoutRequest),
      phone: { countryCode: customerDetails.countryCode, phone: customerDetails.phone },
    });
  }
  function selectAddress(address: DeliveryAddress) { setSelectedAddressId(address.id); setAddressSheet(null); setAddressInvalid(false); }

  const checkoutLabel = !venue.isAcceptingOrders
    ? `${venue.locationName} has paused ordering`
    : needsAddress
      ? "Add a delivery address to continue"
      : "Continue to payment";

  if (!cart.length) {
    return <main className="cart-page">
      <header className="cart-header"><div className="cart-header__inner"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to menu"><ArrowLeft aria-hidden="true" size={22} /></button><div><h1>Your cart</h1><p>0 items</p></div><div className="brand-mark brand-mark--mini" aria-label={`${venue.displayName} logo`}>{venue.displayName}</div></div></header>
      <section className="empty-cart">
        <span className="empty-cart__icon"><ShoppingBag aria-hidden="true" size={32} /></span>
        <h2>Your cart is empty</h2>
        <p>There’s plenty waiting for you on the menu.</p>
        <button className="primary-button" type="button" onClick={onBack}>Browse menu</button>
      </section>
    </main>;
  }

  return <main className="cart-page">
    <header className="cart-header"><div className="cart-header__inner"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to menu"><ArrowLeft aria-hidden="true" size={22} /></button><div><h1>Your cart</h1><p>{itemCount} {itemCount === 1 ? "item" : "items"}</p></div><div className="brand-mark brand-mark--mini" aria-label={`${venue.displayName} logo`}>{venue.displayName}</div></div></header>
    <div className="cart-content">
      <section className="cart-section cart-items" aria-labelledby="cart-order-title">
        <div className="cart-section__title"><h2 id="cart-order-title">Your order</h2><button className="text-button" type="button" onClick={onBack}>Add more</button></div>
        <div className="cart-item-list">
          {lines.map(({ id, product, quantity, selectedOptions, unitPrice }) => (
            <article className="cart-item" key={id}>
              <MenuImage src={product.imageUrl} alt={product.name} className="cart-item__image" />
              <div className="cart-item__body">
                <div className="cart-item__top">
                  <div><h3>{product.name}</h3><p>{selectedOptions.length ? selectedOptions.map((option) => option.optionName).join(" · ") : product.badges?.[0] ?? "Freshly made"}</p></div>
                  <strong>{formatRupees(unitPrice * quantity)}</strong>
                </div>
                <div className="cart-item__actions">
                  <div className="cart-item__links">
                    {(product.optionGroups?.length ?? 0) > 0 ? <button type="button" onClick={() => onEditConfiguration(id)}><Pencil aria-hidden="true" size={14} />Edit</button> : null}
                    <button className="remove-link" type="button" onClick={() => onQuantityChange(id, 0)}>Remove</button>
                  </div>
                  <div className="quantity-stepper" aria-label={`Quantity of ${product.name}`}>
                    <button type="button" onClick={() => onQuantityChange(id, quantity - 1)} aria-label="Decrease quantity"><Minus aria-hidden="true" size={15} /></button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => onQuantityChange(id, quantity + 1)} aria-label="Increase quantity"><Plus aria-hidden="true" size={15} /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cart-section cart-section--supporting instructions-section" aria-labelledby="instructions-title">
        <div className="cart-section__title cart-section__title--stacked">
          <div><h2 id="instructions-title">Special instructions</h2><p>For the kitchen, not a replacement for item options.</p></div>
          <span>{specialInstructions.length}/200</span>
        </div>
        <label className="sr-only" htmlFor="special-instructions">Special instructions for the restaurant</label>
        <textarea id="special-instructions" value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value.slice(0, 200))} placeholder="e.g. Please make it less spicy" />
      </section>

      <section className="cart-section cart-section--supporting coupon-section" aria-label="Add a discount code">
        {couponState === "applied" ? (
          <div className="coupon-applied">
            <span className="coupon-success"><Check aria-hidden="true" size={20} /></span>
            <span><strong>{appliedCoupon}</strong><small>Coupon applied</small></span>
            <button type="button" onClick={removeCoupon}>Remove</button>
          </div>
        ) : couponState === "expanded" ? (
          <div className="coupon-expanded">
            <div className="cart-section__title"><h2>Add a discount code</h2></div>
            <div className="coupon-input-row">
              <label className="sr-only" htmlFor="coupon-code">Discount code</label>
              <input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Enter code" />
              <button type="button" disabled={!couponCode} onClick={applyCoupon}>Apply</button>
            </div>
          </div>
        ) : (
          <button className="coupon-collapsed" type="button" onClick={() => setCouponState("expanded")}>
            <span className="coupon-icon"><Tag aria-hidden="true" size={20} /></span>
            <span><strong>Add a discount code</strong><small>Have an offer code?</small></span>
            <ChevronDown aria-hidden="true" size={18} />
          </button>
        )}
      </section>

      <section className="cart-section cart-section--supporting fulfilment-section" aria-labelledby="fulfilment-title">
        <div className="cart-section__title cart-section__title--stacked"><div><p className="section-kicker">How should we get it to you?</p><h2 id="fulfilment-title">Fulfilment</h2></div></div>
        <div className="fulfilment-toggle" role="radiogroup" aria-label="Fulfilment method">
          <button type="button" role="radio" aria-checked={fulfilment === "delivery"} className={fulfilment === "delivery" ? "is-active" : undefined} onClick={() => setFulfilment("delivery")}>
            <Truck aria-hidden="true" size={22} /><span><strong>Delivery</strong><small>To your door</small></span><span className="radio-dot" aria-hidden="true" />
          </button>
          <button type="button" role="radio" aria-checked={fulfilment === "pickup"} className={fulfilment === "pickup" ? "is-active" : undefined} onClick={() => setFulfilment("pickup")}>
            <Store aria-hidden="true" size={22} /><span><strong>Pickup</strong><small>From {venue.locationName.replace(", Goa", "")}</small></span><span className="radio-dot" aria-hidden="true" />
          </button>
        </div>
        {fulfilment === "pickup" ? <div className="pickup-card"><span className="address-card-icon"><Store aria-hidden="true" size={18} /></span><div><strong>Collect from {venue.displayName}</strong><p>{venue.address}</p></div></div> : null}
        {fulfilment === "delivery" ? (
          <section id="delivery-address" className="address-block" aria-labelledby="delivery-address-title">
            <h3 id="delivery-address-title" className="sr-only">Delivery address</h3>
            {selectedAddress ? (
              <SelectedAddressCard address={selectedAddress} deliveryFee={deliveryFee} venueDisplayName={venue.displayName} onChange={() => setAddressSheet("selector")} onEdit={() => openAddressForm(selectedAddress)} />
            ) : (
              <button className="add-address-card" type="button" onClick={() => savedAddresses.length ? setAddressSheet("selector") : openAddressForm()} aria-describedby={addressInvalid ? "address-error" : undefined}>
                <span className="address-card-icon"><Truck aria-hidden="true" size={18} /></span>
                <span><strong>Add delivery address</strong><small>Needed to calculate fee and ETA</small></span>
              </button>
            )}
            {addressInvalid && !selectedAddress ? <p id="address-error" className="address-error" role="alert">Add a delivery address to continue.</p> : null}
          </section>
        ) : null}
      </section>

      <section className="cart-section summary-section" aria-labelledby="payment-summary-title">
        <h2 id="payment-summary-title">Payment summary</h2>
        <dl>
          <div><dt>Subtotal</dt><dd>{formatRupees(subtotal)}</dd></div>
          <div><dt>Delivery fee</dt><dd>{fulfilment === "delivery" && !selectedAddress ? "Calculated after address" : formatRupees(deliveryFee)}</dd></div>
          <div><dt>Taxes</dt><dd>{formatRupees(taxes)}</dd></div>
          <div className="summary-total"><dt>Total</dt><dd>{formatRupees(total)}</dd></div>
        </dl>
        <p className="summary-note">Final prices are rechecked before the secure payment hand-off.</p>
      </section>
    </div>

    <div className="checkout-dock"><div className="checkout-dock__inner"><button className="primary-button" type="button" disabled={!venue.isAcceptingOrders} onClick={continueToPayment}>{checkoutLabel}</button></div></div>

    {addressSheet === "selector" ? <AddressSelectorSheet addresses={savedAddresses} onAdd={() => openAddressForm()} onClose={() => setAddressSheet(null)} onSelect={selectAddress} selectedAddressId={effectiveAddressId} /> : null}
    {addressSheet === "form" ? <div className="sheet-layer" role="presentation"><button aria-label="Close address form" className="sheet-scrim" type="button" onClick={() => setAddressSheet(null)} /><section className="bottom-sheet address-form-sheet" role="dialog" aria-modal="true" aria-label={editingAddress ? "Edit address" : "Add an address"}><AddressForm key={editingAddress?.id ?? "new-address"} initialValue={editingAddress} mode={editingAddress ? "edit" : "create"} onCancel={() => setAddressSheet(null)} onSave={saveAddress} /></section></div> : null}
  </main>;
}
