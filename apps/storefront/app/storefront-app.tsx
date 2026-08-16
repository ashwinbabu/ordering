import { a2MandremAddresses, a2MandremOrders } from "../demo/a2-mandrem";
import { useMemo, useState } from "react";
import { defaultCountryCode } from "../domain/phone";
import type { CartLineOptionSelection, CheckoutRequest, CustomerDetails, DeliveryAddress, MenuProduct, StorefrontOrder } from "../domain/storefront";
import { AccountScreen } from "../features/account/account-screen";
import { SavedAddressesScreen } from "../features/addresses/saved-addresses-screen";
import { AuthFlowSheet, type AuthFlowRequest } from "../features/auth/auth-flow-sheet";
import { useCustomerSession } from "../features/auth/customer-session";
import { CartScreen } from "../features/cart/cart-screen";
import { cartLineKey } from "../lib/storefront/cart-line-identity";
import { reconcileCartLines, selectionsFromServerItem } from "../features/cart/cart-reconciliation";
import { useRemoveCartItemMutation, useSetCartItemMutation } from "../features/cart/storefront-cart-mutations";
import { useStorefrontCartQuery } from "../features/cart/storefront-cart-query";
import { useStorefrontSettingsQuery } from "../features/cart/storefront-settings-query";
import { PaymentFlowScreen } from "../features/checkout/payment-flow-screen";
import { useCheckoutFlow } from "../features/checkout/use-checkout-flow";
import { MenuScreen } from "../features/menu/menu-screen";
import { ProductConfigurationSheet } from "../features/menu/product-configuration-sheet";
import { ProductDetailSheet } from "../features/menu/product-detail-sheet";
import { menuFromStorefrontMenu, venueFromStorefrontMenu } from "../features/menu/storefront-menu-adapter";
import { useStorefrontMenuQuery } from "../features/menu/storefront-menu-query";
import { useOrderingStatusChannel } from "../features/ordering-status/use-ordering-status-channel";
import { OrderDetailsScreen } from "../features/orders/order-details-screen";
import { OrdersScreen } from "../features/orders/orders-screen";
import { OrderTrackingScreen } from "../features/orders/order-tracking-screen";
import { LinkUnavailablePage } from "../features/venue/link-unavailable-page";
import { VenueFooter } from "../features/venue/venue-footer";
import { VenueHeader } from "../features/venue/venue-header";
import type { AddressDraft } from "../features/addresses/address-form";
import { storefrontContext } from "../lib/storefront/storefront-context";

function requestedOrderIdFromUrl() {
  const match = window.location.pathname.match(/^\/orders\/([^/]+)$/);
  return match ? match[1] : null;
}

type Screen = "account" | "addresses" | "cart" | "menu" | "order-details" | "orders" | "payment" | "tracking";
interface ConfigurationTarget { productId: string; lineId?: string; }

const currentOrderStatuses = new Set<StorefrontOrder["status"]>(["placed", "accepted", "preparing", "out-for-delivery"]);

