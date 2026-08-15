import { a2MandremAddresses, a2MandremOrders } from "../demo/a2-mandrem";
import { useMemo, useState } from "react";
import { defaultCountryCode } from "../domain/phone";
import type { CartLine, CartLineOptionSelection, CheckoutRequest, CustomerDetails, DeliveryAddress, MenuProduct, StorefrontOrder } from "../domain/storefront";
import { AccountScreen } from "../features/account/account-screen";
import { SavedAddressesScreen } from "../features/addresses/saved-addresses-screen";
import { AuthFlowSheet, type AuthFlowRequest } from "../features/auth/auth-flow-sheet";
import { useCustomerSession } from "../features/auth/customer-session";
import { CartScreen } from "../features/cart/cart-screen";
import { PaymentFlowScreen } from "../features/checkout/payment-flow-screen";
import { useCheckoutFlow } from "../features/checkout/use-checkout-flow";
import { MenuScreen } from "../features/menu/menu-screen";
import { ProductConfigurationSheet } from "../features/menu/product-configuration-sheet";
import { ProductDetailSheet } from "../features/menu/product-detail-sheet";
import { menuFromStorefrontMenu, venueFromStorefrontMenu } from "../features/menu/storefront-menu-adapter";
import { storefrontLocationId } from "../features/menu/storefront-location";
import { useStorefrontMenuQuery } from "../features/menu/storefront-menu-query";
import { useOrderingStatusChannel } from "../features/ordering-status/use-ordering-status-channel";
import { OrderDetailsScreen } from "../features/orders/order-details-screen";
import { OrdersScreen } from "../features/orders/orders-screen";
import { OrderTrackingScreen } from "../features/orders/order-tracking-screen";
import { LinkUnavailablePage } from "../features/venue/link-unavailable-page";
import { VenueFooter } from "../features/venue/venue-footer";
import { VenueHeader } from "../features/venue/venue-header";
import type { AddressDraft } from "../features/addresses/address-form";

function requestedOrderIdFromUrl() {
  const match = window.location.pathname.match(/^\/orders\/([^/]+)$/);
  return match ? match[1] : null;
}

type Screen = "account" | "addresses" | "cart" | "menu" | "order-details" | "orders" | "payment" | "tracking";
interface ConfigurationTarget { productId: string; lineId?: string; }

const currentOrderStatuses = new Set<StorefrontOrder["status"]>(["placed", "accepted", "preparing", "out-for-delivery"]);

