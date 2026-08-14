export type MenuPresentation = "list" | "grid";

export type ProductAvailability = "available" | "sold-out";

export interface Venue {
  businessName: string;
  displayName: string;
  locationName: string;
  locationDescription: string;
  address: string;
  orderingStatus: string;
  accentColor: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  availability: ProductAvailability;
  badges?: string[];
  configurable?: boolean;
}

export interface FeaturedProduct {
  productId: string;
  editorialLabel: string;
}

export interface Menu {
  defaultPresentation: MenuPresentation;
  allowPresentationChange: boolean;
  categories: MenuCategory[];
  products: MenuProduct[];
  featuredProducts: FeaturedProduct[];
}

export interface StorefrontDemo {
  venue: Venue;
  menu: Menu;
}

export function formatRupees(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function productsForCategory(menu: Menu, categoryId: string) {
  return menu.products.filter((product) => product.categoryId === categoryId);
}

export function productById(menu: Menu, productId: string) {
  return menu.products.find((product) => product.id === productId);
}
