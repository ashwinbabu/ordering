import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { defaultCountryCode } from "../domain/phone";
import type { CartLineOptionSelection, CheckoutRequest, CustomerDetails, DeliveryAddress, MenuProduct, StorefrontOrder } from "../domain/storefront";
import { AccountScreen } from "../features/account/account-screen";
import { SavedAddressesScreen } from "../features/addresses/saved-addresses-screen";
import { useCustomerAddressesQuery, useDeleteCustomerAddressMutation, useSaveCustomerAddressMutation } from "../features/addresses/customer-addresses-query";
import { createCustomerAddress, resolveCustomerBusinessId } from "../features/addresses/api/customer-address-api";
import { AuthFlowSheet, type AuthFlowRequest } from "../features/auth/auth-flow-sheet";
import { useCustomerSession } from "../features/auth/customer-session";
import { CartScreen } from "../features/cart/cart-screen";
import { cartLineKey } from "../lib/storefront/cart-line-identity";
import { reconcileCartLines, selectionsFromServerItem } from "../features/cart/cart-reconciliation";
import { useRemoveCartItemMutation, useSetCartItemMutation } from "../features/cart/storefront-cart-mutations";
import { readCurrentCart, useStorefrontCartQuery } from "../features/cart/storefront-cart-query";
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
import { useCustomerOrdersQuery } from "../features/orders/customer-orders-query";
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
const noAddresses: DeliveryAddress[] = [];