export function StorefrontApp() {
  const customerSession = useCustomerSession();
  const customer = customerSession.customer;
  // Cart identity: null means this browser is still anonymous, which selects
  // the anonymous cart path and its own cache entry.
  const customerId = customerSession.customerId;
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>(a2MandremAddresses);
  const [orders] = useState<StorefrontOrder[]>(a2MandremOrders);
  const [requestedOrderId] = useState(requestedOrderIdFromUrl);
  const [authRequest, setAuthRequest] = useState<AuthFlowRequest>();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [configurationTarget, setConfigurationTarget] = useState<ConfigurationTarget>();
  const [viewingProductId, setViewingProductId] = useState<string>();
  const [cartActionError, setCartActionError] = useState<string>();
  const storefrontMenuResource = useStorefrontMenuQuery(storefrontContext.locationId);
  const cartResource = useStorefrontCartQuery(customerId);
  const settingsResource = useStorefrontSettingsQuery();
  const setCartItem = useSetCartItemMutation(customerId);
  const removeCartItem = useRemoveCartItemMutation(customerId);
  const checkout = useCheckoutFlow(cartResource.data?.id, customerId);
  // A restored checkout only knows its order *id* synchronously; the order
  // itself is re-read from the server, so the payment screen opens in its
  // "confirming" state and resolves to tracking once the server answers.
  const [screen, setScreen] = useState<Screen>(() => checkout.restored ? "payment" : "menu");
  useOrderingStatusChannel(storefrontContext.locationId);
  const menu = useMemo(
    () => storefrontMenuResource.data ? menuFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const venue = useMemo(
    () => storefrontMenuResource.data ? venueFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const cart = cartResource.data;
  const lines = useMemo(() => reconcileCartLines(cart, menu), [cart, menu]);
  const cartQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    for (const item of cart?.items ?? []) quantities[item.productId] = (quantities[item.productId] ?? 0) + item.quantity;
    return quantities;
  }, [cart]);
  const cartItemCount = useMemo(() => lines.reduce((count, line) => count + line.quantity, 0), [lines]);
  const cartTotal = cart?.estimatedFoodSubtotal ?? 0;
  const customerDetails: CustomerDetails = customer
    ? { name: customer.name, countryCode: customer.countryCode, phone: customer.phone }
    : { name: "", countryCode: defaultCountryCode, phone: "" };
  const restaurantOrders = orders.filter((order) => order.restaurantId === "a2-mandrem");
  const currentOrders = restaurantOrders.filter((order) => currentOrderStatuses.has(order.status));
  const pastOrders = restaurantOrders.filter((order) => !currentOrderStatuses.has(order.status)).slice().sort((left, right) => Date.parse(right.placedAt) - Date.parse(left.placedAt));
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  const configurationProduct = configurationTarget ? menu?.products.find((product) => product.id === configurationTarget.productId) : undefined;
  const configurationServerItem = configurationTarget?.lineId ? cart?.items.find((item) => item.id === configurationTarget.lineId) : undefined;
  const configurationLine = configurationServerItem && configurationProduct ? selectionsFromServerItem(configurationServerItem, configurationProduct) : undefined;
  const viewingProduct = viewingProductId ? menu?.products.find((product) => product.id === viewingProductId) : undefined;

  function reportCartError(error: unknown, fallback: string) {
    const message = (error as { message?: unknown } | null)?.message;
    setCartActionError(typeof message === "string" && message.length > 0 ? message : fallback);
  }

  function openCart() {
    setScreen("cart");
    window.scrollTo({ top: 0 });
  }

  // `onAdded` is passed only by the add-to-cart entry points, never by the
  // quantity stepper -- stepping a quantity must not navigate anywhere.
  function changeSimpleProductQuantity(productId: string, quantity: number, onAdded?: () => void) {
    if (!cart) return;
    const lineId = cartLineKey(cart.id, productId, []);
    if (quantity <= 0) {
      if (cart.items.some((item) => item.id === lineId)) removeCartItem.mutate({ cartItemId: lineId }, { onError: (error) => reportCartError(error, "Couldn't update your cart.") });
      return;
    }
    setCartItem.mutate(
      { cartItemId: lineId, productId, quantity, selections: [] },
      { onError: (error) => reportCartError(error, "This item couldn't be added right now."), onSettled: onAdded },
    );
  }

  function changeCartLineQuantity(lineId: string, quantity: number) {
    if (!cart) return;
    if (quantity <= 0) {
      removeCartItem.mutate({ cartItemId: lineId }, { onError: (error) => reportCartError(error, "Couldn't update your cart.") });
      return;
    }
    const item = cart.items.find((candidate) => candidate.id === lineId);
    if (!item) return;
    setCartItem.mutate(
      { cartItemId: lineId, productId: item.productId, quantity, customerNote: item.customerNote ?? undefined, selections: item.options.map((option) => ({ optionId: option.optionId })) },
      { onError: (error) => reportCartError(error, "This item couldn't be updated right now.") },
    );
  }

  function openProductConfiguration(product: MenuProduct) {
    if ((product.optionGroups?.length ?? 0) > 0) { setConfigurationTarget({ productId: product.id }); return; }
    if (!cart) return;
    const lineId = cartLineKey(cart.id, product.id, []);
    const existingQuantity = cart.items.find((item) => item.id === lineId)?.quantity ?? 0;
    changeSimpleProductQuantity(product.id, existingQuantity + 1, openCart);
  }

  function saveConfiguration(selections: CartLineOptionSelection[]) {
    if (!configurationProduct || !cart) return;
    const newLineId = cartLineKey(cart.id, configurationProduct.id, selections);
    const optionInputs = selections.map((selection) => ({ optionId: selection.optionId }));
    const onError = (error: unknown) => reportCartError(error, "This item couldn't be added right now.");

    if (configurationTarget?.lineId) {
      const editingItem = cart.items.find((item) => item.id === configurationTarget.lineId);
      const quantity = editingItem?.quantity ?? 1;

      if (newLineId === configurationTarget.lineId) {
        setCartItem.mutate({ cartItemId: newLineId, productId: configurationProduct.id, quantity, selections: optionInputs }, { onError });
      } else {
        const collidingQuantity = cart.items.find((item) => item.id === newLineId)?.quantity ?? 0;
        removeCartItem.mutate({ cartItemId: configurationTarget.lineId }, {
          onError,
          onSuccess: () => setCartItem.mutate(
            { cartItemId: newLineId, productId: configurationProduct.id, quantity: quantity + collidingQuantity, selections: optionInputs },
            { onError },
          ),
        });
      }
    } else {
      // Adding a new line is the only branch reached from the menu; the edit
      // branches above are only reachable from the cart screen, which the
      // customer is already looking at. Navigating on settle (rather than
      // immediately) means the cart renders the new line straight away
      // instead of flashing its empty state, and a server rejection lands on
      // the screen that actually shows the error banner.
      const existingQuantity = cart.items.find((item) => item.id === newLineId)?.quantity ?? 0;
      setCartItem.mutate(
        { cartItemId: newLineId, productId: configurationProduct.id, quantity: existingQuantity + 1, selections: optionInputs },
        { onError, onSettled: openCart },
      );
    }

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
    if (!cart) return;
    const cartId = cart.id;
    const existingItemIds = cart.items.map((item) => item.id);

    async function replaceCartWithOrder() {
      for (const itemId of existingItemIds) {
        await removeCartItem.mutateAsync({ cartItemId: itemId });
      }
      for (const item of order.items) {
        const product = item.productId ? menu?.products.find((candidate) => candidate.id === item.productId) : undefined;
        if (!product) continue;
        const lineId = cartLineKey(cartId, product.id, []);
        await setCartItem.mutateAsync({ cartItemId: lineId, productId: product.id, quantity: item.quantity, selections: [] });
      }
    }

    replaceCartWithOrder().catch((error: unknown) => reportCartError(error, "Couldn't reorder this order right now."));
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
    {screen === "menu" ? <div className="ordering-app"><VenueHeader cartItemCount={cartItemCount} venue={venue} onGoToCart={openCart} onOpenAccount={requestAccountAuthentication} /><MenuScreen cartItemCount={cartItemCount} cartQuantities={cartQuantities} cartTotal={cartTotal} footer={<VenueFooter venue={venue} />} isAcceptingOrders={venue.isAcceptingOrders} locationName={venue.locationName} menu={menu} onAddProduct={openProductConfiguration} onGoToCart={openCart} onQuantityChange={changeSimpleProductQuantity} onViewProduct={(product) => setViewingProductId(product.id)} orderingStatus={venue.orderingStatus} /></div> : null}
    {screen === "cart" ? <CartScreen cart={cart} cartError={cartActionError} onDismissCartError={() => setCartActionError(undefined)} isCartLoading={cartResource.isPending} lines={lines} settings={settingsResource.data ?? null} customerDetails={customerDetails} isCustomerVerified={Boolean(customer?.isPhoneVerified)} onBack={() => { setScreen("menu"); requestAnimationFrame(() => document.querySelector(".category-discovery")?.scrollIntoView({ block: "start" })); }} onCheckoutAttempt={beginCheckout} onEditConfiguration={(lineId) => { const item = cart?.items.find((candidate) => candidate.id === lineId); if (item) setConfigurationTarget({ productId: item.productId, lineId }); }} onQuantityChange={changeCartLineQuantity} onRequestAuthentication={openAuth} onSavedAddressesChange={setSavedAddresses} savedAddresses={savedAddresses} venue={venue} /> : null}
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
    {screen === "payment" ? <PaymentFlowScreen onAcceptQuote={checkout.acceptUpdatedQuote} onBackToRestaurant={returnToRestaurant} onConfirmed={openTracking} onProviderReturn={checkout.returnFromProvider} onRetry={checkout.retryPayment} onVerify={() => void checkout.verify()} order={checkout.order} phase={checkout.phase} startError={checkout.startError} updatedAmount={checkout.updatedAmount} venue={venue} /> : null}
    {screen === "tracking" && checkout.order ? <OrderTrackingScreen onBackToRestaurant={returnToRestaurant} order={checkout.order} venue={venue} /> : null}
    {configurationProduct ? <ProductConfigurationSheet initialSelections={configurationLine} product={configurationProduct} onClose={() => setConfigurationTarget(undefined)} onConfirm={saveConfiguration} /> : null}
    {viewingProduct ? <ProductDetailSheet locationName={venue.locationName} product={viewingProduct} onAdd={openProductConfiguration} onClose={() => setViewingProductId(undefined)} /> : null}
    {authRequest ? <AuthFlowSheet request={authRequest} /> : null}
  </>;
}
