import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate } from "react-router";
import { defaultCountryCode } from "../domain/phone";
import {
  currentOrderStatuses,
  type CartLineOptionSelection,
  type CustomerDetails,
  type DeliveryAddress,
  type MenuProduct,
  type StorefrontOrder,
} from "../domain/storefront";
import type {
  CartLineView,
  ServerCart,
  StorefrontSettings,
} from "../domain/cart";
import {
  useCustomerAddressesQuery,
  useDeleteCustomerAddressMutation,
  useSaveCustomerAddressMutation,
} from "../features/addresses/customer-addresses-query";
import {
  createCustomerAddress,
  resolveCustomerBusinessId,
} from "../features/addresses/api/customer-address-api";
import type { AddressDraft } from "../features/addresses/address-form";
import {
  AuthFlowSheet,
  type AuthFlowRequest,
} from "../features/auth/auth-flow-sheet";
import { useCustomerSession } from "../features/auth/customer-session";
import { findLineByContent } from "../lib/storefront/cart-line-identity";
import {
  reconcileCartLines,
  selectionsFromServerItem,
} from "../features/cart/cart-reconciliation";
import {
  useRemoveExistingLineMutation,
  useSaveCartLineConfigurationMutation,
  useSetLineByContentMutation,
  useUpdateExistingLineMutation,
} from "../features/cart/storefront-cart-mutations";
import {
  readCurrentCart,
  resolveCartIdentity,
  useStorefrontCartQuery,
} from "../features/cart/storefront-cart-query";
import { useStorefrontSettingsQuery } from "../features/cart/storefront-settings-query";
import { useCheckoutFlow } from "../features/checkout/use-checkout-flow";
import { ProductConfigurationSheet } from "../features/menu/product-configuration-sheet";
import { ProductDetailSheet } from "../features/menu/product-detail-sheet";
import {
  menuFromStorefrontMenu,
  venueFromStorefrontMenu,
} from "../features/menu/storefront-menu-adapter";
import { useStorefrontMenuQuery } from "../features/menu/storefront-menu-query";
import { useOrderingStatusChannel } from "../features/ordering-status/use-ordering-status-channel";
import { useCustomerOrdersQuery } from "../features/orders/customer-orders-query";
import { storefrontContext } from "../lib/storefront/storefront-context";
import type { Menu, Venue } from "../domain/storefront";
import type { UseQueryResult } from "@tanstack/react-query";

interface ConfigurationTarget {
  productId: string;
  lineId?: string;
}

const noAddresses: DeliveryAddress[] = [];

/**
 * Shared across every routed screen via <Outlet context={...}/> -- the
 * router-era equivalent of what StorefrontApp used to compute once and pass
 * down as props. Only major-screen navigation moved to the router; cart,
 * menu, checkout, customer session and every mutation below are unchanged
 * from the pre-routing implementation, just relocated here so no route
 * duplicates its own fetch of the same data.
 */
export interface StorefrontLayoutContext {
  venue: Venue;
  menu: Menu;
  cart: ServerCart | undefined;
  cartResource: { isPending: boolean };
  lines: CartLineView[];
  cartQuantities: Record<string, number>;
  cartItemCount: number;
  cartTotal: number;
  cartActionError: string | undefined;
  dismissCartError: () => void;
  settings: StorefrontSettings | null;
  customerDetails: CustomerDetails;
  savedAddresses: DeliveryAddress[];
  customerAddressesResource: {
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
    refetch: () => void;
  };
  pendingGuestAddress: DeliveryAddress | undefined;
  checkout: ReturnType<typeof useCheckoutFlow>;
  ordersResource: UseQueryResult<StorefrontOrder[]>;
  currentOrders: StorefrontOrder[];
  pastOrders: StorefrontOrder[];
  openAuth: (request: AuthFlowRequest) => void;
  openProductConfiguration: (product: MenuProduct) => void;
  openConfigurationForLine: (lineId: string) => void;
  viewProduct: (productId: string) => void;
  changeSimpleProductQuantity: (
    productId: string,
    quantity: number,
    onAdded?: () => void,
  ) => void;
  adjustConfigurableProductQuantity: (productId: string, delta: number) => void;
  changeCartLineQuantity: (lineId: string, quantity: number) => void;
  saveAddress: (draft: AddressDraft, editingId?: string) => Promise<string>;
  removeAddress: (addressId: string) => Promise<void>;
  materializePendingAddress: (
    authenticatedCustomerId: string,
  ) => Promise<DeliveryAddress | undefined>;
  replaceCartWithOrder: (order: StorefrontOrder) => Promise<void>;
}