export function StorefrontApp() {
  const queryClient = useQueryClient();
  const customerSession = useCustomerSession();
  const customer = customerSession.customer;
  // Cart identity: null means this browser is still anonymous, which selects
  // the anonymous cart path and its own cache entry.
  const customerId = customerSession.customerId;
  const [requestedOrderId] = useState(requestedOrderIdFromUrl);
  const [authRequest, setAuthRequest] = useState<AuthFlowRequest>();
  // A guest's typed-but-unsaved delivery address: core.customer_business_addresses
  // writes require an authenticated customer (see createCustomerAddress), so
  // there is nowhere server-side to put this until OTP verification succeeds.
  // Held here (not in CartScreen's local state) so it survives the screen
  // staying mounted underneath the auth sheet and is reachable from the
  // post-verification materialize step below.
  const [pendingGuestAddress, setPendingGuestAddress] = useState<DeliveryAddress>();
  const [selectedOrderId, setSelectedOrderId] = useState<string>();
  const [configurationTarget, setConfigurationTarget] = useState<ConfigurationTarget>();
  const [viewingProductId, setViewingProductId] = useState<string>();
  const [cartActionError, setCartActionError] = useState<string>();
  const storefrontMenuResource = useStorefrontMenuQuery(storefrontContext.businessId, storefrontContext.locationId);
  const cartResource = useStorefrontCartQuery(customerId);
  const customerAddressesResource = useCustomerAddressesQuery(customerId);
  const saveCustomerAddress = useSaveCustomerAddressMutation(customerId);
  const deleteCustomerAddress = useDeleteCustomerAddressMutation(customerId);
  const settingsResource = useStorefrontSettingsQuery();
  const setCartItem = useSetCartItemMutation(customerId);
  const removeCartItem = useRemoveCartItemMutation(customerId);
  const checkout = useCheckoutFlow(cartResource.data?.id, customerId, requestedOrderId);
  const ordersResource = useCustomerOrdersQuery(customerId, storefrontContext.businessId);
  // A restored checkout, or a direct /orders/:orderid load, only knows the
  // order *id* synchronously; the order itself is re-read from the server,
  // so the screen opens in its "confirming" state and resolves once the
  // server answers.
  const [screen, setScreen] = useState<Screen>(() => checkout.restored ? "payment" : requestedOrderId ? "tracking" : "menu");
  useOrderingStatusChannel(storefrontContext.businessId, storefrontContext.locationId);
  const menu = useMemo(
    () => storefrontMenuResource.data ? menuFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const venue = useMemo(
    () => storefrontMenuResource.data ? venueFromStorefrontMenu(storefrontMenuResource.data) : null,
    [storefrontMenuResource.data],
  );
  const cart = cartResource.data;
  const savedAddresses = customerAddressesResource.data ?? noAddresses;
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
  const orders = ordersResource.data ?? [];
  const currentOrders = orders.filter((order) => currentOrderStatuses.has(order.status));
  const pastOrders = orders.filter((order) => !currentOrderStatuses.has(order.status)).slice().sort((left, right) => Date.parse(right.placedAt) - Date.parse(left.placedAt));
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
    // Read the cart fresh at click time, not the value this closure was
    // created with -- a render-stale cart.id would derive a line id for a
    // cart that isn't current any more (see cart-line-identity.ts).
    const currentCart = readCurrentCart(queryClient, customerId);
    if (!currentCart) return;
    const lineId = cartLineKey(currentCart.id, productId, []);
    if (quantity <= 0) {
      if (currentCart.items.some((item) => item.id === lineId)) removeCartItem.mutate({ cartItemId: lineId }, { onError: (error) => reportCartError(error, "Couldn't update your cart.") });
      return;
    }
    setCartItem.mutate(
      { cartItemId: lineId, productId, quantity, selections: [] },
      { onError: (error) => reportCartError(error, "This item couldn't be added right now."), onSettled: onAdded },
    );
  }

  function adjustConfigurableProductQuantity(productId: string, delta: number) {
    const existingLine = cart?.items.find((item) => item.productId === productId);
    if (!existingLine) return;
    changeCartLineQuantity(existingLine.id, existingLine.quantity + delta);
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
    const currentCart = readCurrentCart(queryClient, customerId);
    if (!currentCart) return;
    const lineId = cartLineKey(currentCart.id, product.id, []);
    const existingQuantity = currentCart.items.find((item) => item.id === lineId)?.quantity ?? 0;
    changeSimpleProductQuantity(product.id, existingQuantity + 1);
  }

  function saveConfiguration(selections: CartLineOptionSelection[]) {
    const currentCart = readCurrentCart(queryClient, customerId);
    if (!configurationProduct || !currentCart) return;
    const newLineId = cartLineKey(currentCart.id, configurationProduct.id, selections);
    const optionInputs = selections.map((selection) => ({ optionId: selection.optionId }));
    const onError = (error: unknown) => reportCartError(error, "This item couldn't be added right now.");

    if (configurationTarget?.lineId) {
      const editingItem = currentCart.items.find((item) => item.id === configurationTarget.lineId);
      const quantity = editingItem?.quantity ?? 1;

      if (newLineId === configurationTarget.lineId) {
        setCartItem.mutate({ cartItemId: newLineId, productId: configurationProduct.id, quantity, selections: optionInputs }, { onError });
      } else {
        const collidingQuantity = currentCart.items.find((item) => item.id === newLineId)?.quantity ?? 0;
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
      // customer is already looking at. Adding stays on the menu so the
      // customer can keep browsing instead of being bounced to the cart.
      const existingQuantity = currentCart.items.find((item) => item.id === newLineId)?.quantity ?? 0;
      setCartItem.mutate(
        { cartItemId: newLineId, productId: configurationProduct.id, quantity: existingQuantity + 1, selections: optionInputs },
        { onError },
      );
    }

    setConfigurationTarget(undefined);
  }

  async function saveAddress(draft: AddressDraft, editingId?: string) {
    if (!customerId) {
      // No customer to own the row yet - keep the draft in memory as the
      // guest's presumptive first (default) address until checkout carries
      // them through OTP verification.
      const address: DeliveryAddress = { ...draft, isDefault: true, id: "pending" };
      setPendingGuestAddress(address);
      return address.id;
    }
    const isFirstAddress = customerAddressesResource.isSuccess && savedAddresses.length === 0;
    const addressDraft = editingId ? draft : { ...draft, isDefault: isFirstAddress };
    return saveCustomerAddress.mutateAsync({ draft: addressDraft, addressId: editingId });
  }

  async function removeAddress(addressId: string) {
    await deleteCustomerAddress.mutateAsync({ addressId });
  }

  /**
   * Converts the in-memory guest address into a real
   * core.customer_business_addresses row once OTP verification hands back a
   * real customerId. Called from CartScreen right before checkout_cart, which
   * requires a persisted p_customer_business_address_id - there is no
   * free-text-address path through checkout. Errors are reported the same way
   * as other cart actions and swallowed here (returning undefined) so the
   * caller can just bail out without needing its own error UI.
   */
  async function materializePendingAddress(authenticatedCustomerId: string): Promise<DeliveryAddress | undefined> {
    if (!pendingGuestAddress) return undefined;
    try {
      const customerBusinessId = await resolveCustomerBusinessId(storefrontContext.businessId, authenticatedCustomerId);
      const addressId = await createCustomerAddress(customerBusinessId, pendingGuestAddress);
      const address: DeliveryAddress = { ...pendingGuestAddress, id: addressId };
      setPendingGuestAddress(undefined);
      return address;
    } catch (error) {
      reportCartError(error, "We couldn't save your delivery address. Please try again.");
      return undefined;
    }
  }

  function openAuth(request: AuthFlowRequest) {
    setAuthRequest({
      ...request,
      onCancel: () => { request.onCancel?.(); setAuthRequest(undefined); },
      onSuccess: (phone, customerId) => { request.onSuccess(phone, customerId); setAuthRequest(undefined); },
    });
  }

  function requestAccountAuthentication() {
    // A signed-in customer goes straight to their account; only an anonymous
    // visitor needs the phone/OTP sheet.
    if (customer) { setScreen("account"); return; }
    openAuth({
      context: "account",
      onSuccess: () => setScreen("account"),
    });
  }

  function beginCheckout(request: CheckoutRequest) {
    setScreen("payment");
    void checkout.begin(request);
  }

  function beginCashOnDeliveryCheckout(request: CheckoutRequest) {
    setScreen("payment");
    void checkout.beginCashOnDelivery(request).then((order) => {
      if (!order) return;
      // Cash orders are already placed by checkout_cart, so there is no
      // payment result to confirm. Take the customer straight to the same
      // tracking screen used after an online payment succeeds.
      window.history.replaceState({}, "", `/orders/${order.id}`);
      setScreen("tracking");
    });
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
    const currentCart = readCurrentCart(queryClient, customerId);
    if (!currentCart) return;
    const cartId = currentCart.id;
    const existingItemIds = currentCart.items.map((item) => item.id);

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

  // While a requested/restored order is still being verified against the
  // server, checkout.order is legitimately null for a moment -- only a
  // concluded failure (or a tracking screen with nothing to track at all)
  // means the link is actually unavailable.
  if (checkout.phase === "verification_error" || (screen === "tracking" && !checkout.order && !requestedOrderId && !checkout.restored)) {
    return <LinkUnavailablePage venue={venue} onBrowseMenu={returnToRestaurant} />;
  }

  if (screen === "tracking" && !checkout.order) {
    return <main className="ordering-app"><section className="customer-empty-state" aria-busy="true"><h1>Loading your order</h1><p>Fetching the latest status.</p></section></main>;
  }

  return <>
    {screen === "menu" ? <div className="ordering-app"><VenueHeader cartItemCount={cartItemCount} venue={venue} onGoToCart={openCart} onOpenAccount={requestAccountAuthentication} /><MenuScreen cartItemCount={cartItemCount} cartQuantities={cartQuantities} cartTotal={cartTotal} footer={<VenueFooter venue={venue} />} isAcceptingOrders={venue.isAcceptingOrders} locationName={venue.locationName} menu={menu} onAddProduct={openProductConfiguration} onAdjustQuantity={adjustConfigurableProductQuantity} onGoToCart={openCart} onQuantityChange={changeSimpleProductQuantity} onViewProduct={(product) => setViewingProductId(product.id)} orderingStatus={venue.orderingStatus} /></div> : null}
    {screen === "cart" ? <CartScreen cart={cart} cartError={cartActionError} onDismissCartError={() => setCartActionError(undefined)} isCartLoading={cartResource.isPending} lines={lines} settings={settingsResource.data ?? null} customerDetails={customerDetails} isCustomerVerified={Boolean(customer?.isPhoneVerified)} onBack={() => { setScreen("menu"); requestAnimationFrame(() => document.querySelector(".category-discovery")?.scrollIntoView({ block: "start" })); }} onCashCheckoutAttempt={beginCashOnDeliveryCheckout} onCheckoutAttempt={beginCheckout} onEditConfiguration={(lineId) => { const item = cart?.items.find((candidate) => candidate.id === lineId); if (item) setConfigurationTarget({ productId: item.productId, lineId }); }} onMaterializePendingAddress={materializePendingAddress} onQuantityChange={changeCartLineQuantity} onRequestAuthentication={openAuth} onSaveAddress={saveAddress} pendingAddress={pendingGuestAddress} savedAddresses={savedAddresses} venue={venue} /> : null}
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
    {screen === "addresses" ? <SavedAddressesScreen addresses={savedAddresses} onBack={() => setScreen("account")} onDelete={removeAddress} onRetry={() => void customerAddressesResource.refetch()} onSave={saveAddress} state={customerAddressesResource.isPending ? "loading" : customerAddressesResource.isError ? "error" : "ready"} venue={venue} /> : null}
    {screen === "orders" ? <OrdersScreen currentOrders={currentOrders} pastOrders={pastOrders} onBack={() => setScreen("account")} onBrowseMenu={() => setScreen("menu")} onOpenOrder={openOrderDetails} state={ordersResource.isPending ? "loading" : ordersResource.isError ? "error" : "ready"} venue={venue} /> : null}
    {screen === "order-details" && selectedOrder ? <OrderDetailsScreen order={selectedOrder} onBack={() => setScreen("orders")} onOrderAgain={orderAgain} venue={venue} /> : null}
    {screen === "payment" ? <PaymentFlowScreen onAcceptQuote={checkout.acceptUpdatedQuote} onBackToRestaurant={returnToRestaurant} onConfirmed={openTracking} onProviderReturn={checkout.returnFromProvider} onRetry={checkout.retryPayment} onVerify={() => void checkout.verify()} order={checkout.order} phase={checkout.phase} startError={checkout.startError} updatedAmount={checkout.updatedAmount} venue={venue} /> : null}
    {screen === "tracking" && checkout.order ? <OrderTrackingScreen cancelError={checkout.cancelError} cancelling={checkout.cancelling} onBackToRestaurant={returnToRestaurant} onCancel={() => void checkout.cancelOrder()} order={checkout.order} venue={venue} /> : null}
    {configurationProduct ? <ProductConfigurationSheet initialSelections={configurationLine} isAcceptingOrders={venue.isAcceptingOrders} product={configurationProduct} onClose={() => setConfigurationTarget(undefined)} onConfirm={saveConfiguration} /> : null}
    {viewingProduct ? <ProductDetailSheet isAcceptingOrders={venue.isAcceptingOrders} locationName={venue.locationName} product={viewingProduct} onAdd={openProductConfiguration} onClose={() => setViewingProductId(undefined)} /> : null}
    {authRequest ? <AuthFlowSheet request={authRequest} /> : null}
  </>;
}