export function StorefrontApp() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const customerSession = useCustomerSession();
  const customer = customerSession.customer;
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>(a2MandremAddresses);
  const [orders] = useState<StorefrontOrder[]>(a2MandremOrders);
  const checkout = useCheckoutFlow();
  const [requestedOrderId] = useState(requestedOrderIdFromUrl);
  const [screen, setScreen] = useState<Screen>(() => checkout.order ? checkout.phase === "confirmed" ? "tracking" : "payment" : "menu");
  const [authRequest, setAuthRequest] = useState<AuthFlowRequest>();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [configurationTarget, setConfigurationTarget] = useState<ConfigurationTarget>();
  const [viewingProductId, setViewingProductId] = useState<string>();
  const storefrontMenuResource = useStorefrontMenuQuery(storefrontLocationId);
  useOrderingStatusChannel(storefrontLocationId);
  const menu = useMemo(
    () => storefrontMenuResource.data ? menuFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const venue = useMemo(
    () => storefrontMenuResource.data ? venueFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const cartQuantities = useMemo(() => Object.fromEntries(cart.map((line) => [line.productId, line.quantity])), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((count, line) => count + line.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((total, line) => total + line.unitPrice * line.quantity, 0), [cart]);
  const customerDetails: CustomerDetails = customer
    ? { name: customer.name, countryCode: customer.countryCode, phone: customer.phone }
    : { name: "", countryCode: defaultCountryCode, phone: "" };
  const restaurantOrders = orders.filter((order) => order.restaurantId === "a2-mandrem");
  const currentOrders = restaurantOrders.filter((order) => currentOrderStatuses.has(order.status));
  const pastOrders = restaurantOrders.filter((order) => !currentOrderStatuses.has(order.status)).slice().sort((left, right) => Date.parse(right.placedAt) - Date.parse(left.placedAt));
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  const configurationProduct = configurationTarget ? menu?.products.find((product) => product.id === configurationTarget.productId) : undefined;
  const configurationLine = configurationTarget?.lineId ? cart.find((line) => line.id === configurationTarget.lineId) : undefined;
  const viewingProduct = viewingProductId ? menu?.products.find((product) => product.id === viewingProductId) : undefined;

  function changeSimpleProductQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === productId && line.selectedOptions.length === 0);
      if (quantity <= 0) return existing ? current.filter((line) => line.id !== existing.id) : current;
      if (existing) return current.map((line) => line.id === existing.id ? { ...line, quantity } : line);
      const product = menu?.products.find((item) => item.id === productId);
      return product ? [...current, { id: `simple-${product.id}`, productId, quantity, unitPrice: product.price, selectedOptions: [] }] : current;
    });
  }

  function changeCartLineQuantity(lineId: string, quantity: number) {
    setCart((current) => quantity <= 0
      ? current.filter((line) => line.id !== lineId)
      : current.map((line) => line.id === lineId ? { ...line, quantity } : line));
  }

  function openProductConfiguration(product: MenuProduct) {
    if ((product.optionGroups?.length ?? 0) > 0) setConfigurationTarget({ productId: product.id });
    else changeSimpleProductQuantity(product.id, (cart.find((line) => line.productId === product.id && line.selectedOptions.length === 0)?.quantity ?? 0) + 1);
  }

  function saveConfiguration(selections: CartLineOptionSelection[]) {
    if (!configurationProduct) return;
    const unitPrice = configurationProduct.price + selections.reduce((total, selection) => total + selection.priceDelta, 0);
    setCart((current) => configurationTarget?.lineId
      ? current.map((line) => line.id === configurationTarget.lineId ? { ...line, selectedOptions: selections, unitPrice } : line)
      : [...current, { id: `configuration-${Date.now()}`, productId: configurationProduct.id, quantity: 1, unitPrice, selectedOptions: selections }]);
    setConfigurationTarget(undefined);
  }

  function saveAddress(draft: AddressDraft, editingId?: string) {
    const id = editingId ?? `address-${Date.now()}`;
    const isDefault = editingId ? draft.isDefault : savedAddresses.length === 0;
    const next = { ...draft, id, isDefault };
    setSavedAddresses((current) => editingId
      ? current.map((address) => address.id === editingId ? next : isDefault ? { ...address, isDefault: false } : address)
      : [...current.map((address) => isDefault ? { ...address, isDefault: false } : address), next]);
  }

  function openAuth(request: AuthFlowRequest) {
    setAuthRequest({
      ...request,
      onCancel: () => { request.onCancel?.(); setAuthRequest(undefined); },
      onSuccess: (phone) => { request.onSuccess(phone); setAuthRequest(undefined); },
    });
  }

  function requestAccountAuthentication() {
    openAuth({
      context: "account",
      onSuccess: () => setScreen("account"),
    });
  }

  function beginCheckout(request: CheckoutRequest) {
    setScreen("payment");
    void checkout.begin(request);
  }

  function openTracking() {
    if (!checkout.order) return;
    window.history.replaceState({}, "", `/orders/${checkout.order.id}`);
    setScreen("tracking");
  }

  function returnToRestaurant() {
    window.history.replaceState({}, "", "/");
    setScreen("menu");
  }

  function openOrderDetails(order: StorefrontOrder) {
    setSelectedOrderId(order.id);
    setScreen("order-details");
    window.scrollTo({ top: 0 });
  }

  function orderAgain(order: StorefrontOrder) {
    const lines = order.items.flatMap((item) => {
      const product = item.productId ? menu?.products.find((candidate) => candidate.id === item.productId) : undefined;
      return product ? [{ id: `reorder-${item.id}`, productId: product.id, quantity: item.quantity, unitPrice: product.price, selectedOptions: [] }] : [];
    });
    setCart(lines);
    setScreen("menu");
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  if (storefrontMenuResource.status === "error") {
    return <main className="ordering-app"><section className="customer-empty-state" role="alert"><h1>Menu unavailable</h1><p>{storefrontMenuResource.error.message}</p><button className="primary-button" type="button" onClick={() => void storefrontMenuResource.refetch()}>Try again</button></section></main>;
  }

  if (storefrontMenuResource.status === "pending" || !menu || !venue) {
    return <main className="ordering-app"><section className="customer-empty-state" aria-busy="true"><h1>Loading menu</h1><p>Getting the latest menu for this location.</p></section></main>;
  }

  if ((requestedOrderId && requestedOrderId !== checkout.order?.id) || (screen === "tracking" && !checkout.order)) {
    return <LinkUnavailablePage venue={venue} onBrowseMenu={returnToRestaurant} />;
  }

  return <>
    {screen === "menu" ? <div className="ordering-app"><VenueHeader cartItemCount={cartItemCount} venue={venue} onGoToCart={() => { setScreen("cart"); window.scrollTo({ top: 0 }); }} onOpenAccount={requestAccountAuthentication} /><MenuScreen cartItemCount={cartItemCount} cartQuantities={cartQuantities} cartTotal={cartTotal} footer={<VenueFooter venue={venue} />} isAcceptingOrders={venue.isAcceptingOrders} locationName={venue.locationName} menu={menu} onAddProduct={openProductConfiguration} onGoToCart={() => { setScreen("cart"); window.scrollTo({ top: 0 }); }} onQuantityChange={changeSimpleProductQuantity} onViewProduct={(product) => setViewingProductId(product.id)} orderingStatus={venue.orderingStatus} /></div> : null}
    {screen === "cart" ? <CartScreen cart={cart} customerDetails={customerDetails} isCustomerVerified={Boolean(customer?.isPhoneVerified)} menu={menu} onBack={() => { setScreen("menu"); requestAnimationFrame(() => document.querySelector(".category-discovery")?.scrollIntoView({ block: "start" })); }} onCheckoutAttempt={beginCheckout} onEditConfiguration={(lineId) => { const line = cart.find((candidate) => candidate.id === lineId); if (line) setConfigurationTarget({ productId: line.productId, lineId }); }} onQuantityChange={changeCartLineQuantity} onRequestAuthentication={openAuth} onSavedAddressesChange={setSavedAddresses} savedAddresses={savedAddresses} venue={venue} /> : null}
    {/*
      Known limitation: verifying a different number here re-runs the full
      MSG91 + customer-auth-msg91 exchange, which finds-or-creates a customer
      keyed by that phone_e164. That signs the browser into whichever
      identity the new number resolves to, rather than renaming the phone on
      the currently signed-in customer - core.customers has no "reassign
      phone_e164" operation. The session context picks up the new identity
      on its own via onAuthStateChange, so no local merge is needed here,
      but this is a real product gap worth a deliberate fix, not something
      this task covers.
    */}
    {screen === "account" ? (customer
      ? <AccountScreen addressCount={savedAddresses.length} customer={customer} onBack={() => setScreen("menu")} onOpenAddresses={() => setScreen("addresses")} onOpenOrders={() => setScreen("orders")} onRequestPhoneChange={() => openAuth({ context: "account", initialStep: "phone", phone: { countryCode: customer.countryCode, phone: customer.phone }, onSuccess: () => {} })} onSaveCustomer={customerSession.updateLocalProfile} onSignOut={() => { void customerSession.signOut(); setScreen("menu"); }} venue={venue} />
      : <main className="ordering-app"><section className="customer-empty-state" aria-busy="true"><h1>Loading your account</h1></section></main>) : null}
    {screen === "addresses" ? <SavedAddressesScreen addresses={savedAddresses} onBack={() => setScreen("account")} onDelete={(id) => setSavedAddresses((current) => current.filter((address) => address.id !== id))} onSave={saveAddress} venue={venue} /> : null}
    {screen === "orders" ? <OrdersScreen currentOrders={currentOrders} pastOrders={pastOrders} onBack={() => setScreen("account")} onBrowseMenu={() => setScreen("menu")} onOpenOrder={openOrderDetails} venue={venue} /> : null}
    {screen === "order-details" && selectedOrder ? <OrderDetailsScreen order={selectedOrder} onBack={() => setScreen("orders")} onOrderAgain={orderAgain} venue={venue} /> : null}
    {screen === "payment" ? <PaymentFlowScreen onAcceptQuote={checkout.acceptUpdatedQuote} onBackToRestaurant={returnToRestaurant} onConfirmed={openTracking} onProviderReturn={checkout.returnFromProvider} onRetry={checkout.retryPayment} onVerify={() => void checkout.verify()} order={checkout.order} phase={checkout.phase} updatedAmount={checkout.updatedAmount} venue={venue} /> : null}
    {screen === "tracking" && checkout.order ? <OrderTrackingScreen onBackToRestaurant={returnToRestaurant} order={checkout.order} venue={venue} /> : null}
    {configurationProduct ? <ProductConfigurationSheet initialSelections={configurationLine?.selectedOptions} product={configurationProduct} onClose={() => setConfigurationTarget(undefined)} onConfirm={saveConfiguration} /> : null}
    {viewingProduct ? <ProductDetailSheet locationName={venue.locationName} product={viewingProduct} onAdd={openProductConfiguration} onClose={() => setViewingProductId(undefined)} /> : null}
    {authRequest ? <AuthFlowSheet request={authRequest} /> : null}
  </>;
}
