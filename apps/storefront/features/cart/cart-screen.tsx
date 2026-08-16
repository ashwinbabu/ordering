import { ArrowLeft, Check, ChevronDown, Clock3, Minus, Pencil, Plus, ShoppingBag, Store, Tag, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AddressForm, type AddressDraft } from "../addresses/address-form";
import { AddressSelectorSheet } from "../addresses/address-selector-sheet";
import { SelectedAddressCard } from "../addresses/selected-address-card";
import type { AuthFlowRequest } from "../auth/auth-flow-sheet";
import { useCustomerSession } from "../auth/customer-session";
import { MenuImage } from "../menu/menu-image";
import { defaultCountryCode, type PhoneNumber } from "../../domain/phone";
import { formatRupees, type CheckoutRequest, type CustomerDetails, type DeliveryAddress, type FulfilmentType, type Venue } from "../../domain/storefront";
import type { CartLineView, ServerCart, StorefrontSettings } from "../../domain/cart";
import { checkoutEligibilityMessage, evaluateCheckoutEligibility } from "./cart-eligibility";
import { cartErrorMessage, useSetCartCouponMutation } from "./storefront-cart-mutations";
import { storefrontCartQueryKey } from "./storefront-cart-query";
import { useCartCouponDiscountQuery } from "./storefront-coupon-query";
import { useDeliveryQuoteQuery } from "./storefront-delivery-quote-query";
import { useOnlineStatus } from "../../lib/storefront/use-online-status";

interface CartScreenProps {
  cart: ServerCart | undefined;
  cartError?: string;
  customerDetails: CustomerDetails;
  isCartLoading: boolean;
  isCustomerVerified: boolean;
  lines: CartLineView[];
  onBack: () => void;
  onCashCheckoutAttempt: (request: CheckoutRequest) => void;
  onCheckoutAttempt: (request: CheckoutRequest) => void;
  onDismissCartError: () => void;
  onEditConfiguration: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onRequestAuthentication: (request: AuthFlowRequest) => void;
  onSavedAddressesChange: (addresses: DeliveryAddress[]) => void;
  savedAddresses: DeliveryAddress[];
  settings: StorefrontSettings | null;
  venue: Venue;
}

function computeDisplayTax(netFood: number, settings: StorefrontSettings | null) {
  if (!settings || settings.taxMode === "none") return 0;
  if (settings.taxMode === "inclusive") return Math.round((netFood * settings.taxRate / (100 + settings.taxRate)) * 100) / 100;
  return Math.round(netFood * settings.taxRate) / 100;
}

