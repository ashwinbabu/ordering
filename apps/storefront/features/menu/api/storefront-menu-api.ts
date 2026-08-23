import type { Json } from "../../../lib/supabase/database.types";
import { getSupabaseClient } from "../../../lib/supabase/client";
import {
  readArray,
  readBoolean,
  readNullableString,
  readNumber,
  readRecord,
  readString,
} from "../../../lib/supabase/json-parsing";
import type {
  FeaturedProduct,
  StorefrontMenu,
  StorefrontMenuCategory,
  StorefrontMenuOption,
  StorefrontMenuOptionGroup,
  StorefrontMenuProduct,
} from "../../../domain/storefront";

interface FeaturedProductRow {
  product_id: string;
  sort_order: number;
}

function parseOption(value: Json): StorefrontMenuOption {
  const option = readRecord(value, "A storefront menu option");
  return {
    id: readString(option.id, "A storefront menu option ID"),
    name: readString(option.name, "A storefront menu option name"),
    priceDelta: readNumber(
      option.priceDelta,
      "A storefront menu option price delta",
    ),
    available: readBoolean(
      option.available,
      "A storefront menu option availability",
    ),
    sortOrder: readNumber(
      option.sortOrder,
      "A storefront menu option sort order",
    ),
  };
}

function parseOptionGroup(value: Json): StorefrontMenuOptionGroup {
  const group = readRecord(value, "A storefront menu option group");
  const selectionType = readString(
    group.selectionType,
    "A storefront menu option group selection type",
  );

  if (selectionType !== "single" && selectionType !== "multiple") {
    throw new Error(
      "A storefront menu option group selection type is invalid.",
    );
  }

  return {
    id: readString(group.id, "A storefront menu option group ID"),
    name: readString(group.name, "A storefront menu option group name"),
    selectionType,
    minSelections: readNumber(
      group.minSelections,
      "A storefront menu option group minimum",
    ),
    maxSelections: readNumber(
      group.maxSelections,
      "A storefront menu option group maximum",
    ),
    sortOrder: readNumber(
      group.sortOrder,
      "A storefront menu option group sort order",
    ),
    options: readArray(
      group.options,
      "A storefront menu option group options",
    ).map(parseOption),
  };
}

function parseProduct(value: Json): StorefrontMenuProduct {
  const product = readRecord(value, "A storefront menu product");
  return {
    id: readString(product.id, "A storefront menu product ID"),
    name: readString(product.name, "A storefront menu product name"),
    description: readNullableString(
      product.description,
      "A storefront menu product description",
    ),
    basePrice: readNumber(
      product.basePrice,
      "A storefront menu product base price",
    ),
    image: readNullableString(product.image, "A storefront menu product image"),
    dietaryType: readNullableString(
      product.dietaryType,
      "A storefront menu product dietary type",
    ),
    available: readBoolean(
      product.available,
      "A storefront menu product availability",
    ),
    sortOrder: readNumber(
      product.sortOrder,
      "A storefront menu product sort order",
    ),
    optionGroups: readArray(
      product.optionGroups,
      "A storefront menu product option groups",
    ).map(parseOptionGroup),
  };
}

function parseCategory(value: Json): StorefrontMenuCategory {
  const category = readRecord(value, "A storefront menu category");
  return {
    id: readString(category.id, "A storefront menu category ID"),
    name: readString(category.name, "A storefront menu category name"),
    description: readNullableString(
      category.description,
      "A storefront menu category description",
    ),
    sortOrder: readNumber(
      category.sortOrder,
      "A storefront menu category sort order",
    ),
    products: readArray(
      category.products,
      "A storefront menu category products",
    ).map(parseProduct),
  };
}

function parseFeaturedProductRows(value: unknown): FeaturedProduct[] {
  if (!Array.isArray(value)) {
    throw new Error("The featured products response is invalid.");
  }

  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Featured product row ${index + 1} is invalid.`);
    }

    const featuredProduct = row as Partial<FeaturedProductRow>;
    if (
      typeof featuredProduct.product_id !== "string" ||
      typeof featuredProduct.sort_order !== "number"
    ) {
      throw new Error(`Featured product row ${index + 1} is invalid.`);
    }

    return {
      productId: featuredProduct.product_id,
      editorialLabel: "",
    };
  });
}

function parseStorefrontMenu(value: Json): StorefrontMenu {
  const menu = readRecord(value, "The storefront menu response");
  const business = readRecord(menu.business, "The storefront menu business");
  const location = readRecord(menu.location, "The storefront menu location");

  if (
    readNumber(menu.schemaVersion, "The storefront menu schema version") !== 1
  ) {
    throw new Error("The storefront menu schema version is unsupported.");
  }

  return {
    schemaVersion: 1,
    // Read leniently so the client stays deployable ahead of the migration that
    // adds this field. Absent means accepting orders, matching the Admin default.
    orderingEnabled:
      typeof menu.orderingEnabled === "boolean" ? menu.orderingEnabled : true,
    business: {
      id: readString(business.id, "The storefront menu business ID"),
      name: readString(business.name, "The storefront menu business name"),
      slug: readString(business.slug, "The storefront menu business slug"),
      currency: readString(business.currency, "The storefront menu currency"),
      // Read leniently so the client stays deployable ahead of the migration that
      // adds this field. Absent means no logo, matching the current "no logo" UI.
      logoUrl: typeof business.logoUrl === "string" ? business.logoUrl : null,
    },
    location: {
      id: readString(location.id, "The storefront menu location ID"),
      name: readString(location.name, "The storefront menu location name"),
    },
    categories: readArray(
      menu.categories,
      "The storefront menu categories",
    ).map(parseCategory),
    featuredProducts: [],
  };
}

/**
 * Reads the public, location-scoped Storefront catalog boundary. A null result
 * means the requested location is missing or not publicly orderable.
 */
export async function getStorefrontMenu(
  locationId: string,
): Promise<StorefrontMenu | null> {
  const client = getSupabaseClient().schema("ordering");
  const now = new Date().toISOString();
  const [menuResult, featuredProductsResult] = await Promise.all([
    client.rpc("get_storefront_menu", { p_location_id: locationId }),
    client
      // The generated schema snapshot predates this newly-added table.
      .from("location_featured_products" as never)
      .select("product_id, sort_order")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order("sort_order", { ascending: true }),
  ]);

  if (menuResult.error) throw menuResult.error;
  if (featuredProductsResult.error) throw featuredProductsResult.error;
  if (menuResult.data === null) return null;

  const menu = parseStorefrontMenu(menuResult.data);
  return {
    ...menu,
    featuredProducts: parseFeaturedProductRows(featuredProductsResult.data),
  };
}
