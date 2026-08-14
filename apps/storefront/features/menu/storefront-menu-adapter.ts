import type { Menu, StorefrontMenu, Venue } from "../../domain/storefront";

function displayNameFor(businessName: string) {
  return businessName.trim().split(/\s+/)[0] || businessName;
}

export function menuFromStorefrontMenu(storefrontMenu: StorefrontMenu): Menu {
  return {
    defaultPresentation: "list",
    allowPresentationChange: true,
    categories: storefrontMenu.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      imageUrl: "",
    })),
    products: storefrontMenu.categories.flatMap((category) =>
      category.products.map((product) => ({
        id: product.id,
        categoryId: category.id,
        name: product.name,
        description: product.description ?? "",
        price: product.basePrice,
        imageUrl: product.image ?? "",
        availability: product.available ? "available" : "sold-out",
        badges: product.dietaryType ? [product.dietaryType] : undefined,
        optionGroups: product.optionGroups,
      })),
    ),
    featuredProducts: storefrontMenu.featuredProducts,
  };
}

export function venueFromStorefrontMenu(storefrontMenu: StorefrontMenu): Venue {
  return {
    businessName: storefrontMenu.business.name,
    displayName: displayNameFor(storefrontMenu.business.name),
    locationName: storefrontMenu.location.name,
    locationDescription: `Order directly from ${storefrontMenu.location.name}.`,
    // Address and ordering-status settings are deliberately outside the menu
    // contract for now; this keeps the menu integration separate from checkout.
    address: storefrontMenu.location.name,
    orderingStatus: "Menu updated live",
    accentColor: "#9a3d28",
  };
}