export function CartScreen({ cart, cartError, customerDetails, isCartLoading, isCustomerVerified, lines, onBack, onCashCheckoutAttempt, onCheckoutAttempt, onDismissCartError, onEditConfiguration, onQuantityChange, onRequestAuthentication, onSavedAddressesChange, savedAddresses, settings, venue }: CartScreenProps) {
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("delivery");
  const [isCashOnDelivery, setIsCashOnDelivery] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>();
  const [addressSheet, setAddressSheet] = useState<"selector" | "form" | null>(null);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress>();
  const [addressInvalid, setAddressInvalid] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [isCouponFormOpen, setIsCouponFormOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [priceChangeNotice, setPriceChangeNotice] = useState(false);
  const previousLineTotals = useRef<Map<string, { quantity: number; lineTotal: number }>>(new Map());
  const queryClient = useQueryClient();
  // Cart cache entries are keyed by identity, so coupon writes and the
  // revalidate-on-open below have to target the same identity the cart was
  // loaded under.
  const { customerId } = useCustomerSession();
  const setCartCoupon = useSetCartCouponMutation(customerId);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Revalidate pricing/availability against Supabase as soon as the
    // customer opens the cart to review it (task: revalidate before
    // financial actions), without polling while they're just browsing.
    void queryClient.invalidateQueries({ queryKey: storefrontCartQueryKey(customerId), exact: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previous = previousLineTotals.current;
    if (previous.size > 0) {
      const changed = lines.some((line) => {
        const before = previous.get(line.id);
        return before && before.quantity === line.quantity && before.lineTotal !== line.lineTotal;
      });
      if (changed) setPriceChangeNotice(true);
    }
    previousLineTotals.current = new Map(lines.map((line) => [line.id, { quantity: line.quantity, lineTotal: line.lineTotal }]));
  }, [lines]);

  const effectiveAddressId = selectedAddressId ?? savedAddresses.find((address) => address.isDefault)?.id;
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0);
  const subtotal = cart?.estimatedFoodSubtotal ?? 0;
  const selectedAddress = savedAddresses.find((address) => address.id === effectiveAddressId);
  const appliedCouponCode = cart?.coupon?.code;
  const couponDiscountQuery = useCartCouponDiscountQuery(appliedCouponCode, subtotal);
  const discount = appliedCouponCode && couponDiscountQuery.data?.valid ? couponDiscountQuery.data.discountAmount ?? 0 : 0;
  const netFoodSubtotal = Math.max(subtotal - discount, 0);

  const pickupSupported = !settings || settings.orderingMode !== "delivery";
  const deliverySupported = !settings || settings.orderingMode !== "pickup";
  const deliveryDestination = fulfilment === "delivery" && selectedAddress?.latitude !== undefined && selectedAddress?.longitude !== undefined
    ? { latitude: selectedAddress.latitude, longitude: selectedAddress.longitude }
    : undefined;
  const deliveryQuoteQuery = useDeliveryQuoteQuery(deliveryDestination, netFoodSubtotal);
  const isDeliveryQuoteLoading = fulfilment === "delivery" && Boolean(selectedAddress) && Boolean(deliveryDestination) && deliveryQuoteQuery.isPending;
  const deliveryFee = fulfilment === "pickup"
    ? 0
    : deliveryQuoteQuery.data?.serviceable
      ? deliveryQuoteQuery.data.deliveryFee ?? 0
      : undefined;
  const taxes = computeDisplayTax(netFoodSubtotal, settings);
  const total = settings?.taxMode === "exclusive" ? netFoodSubtotal + taxes + (deliveryFee ?? 0) : netFoodSubtotal + (deliveryFee ?? 0);
  const needsAddress = fulfilment === "delivery" && !selectedAddress;
  const isDeliveryUnserviceable = fulfilment === "delivery" && Boolean(selectedAddress) && Boolean(deliveryDestination) && deliveryQuoteQuery.data?.serviceable === false;

  const eligibility = useMemo(() => evaluateCheckoutEligibility({
    lines,
    settings,
    fulfilment,
    hasAddress: Boolean(selectedAddress),
    deliveryServiceable: fulfilment === "delivery" ? deliveryQuoteQuery.data?.serviceable : undefined,
    isOffline: !isOnline,
    netFoodSubtotal,
  }), [lines, settings, fulfilment, selectedAddress, deliveryQuoteQuery.data?.serviceable, isOnline, netFoodSubtotal]);

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
    if (!couponCode || !isOnline) return;
    setCartCoupon.mutate({ code: couponCode });
  }
  function removeCoupon() {
    setCartCoupon.mutate({ code: null });
    setCouponCode("");
    setIsCouponFormOpen(false);
  }
  function continueToPayment() {
    if (needsAddress) { setAddressInvalid(true); if (savedAddresses.length) setAddressSheet("selector"); else openAddressForm(); document.getElementById("delivery-address")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (!eligibility.canCheckout) return;
    const checkoutRequest: CheckoutRequest = {
      cart: lines.map((line) => ({ id: line.id, productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, selectedOptions: [] })),
      customer: customerDetails,
      customerNote: specialInstructions.trim() || undefined,
      deliveryAddress: selectedAddress,
      displayedTotal: total,
      fulfilment,
      items: lines.map((line) => ({ id: line.id, productId: line.productId, name: line.productName, quantity: line.quantity, unitPrice: line.unitPrice, selectedOptions: line.options.map((option) => option.name) })),
      subtotal: netFoodSubtotal,
      deliveryFee: deliveryFee ?? 0,
      taxes,
    };
    const proceedToCheckout = () => isCashOnDelivery ? onCashCheckoutAttempt(checkoutRequest) : onCheckoutAttempt(checkoutRequest);
    if (isCustomerVerified) { proceedToCheckout(); return; }
    // The address form's recipientPhone is the number the customer just typed
    // for this delivery, so that's who gets texted (needsAddress above
    // guarantees selectedAddress is set once fulfilment is "delivery").
    // Pickup has no address to draw from - fall back to their account
    // contact number, or straight to the phone step if we don't have one.
    const contactPhone: PhoneNumber | undefined = fulfilment === "delivery" && selectedAddress
      ? { countryCode: defaultCountryCode, phone: selectedAddress.recipientPhone }
      : customerDetails.phone
        ? { countryCode: customerDetails.countryCode, phone: customerDetails.phone }
        : undefined;
    onRequestAuthentication(contactPhone
      ? { context: "checkout", initialStep: "otp", onSuccess: proceedToCheckout, phone: contactPhone }
      : { context: "checkout", onSuccess: proceedToCheckout });
  }
  function selectAddress(address: DeliveryAddress) { setSelectedAddressId(address.id); setAddressSheet(null); setAddressInvalid(false); }

  const checkoutLabel = needsAddress
    ? "Add a delivery address to continue"
    : !eligibility.canCheckout && eligibility.reason
      ? checkoutEligibilityMessage(eligibility.reason)
      : isCashOnDelivery ? "Place order" : "Continue to payment";

  // Placeholder estimate until real prep-time logic lands: a flat kitchen
  // prep baseline plus a zone-distance bump (closer zones add less transit
  // time). Only shown once we can actually resolve a zone (delivery with a
  // serviceable address, or pickup which has no zone to resolve).
  const kitchenPrepMinutes = 20;
  const zoneExtraMinutes = deliveryDestination && deliveryQuoteQuery.data?.distanceKm !== undefined
    ? deliveryQuoteQuery.data.distanceKm <= 2 ? 5 : deliveryQuoteQuery.data.distanceKm <= 5 ? 10 : 15
    : 0;
  const estimatedArrivalMinutes = fulfilment === "pickup" ? kitchenPrepMinutes : kitchenPrepMinutes + zoneExtraMinutes;
  const showEstimatedArrival = !needsAddress && (fulfilment === "pickup" || (Boolean(deliveryDestination) && deliveryQuoteQuery.data?.serviceable === true));

  if (isCartLoading && !cart) {
    return <main className="cart-page"><section className="customer-empty-state" aria-busy="true"><h2>Loading your cart</h2><p>Getting your latest items and pricing.</p></section></main>;
  }

  if (!lines.length) {
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
      {!isOnline ? <p className="address-error" role="alert">You&rsquo;re offline. You can still review and edit your cart; pricing and checkout need a connection.</p> : null}
      {cartError ? <p className="address-error" role="alert">{cartError} <button className="text-button" type="button" onClick={onDismissCartError}>Dismiss</button></p> : null}
      {priceChangeNotice ? <p className="address-error" role="status">Some prices were just updated to current menu pricing. <button className="text-button" type="button" onClick={() => setPriceChangeNotice(false)}>Dismiss</button></p> : null}
      {settings && !settings.orderingEnabled ? <p className="address-error" role="alert">{venue.locationName} has paused ordering. Your cart is saved -- you can check out once ordering resumes.</p> : null}
      {settings && settings.orderingEnabled && !settings.isOpenNow && !settings.acceptOrdersWhenClosed ? <p className="address-error" role="alert">{venue.locationName} is closed right now. Your cart is saved for when it reopens.</p> : null}

      <section className="cart-section cart-items" aria-labelledby="cart-order-title">
        <div className="cart-section__title"><h2 id="cart-order-title">Your order</h2><button className="text-button" type="button" onClick={onBack}>Add more</button></div>
        <div className="cart-item-list">
          {lines.map((line) => (
            <article className="cart-item" style={line.isAvailable ? undefined : { opacity: 0.55 }} key={line.id}>
              <div className="cart-item__body">
                <div className="cart-item__top">
                  <div>
                    <h3>{line.productName}</h3>
                    <p>{line.options.length ? line.options.map((option) => option.name).join(" · ") : "Freshly made"}</p>
                    {!line.isAvailable ? <small className="address-error" role="alert">{unavailableCopy(line)}</small> : null}
                  </div>
                  <strong>{formatRupees(line.lineTotal)}</strong>
                </div>
                <div className="cart-item__actions">
                  <div className="cart-item__links">
                    {line.isAvailable && line.hasOptionGroups ? <button type="button" onClick={() => onEditConfiguration(line.id)}><Pencil aria-hidden="true" size={14} />Edit</button> : null}
                    <button className="remove-link" type="button" onClick={() => onQuantityChange(line.id, 0)}>Remove</button>
                  </div>
                  {line.isAvailable ? (
                    <div className="quantity-stepper" aria-label={`Quantity of ${line.productName}`}>
                      <button type="button" onClick={() => onQuantityChange(line.id, line.quantity - 1)} aria-label="Decrease quantity"><Minus aria-hidden="true" size={15} /></button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => onQuantityChange(line.id, line.quantity + 1)} aria-label="Increase quantity"><Plus aria-hidden="true" size={15} /></button>
                    </div>
                  ) : <span className="unavailable-pill">Unavailable</span>}
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
        {appliedCouponCode ? (
          <div className="coupon-applied">
            <span className="coupon-success"><Check aria-hidden="true" size={20} /></span>
            <span><strong>{appliedCouponCode}</strong><small>{couponDiscountQuery.isPending ? "Checking coupon…" : couponDiscountQuery.data?.valid ? `Coupon applied · -${formatRupees(discount)}` : "This coupon is no longer valid"}</small></span>
            <button type="button" onClick={removeCoupon} disabled={setCartCoupon.isPending}>Remove</button>
          </div>
        ) : isCouponFormOpen ? (
          <div className="coupon-expanded">
            <div className="cart-section__title"><h2>Add a discount code</h2></div>
            <div className="coupon-input-row">
              <label className="sr-only" htmlFor="coupon-code">Discount code</label>
              <input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Enter code" />
              <button type="button" disabled={!couponCode || setCartCoupon.isPending || !isOnline} onClick={applyCoupon}>{setCartCoupon.isPending ? "Applying…" : "Apply"}</button>
            </div>
            {setCartCoupon.isError ? <p className="address-error" role="alert">{cartErrorMessage(setCartCoupon.error, "This code isn't valid for your order.")}</p> : null}
          </div>
        ) : (
          <button className="coupon-collapsed" type="button" onClick={() => setIsCouponFormOpen(true)}>
            <span className="coupon-icon"><Tag aria-hidden="true" size={20} /></span>
            <span><strong>Add a discount code</strong><small>Have an offer code?</small></span>
            <ChevronDown aria-hidden="true" size={18} />
          </button>
        )}
      </section>

      <section className="cart-section cart-section--supporting fulfilment-section" aria-labelledby="fulfilment-title">
        <div className="cart-section__title cart-section__title--stacked"><div><p className="section-kicker">How should we get it to you?</p><h2 id="fulfilment-title">Fulfilment</h2></div></div>
        <div className="fulfilment-toggle" role="radiogroup" aria-label="Fulfilment method">
          <button type="button" role="radio" aria-checked={fulfilment === "delivery"} disabled={!deliverySupported} className={fulfilment === "delivery" ? "is-active" : undefined} onClick={() => setFulfilment("delivery")}>
            <Truck aria-hidden="true" size={22} /><span><strong>Delivery</strong><small>To your door</small></span><span className="radio-dot" aria-hidden="true" />
          </button>
          <button type="button" role="radio" aria-checked={fulfilment === "pickup"} disabled={!pickupSupported} className={fulfilment === "pickup" ? "is-active" : undefined} onClick={() => setFulfilment("pickup")}>
            <Store aria-hidden="true" size={22} /><span><strong>Pickup</strong><small>{pickupSupported ? `From ${venue.locationName.replace(", Goa", "")}` : "Not offered here"}</small></span><span className="radio-dot" aria-hidden="true" />
          </button>
        </div>
        {fulfilment === "pickup" ? <div className="pickup-card"><span className="address-card-icon"><Store aria-hidden="true" size={18} /></span><div><strong>Collect from {venue.displayName}</strong><p>{venue.address}</p></div></div> : null}
        {fulfilment === "delivery" ? (
          <section id="delivery-address" className="address-block" aria-labelledby="delivery-address-title">
            <h3 id="delivery-address-title" className="sr-only">Delivery address</h3>
            {selectedAddress ? (
              isDeliveryQuoteLoading ? <p className="summary-note" role="status">Checking delivery for this address…</p>
              : isDeliveryUnserviceable ? <p className="address-error" role="alert">We can&rsquo;t deliver to this address yet. Choose a different address or switch to pickup.</p>
              : <SelectedAddressCard address={selectedAddress} deliveryFee={deliveryDestination ? deliveryFee : undefined} distanceKm={deliveryDestination ? deliveryQuoteQuery.data?.distanceKm : undefined} venueDisplayName={venue.displayName} onChange={() => setAddressSheet("selector")} onEdit={() => openAddressForm(selectedAddress)} />
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
          {discount > 0 ? <div><dt>Discount</dt><dd>-{formatRupees(discount)}</dd></div> : null}
          <div><dt>Delivery fee</dt><dd>{fulfilment === "pickup" ? formatRupees(0) : deliveryFee === undefined ? "Calculated after address" : formatRupees(deliveryFee)}</dd></div>
          <div><dt>Taxes</dt><dd>{formatRupees(taxes)}</dd></div>
          <div className="summary-total"><dt>Total</dt><dd>{formatRupees(total)}</dd></div>
        </dl>
        {settings && netFoodSubtotal < settings.minimumOrderValue ? <p className="address-error" role="alert">Add {formatRupees(settings.minimumOrderValue - netFoodSubtotal)} more to meet the {formatRupees(settings.minimumOrderValue)} minimum order.</p> : null}
        <p className="summary-note">Final prices are rechecked before the secure payment hand-off.</p>
        <label className="cash-on-delivery-toggle">
          <input type="checkbox" checked={isCashOnDelivery} onChange={(event) => setIsCashOnDelivery(event.target.checked)} />
          <span>Pay cash upon delivery</span>
        </label>
      </section>
    </div>

    <div className="checkout-dock"><div className="checkout-dock__inner">{showEstimatedArrival ? <p className="checkout-dock__eta"><Clock3 aria-hidden="true" size={14} strokeWidth={1.9} />Estimated {fulfilment === "pickup" ? "ready" : "arrival"} in {estimatedArrivalMinutes}–{estimatedArrivalMinutes + 5} min</p> : null}<button className="primary-button" type="button" disabled={!needsAddress && !eligibility.canCheckout} onClick={continueToPayment}>{checkoutLabel}</button></div></div>

    {addressSheet === "selector" ? <AddressSelectorSheet addresses={savedAddresses} onAdd={() => openAddressForm()} onClose={() => setAddressSheet(null)} onSelect={selectAddress} selectedAddressId={effectiveAddressId} /> : null}
    {addressSheet === "form" ? <div className="sheet-layer" role="presentation"><button aria-label="Close address form" className="sheet-scrim" type="button" onClick={() => setAddressSheet(null)} /><section className="bottom-sheet address-form-sheet" role="dialog" aria-modal="true" aria-label={editingAddress ? "Edit address" : "Add an address"}><AddressForm key={editingAddress?.id ?? "new-address"} defaultRecipientPhone={customerDetails.phone || savedAddresses.find((address) => address.recipientPhone)?.recipientPhone} initialValue={editingAddress} mode={editingAddress ? "edit" : "create"} onCancel={() => setAddressSheet(null)} onSave={saveAddress} /></section></div> : null}
  </main>;
}

function unavailableCopy(line: CartLineView) {
  if (line.unavailableReason === "product-removed") return "This item is no longer on the menu.";
  if (line.unavailableReason === "option-unavailable") return "A selected option is no longer available.";
  return "Currently unavailable at this location.";
}
