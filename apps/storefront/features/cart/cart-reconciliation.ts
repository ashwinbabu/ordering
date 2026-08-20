import type {
  CartLineView,
  ServerCart,
  ServerCartItem,
} from "../../domain/cart";
import type {
  CartLineOptionSelection,
  Menu,
  MenuProduct,
} from "../../domain/storefront";

// ordering.get_cart always returns current pricing for a cart line (it joins
// live product/option rows), so a restored cart never displays a stale
// price. It does not say whether the product or a selected option is still
// orderable -- that is derived here by cross-referencing the same live menu
// the rest of the storefront already uses, so there is one source of truth
// for "is this product available right now."
function reconcileItem(
  item: ServerCartItem,
  menuProductsById: Map<string, MenuProduct>,
): CartLineView {
  const menuProduct = menuProductsById.get(item.productId);
  const unitPrice = item.baseUnitPrice + item.modifierUnitTotal;

  if (!menuProduct) {
    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      customerNote: item.customerNote,
      unitPrice,
      lineTotal: item.estimatedLineTotal,
      options: item.options,
      isAvailable: false,
      unavailableReason: "product-removed",
      hasOptionGroups: false,
    };
  }

  if (menuProduct.availability !== "available") {
    return {
      id: item.id,
      productId: item.productId,
      productName: menuProduct.name,
      imageUrl: menuProduct.imageUrl,
      quantity: item.quantity,
      customerNote: item.customerNote,
      unitPrice,
      lineTotal: item.estimatedLineTotal,
      options: item.options,
      isAvailable: false,
      unavailableReason: "product-unavailable",
      hasOptionGroups: (menuProduct.optionGroups?.length ?? 0) > 0,
    };
  }

  const currentOptionIds = new Set(
    (menuProduct.optionGroups ?? []).flatMap((group) =>
      group.options
        .filter((option) => option.available)
        .map((option) => option.id),
    ),
  );
  const hasRemovedOption = item.options.some(
    (option) => !currentOptionIds.has(option.optionId),
  );

  return {
    id: item.id,
    productId: item.productId,
    productName: menuProduct.name,
    imageUrl: menuProduct.imageUrl,
    quantity: item.quantity,
    customerNote: item.customerNote,
    unitPrice,
    lineTotal: item.estimatedLineTotal,
    options: item.options,
    isAvailable: !hasRemovedOption,
    unavailableReason: hasRemovedOption ? "option-unavailable" : undefined,
    hasOptionGroups: (menuProduct.optionGroups?.length ?? 0) > 0,
  };
}

export function reconcileCartLines(
  cart: ServerCart | undefined,
  menu: Menu | null,
): CartLineView[] {
  if (!cart) return [];
  const menuProductsById = new Map(
    menu?.products.map((product) => [product.id, product]) ?? [],
  );
  return cart.items.map((item) => reconcileItem(item, menuProductsById));
}

// Rehydrates the configuration sheet's initial selections (group/option
// names) for an existing line by looking the selected option ids back up in
// the current menu -- the server cart itself only carries option id/price.
export function selectionsFromServerItem(
  item: ServerCartItem,
  product: MenuProduct,
): CartLineOptionSelection[] {
  return item.options.flatMap((option) => {
    for (const group of product.optionGroups ?? []) {
      const match = group.options.find(
        (candidate) => candidate.id === option.optionId,
      );
      if (match) {
        return [
          {
            groupId: group.id,
            optionId: option.optionId,
            groupName: group.name,
            optionName: match.name,
            priceDelta: option.priceDelta,
          },
        ];
      }
    }
    return [];
  });
}