export function StorefrontLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const customerSession = useCustomerSession();
  const customer = customerSession.customer;
  // Cart identity: null means this browser is still anonymous, which selects
  // the anonymous cart path and its own cache entry.
  const customerId = customerSession.customerId;
  // The live getter, for anything that resolves cart identity from inside an
  // async operation that can outlive the render that started it (mutations,
  // recovery retries, checkout) -- see getCustomerId's docstring in
  // customer-session.tsx. `customerId` above stays the plain reactive value
  // for query keys and rendered UI, which is what it's for.
  const getCustomerId = customerSession.getCustomerId;
  const [authRequest, setAuthRequest] = useState<AuthFlowRequest>();
  // A guest's typed-but-unsaved delivery address: core.customer_business_addresses
  // writes require an authenticated customer (see createCustomerAddress), so
  // there is nowhere server-side to put this until OTP verification succeeds.
  // Held here (not in CartScreen's local state) so it survives the screen
  // staying mounted underneath the auth sheet and is reachable from the
  // post-verification materialize step below.
  const [pendingGuestAddress, setPendingGuestAddress] =
    useState<DeliveryAddress>();
  const [configurationTarget, setConfigurationTarget] =
    useState<ConfigurationTarget>();
  const [viewingProductId, setViewingProductId] = useState<string>();
  const [cartActionError, setCartActionError] = useState<string>();
  const storefrontMenuResource = useStorefrontMenuQuery(
    storefrontContext.businessId,
    storefrontContext.locationId,
  );
  const cartResource = useStorefrontCartQuery(customerId);
  const customerAddressesResource = useCustomerAddressesQuery(customerId);
  const saveCustomerAddress = useSaveCustomerAddressMutation(customerId);
  const deleteCustomerAddress = useDeleteCustomerAddressMutation(customerId);
  const settingsResource = useStorefrontSettingsQuery();
  const setLineByContent = useSetLineByContentMutation(getCustomerId);
  const updateExistingLine = useUpdateExistingLineMutation(getCustomerId);
  const removeExistingLine = useRemoveExistingLineMutation(getCustomerId);
  const saveCartLineConfiguration =
    useSaveCartLineConfigurationMutation(getCustomerId);
  // The same single identity-resolution function every cart mutation uses
  // (see storefront-cart-query.ts) -- called fresh at the moment each
  // checkout RPC actually fires (see use-checkout-flow.ts), never a value
  // captured here at render time. Reading getCustomerId() (not customerId)
  // means this stays correct even if auth transitions while a checkout call
  // built from it is still in flight.
  const getCartIdentity = useCallback(() => {
    try {
      return resolveCartIdentity(queryClient, getCustomerId());
    } catch {
      return undefined;
    }
  }, [getCustomerId, queryClient]);
  // No requestedOrderId argument: with /orders/:orderId now fed by its own
  // standalone useOrderById query (see use-order-by-id.ts), this hook goes
  // back to being purely about the checkout this browser is actively going
  // through, restored only from checkout-attempt-storage's localStorage
  // pointer -- never re-derived from whatever order page happens to be open.
  const checkout = useCheckoutFlow(
    getCartIdentity,
    getCustomerId,
    cartResource.data,
  );
  const ordersResource = useCustomerOrdersQuery(
    customerId,
    storefrontContext.businessId,
  );
  useOrderingStatusChannel(
    storefrontContext.businessId,
    storefrontContext.locationId,
  );

  // A restored checkout attempt only makes sense to resume from /cart, where
  // PaymentFlowScreen's phase-driven "confirming" state can render -- mirrors
  // the pre-routing app's one-time `checkout.restored ? "payment" : ...`
  // initial-screen check exactly (mount-only; checkout.restored is itself a
  // one-time value that never changes after mount, so this never needs to
  // re-fire).
  useEffect(() => {
    if (checkout.restored) navigate("/cart", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menu = useMemo(
    () =>
      storefrontMenuResource.data
        ? menuFromStorefrontMenu(storefrontMenuResource.data)
        : null,
    [storefrontMenuResource.data],
  );
  const venue = useMemo(
    () =>
      storefrontMenuResource.data
        ? venueFromStorefrontMenu(storefrontMenuResource.data)
        : null,
    [storefrontMenuResource.data],
  );
  const cart = cartResource.data;
  const savedAddresses = customerAddressesResource.data ?? noAddresses;
  const lines = useMemo(() => reconcileCartLines(cart, menu), [cart, menu]);
  const cartQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    for (const item of cart?.items ?? [])
      quantities[item.productId] =
        (quantities[item.productId] ?? 0) + item.quantity;
    return quantities;
  }, [cart]);
  const cartItemCount = useMemo(
    () => lines.reduce((count, line) => count + line.quantity, 0),
    [lines],
  );
  const cartTotal = cart?.estimatedFoodSubtotal ?? 0;
  const customerDetails: CustomerDetails = customer
      ? {
        name: customer.name,
        countryIso2: customer.countryIso2,
        countryCode: customer.countryCode,
        phone: customer.phone,
      }
    : { name: "", countryIso2: "IN", countryCode: defaultCountryCode, phone: "" };
  const orders = ordersResource.data ?? [];
  const currentOrders = orders.filter((order) =>
    currentOrderStatuses.has(order.status),
  );
  const pastOrders = orders
    .filter((order) => !currentOrderStatuses.has(order.status))
    .slice()
    .sort(
      (left, right) => Date.parse(right.placedAt) - Date.parse(left.placedAt),
    );

  const configurationProduct = configurationTarget
    ? menu?.products.find(
        (product) => product.id === configurationTarget.productId,
      )
    : undefined;
  const configurationServerItem = configurationTarget?.lineId
    ? cart?.items.find((item) => item.id === configurationTarget.lineId)
    : undefined;
  const configurationLine =
    configurationServerItem && configurationProduct
      ? selectionsFromServerItem(configurationServerItem, configurationProduct)
      : undefined;
  const viewingProduct = viewingProductId
    ? menu?.products.find((product) => product.id === viewingProductId)
    : undefined;

  function reportCartError(error: unknown, fallback: string) {
    const message = (error as { message?: unknown } | null)?.message;
    setCartActionError(
      typeof message === "string" && message.length > 0 ? message : fallback,
    );
  }

  // `onAdded` is passed only by the add-to-cart entry points, never by the
  // quantity stepper -- stepping a quantity must not navigate anywhere.
  // Identity (cart id, credential, and existing-vs-new line id) is resolved
  // inside the mutation from one fresh snapshot at execution time -- this
  // component never derives or passes any of it (see cart-line-identity.ts).
  function changeSimpleProductQuantity(
    productId: string,
    quantity: number,
    onAdded?: () => void,
  ) {
    if (!cart) return;
    setLineByContent.mutate(
      { productId, selections: [], quantity },
      {
        onError: (error) =>
          reportCartError(
            error,
            quantity <= 0
              ? "Couldn't update your cart."
              : "This item couldn't be added right now.",
          ),
        onSettled: onAdded,
      },
    );
  }

  function adjustConfigurableProductQuantity(productId: string, delta: number) {
    const existingLine = cart?.items.find(
      (item) => item.productId === productId,
    );
    if (!existingLine) return;
    const selections = existingLine.options.map((option) => ({
      optionId: option.optionId,
    }));
    updateExistingLine.mutate(
      { lineId: existingLine.id, productId, selections, delta },
      {
        onError: (error) =>
          reportCartError(error, "Couldn't update your cart."),
      },
    );
  }

  // `lineId` (and the productId/selections passed alongside it below) are a
  // reference to the line the customer is looking at, not identity -- the
  // mutation re-resolves the cart_id/credential/line-id it actually sends
  // from its own fresh snapshot, falling back to a content match if this
  // exact id is no longer there (see resolveExistingLine in
  // storefront-cart-mutations.ts).
  function changeCartLineQuantity(lineId: string, quantity: number) {
    const item = cart?.items.find((candidate) => candidate.id === lineId);
    if (!item) return;
    const selections = item.options.map((option) => ({
      optionId: option.optionId,
    }));
    if (quantity <= 0) {
      removeExistingLine.mutate(
        { lineId, productId: item.productId, selections },
        {
          onError: (error) =>
            reportCartError(error, "Couldn't update your cart."),
        },
      );
      return;
    }
    updateExistingLine.mutate(
      { lineId, productId: item.productId, selections, quantity },
      {
        onError: (error) =>
          reportCartError(error, "This item couldn't be updated right now."),
      },
    );
  }

  function openProductConfiguration(product: MenuProduct) {
    if ((product.optionGroups?.length ?? 0) > 0) {
      setConfigurationTarget({ productId: product.id });
      return;
    }
    // Same-tick peek purely for the "+1 to whatever's already there" default
    // shown to the user -- not an identity value. The mutation this calls
    // re-resolves everything fresh regardless of whether this peek is stale.
    const currentCart = readCurrentCart(queryClient, customerId);
    if (!currentCart) return;
    const existingQuantity =
      findLineByContent(currentCart, product.id, [])?.quantity ?? 0;
    changeSimpleProductQuantity(product.id, existingQuantity + 1);
  }

  function openConfigurationForLine(lineId: string) {
    const item = cart?.items.find((candidate) => candidate.id === lineId);
    if (item) setConfigurationTarget({ productId: item.productId, lineId });
  }

  function saveConfiguration(selections: CartLineOptionSelection[]) {
    if (!configurationProduct) return;
    const optionInputs = selections.map((selection) => ({
      optionId: selection.optionId,
    }));
    saveCartLineConfiguration.mutate(
      {
        sourceLineId: configurationTarget?.lineId,
        productId: configurationProduct.id,
        selections: optionInputs,
      },
      {
        onError: (error) =>
          reportCartError(error, "This item couldn't be added right now."),
      },
    );
    setConfigurationTarget(undefined);
  }

  async function saveAddress(draft: AddressDraft, editingId?: string) {
    if (!customerId) {
      // No customer to own the row yet - keep the draft in memory as the
      // guest's presumptive first (default) address until checkout carries
      // them through OTP verification.
      const address: DeliveryAddress = {
        ...draft,
        isDefault: true,
        id: "pending",
      };
      setPendingGuestAddress(address);
      return address.id;
    }
    const isFirstAddress =
      customerAddressesResource.isSuccess && savedAddresses.length === 0;
    const addressDraft = editingId
      ? draft
      : { ...draft, isDefault: isFirstAddress };
    return saveCustomerAddress.mutateAsync({
      draft: addressDraft,
      addressId: editingId,
    });
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
  async function materializePendingAddress(
    authenticatedCustomerId: string,
  ): Promise<DeliveryAddress | undefined> {
    if (!pendingGuestAddress) return undefined;
    try {
      const customerBusinessId = await resolveCustomerBusinessId(
        storefrontContext.businessId,
        authenticatedCustomerId,
      );
      const addressId = await createCustomerAddress(
        customerBusinessId,
        pendingGuestAddress,
      );
      const address: DeliveryAddress = {
        ...pendingGuestAddress,
        id: addressId,
      };
      setPendingGuestAddress(undefined);
      return address;
    } catch (error) {
      reportCartError(
        error,
        "We couldn't save your delivery address. Please try again.",
      );
      return undefined;
    }
  }

  function openAuth(request: AuthFlowRequest) {
    setAuthRequest({
      ...request,
      onCancel: () => {
        request.onCancel?.();
        setAuthRequest(undefined);
      },
      onSuccess: (phone, resolvedCustomerId) => {
        request.onSuccess(phone, resolvedCustomerId);
        setAuthRequest(undefined);
      },
    });
  }

  // Fire-and-forget from the caller's point of view (matches the pre-routing
  // "Order again" behaviour: navigate immediately, let this run in the
  // background) -- errors are reported the same way as every other cart
  // action, via cartActionError, rather than propagated to the caller.
  async function replaceCartWithOrder(order: StorefrontOrder) {
    if (!cart) return;
    try {
      // A list of candidate ids to attempt clearing, not an identity value --
      // each removal below resolves its own fresh cart id/credential
      // independently, so a stale entry here just no-ops instead of being
      // combined into a mismatched request (see cart-line-identity.ts).
      const existingItemIds = cart.items.map((item) => item.id);
      for (const itemId of existingItemIds) {
        await removeExistingLine.mutateAsync({ lineId: itemId });
      }
      for (const item of order.items) {
        const product = item.productId
          ? menu?.products.find((candidate) => candidate.id === item.productId)
          : undefined;
        if (!product) continue;
        await setLineByContent.mutateAsync({
          productId: product.id,
          selections: [],
          quantity: item.quantity,
        });
      }
    } catch (error) {
      reportCartError(error, "Couldn't reorder this order right now.");
    }
  }

  if (storefrontMenuResource.status === "error") {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" role="alert">
          <h1>Menu unavailable</h1>
          <p>{storefrontMenuResource.error.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void storefrontMenuResource.refetch()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (storefrontMenuResource.status === "pending" || !menu || !venue) {
    return (
      <main className="ordering-app">
        <section className="customer-empty-state" aria-busy="true">
          <h1>Loading menu</h1>
          <p>Getting the latest menu for this location.</p>
        </section>
      </main>
    );
  }

  const context: StorefrontLayoutContext = {
    venue,
    menu,
    cart,
    cartResource: { isPending: cartResource.isPending },
    lines,
    cartQuantities,
    cartItemCount,
    cartTotal,
    cartActionError,
    dismissCartError: () => setCartActionError(undefined),
    settings: settingsResource.data ?? null,
    customerDetails,
    savedAddresses,
    customerAddressesResource: {
      isPending: customerAddressesResource.isPending,
      isError: customerAddressesResource.isError,
      isSuccess: customerAddressesResource.isSuccess,
      refetch: () => void customerAddressesResource.refetch(),
    },
    pendingGuestAddress,
    checkout,
    ordersResource,
    currentOrders,
    pastOrders,
    openAuth,
    openProductConfiguration,
    openConfigurationForLine,
    viewProduct: (productId) => setViewingProductId(productId),
    changeSimpleProductQuantity,
    adjustConfigurableProductQuantity,
    changeCartLineQuantity,
    saveAddress,
    removeAddress,
    materializePendingAddress,
    replaceCartWithOrder,
  };

  return (
    <>
      <Outlet context={context} />
      {configurationProduct ? (
        <ProductConfigurationSheet
          initialSelections={configurationLine}
          isAcceptingOrders={venue.isAcceptingOrders}
          product={configurationProduct}
          onClose={() => setConfigurationTarget(undefined)}
          onConfirm={saveConfiguration}
        />
      ) : null}
      {viewingProduct ? (
        <ProductDetailSheet
          isAcceptingOrders={venue.isAcceptingOrders}
          locationName={venue.locationName}
          product={viewingProduct}
          onAdd={openProductConfiguration}
          onClose={() => setViewingProductId(undefined)}
        />
      ) : null}
      {authRequest ? <AuthFlowSheet request={authRequest} /> : null}
    </>
  );
}
