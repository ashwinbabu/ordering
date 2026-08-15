import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  DAYS,
  scheduleSummaryFor,
  type Category,
  type Product,
  type ScheduleMode,
  type VariantGroup,
} from "@/features/menu/menu-model";

export interface MenuBaseline {
  categories: Array<{ id: string; updatedAt: string }>;
  products: Array<{ id: string; updatedAt: string }>;
}

export interface MenuData {
  categories: Category[];
  baseline: MenuBaseline;
}

interface MenuScope {
  businessId: string;
  locationId: string;
}

interface SaveMenuInput {
  scope: MenuScope;
  baseline: MenuBaseline;
  categories: Category[];
}

type OrderingTables = Database["ordering"]["Tables"];
type MenuCategoryRow = Pick<
  OrderingTables["menu_categories"]["Row"],
  "id" | "name" | "description" | "sort_order" | "is_active" | "updated_at"
>;
type MenuProductRow = Pick<
  OrderingTables["products"]["Row"],
  | "id"
  | "category_id"
  | "name"
  | "description"
  | "base_price"
  | "image_url"
  | "dietary_type"
  | "is_available"
  | "sort_order"
  | "prep_time_minutes"
  | "updated_at"
>;
type ProductLocationRow = Pick<
  OrderingTables["product_locations"]["Row"],
  "product_id" | "is_available"
>;
type AvailabilityWindowRow = Pick<
  OrderingTables["catalog_availability_windows"]["Row"],
  "category_id" | "product_id" | "day_of_week" | "starts_at" | "ends_at"
>;
type ProductOptionGroupRow = Pick<
  OrderingTables["product_option_groups"]["Row"],
  "product_id" | "option_group_id" | "sort_order"
>;
type OptionGroupRow = Pick<
  OrderingTables["option_groups"]["Row"],
  | "id"
  | "name"
  | "selection_type"
  | "min_selections"
  | "max_selections"
  | "sort_order"
>;
type OptionRow = Pick<
  OrderingTables["options"]["Row"],
  "id" | "option_group_id" | "name" | "price_delta" | "is_available" | "sort_order"
>;

interface MenuAggregate {
  categories: MenuCategoryRow[];
  products: MenuProductRow[];
  productLocations: ProductLocationRow[];
  availabilityWindows: AvailabilityWindowRow[];
  productOptionGroups: ProductOptionGroupRow[];
  optionGroups: OptionGroupRow[];
  options: OptionRow[];
}

type ScheduledMenuItem = Pick<
  Category,
  "scheduleMode" | "scheduleStart" | "scheduleEnd" | "scheduleDays"
>;

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

function scheduleFromWindows(
  windows: Array<{ day_of_week: number; starts_at: string; ends_at: string }>,
): Pick<
  Category,
  | "scheduleMode"
  | "scheduleSummary"
  | "scheduleStart"
  | "scheduleEnd"
  | "scheduleDays"
> {
  if (!windows.length) {
    return {
      scheduleMode: "restaurant",
      scheduleSummary: "All restaurant hours",
      scheduleStart: "",
      scheduleEnd: "",
      scheduleDays: DAYS,
    };
  }

  const [firstWindow] = windows;
  const scheduleDays = DAYS.filter((_, index) =>
    windows.some((window) => window.day_of_week === index + 1),
  );
  const scheduleMode: ScheduleMode =
    scheduleDays.length === DAYS.length ? "same" : "different";
  const schedule = {
    scheduleMode,
    scheduleStart: firstWindow.starts_at.slice(0, 5),
    scheduleEnd: firstWindow.ends_at.slice(0, 5),
    scheduleDays,
  };

  return {
    ...schedule,
    scheduleSummary: scheduleSummaryFor(schedule),
  };
}

function appendWindow<T extends ScheduledMenuItem>(
  target: { category_id?: string; product_id?: string },
  item: T,
): Array<{
  category_id?: string;
  product_id?: string;
  day_of_week: number;
  starts_at: string;
  ends_at: string;
}> {
  if (
    item.scheduleMode === "restaurant" ||
    !item.scheduleStart ||
    !item.scheduleEnd
  )
    return [];
  const scheduleDays = item.scheduleMode === "same" ? DAYS : item.scheduleDays;
  return scheduleDays.map((day) => ({
    ...target,
    day_of_week: DAYS.indexOf(day) + 1,
    starts_at: item.scheduleStart,
    ends_at: item.scheduleEnd,
  }));
}

function imageUrlForSave(image: string | undefined) {
  return image?.startsWith("https://") ? image : null;
}

type JsonObject = { [key: string]: Json | undefined };

function parseJsonObject(value: Json | null, message: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value;
}

function parseJsonArray(value: Json | undefined, message: string): Json[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function readString(row: JsonObject, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new Error(`The menu response has an invalid ${key} value.`);
  }
  return value;
}

function readNullableString(row: JsonObject, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`The menu response has an invalid ${key} value.`);
  }
  return value;
}

function readNumber(row: JsonObject, key: string): number {
  const value = row[key];
  if (typeof value !== "number") {
    throw new Error(`The menu response has an invalid ${key} value.`);
  }
  return value;
}

function readNullableNumber(row: JsonObject, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number") {
    throw new Error(`The menu response has an invalid ${key} value.`);
  }
  return value;
}

function readBoolean(row: JsonObject, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") {
    throw new Error(`The menu response has an invalid ${key} value.`);
  }
  return value;
}

function parseRows<T>(
  value: Json | undefined,
  key: string,
  parseRow: (row: JsonObject) => T,
): T[] {
  return parseJsonArray(value, `The menu response is missing ${key}.`).map(
    (item) => parseRow(parseJsonObject(item, `The menu response has an invalid ${key} row.`)),
  );
}

function parseMenuAggregate(data: Json | null): MenuAggregate {
  const response = parseJsonObject(data, "The menu response is invalid.");
  if (response.schema_version !== 1) {
    throw new Error("The menu response has an unsupported schema version.");
  }

  return {
    categories: parseRows(response.categories, "categories", (row) => ({
      id: readString(row, "id"),
      name: readString(row, "name"),
      description: readNullableString(row, "description"),
      sort_order: readNumber(row, "sort_order"),
      is_active: readBoolean(row, "is_active"),
      updated_at: readString(row, "updated_at"),
    })),
    products: parseRows(response.products, "products", (row) => ({
      id: readString(row, "id"),
      category_id: readString(row, "category_id"),
      name: readString(row, "name"),
      description: readNullableString(row, "description"),
      base_price: readNumber(row, "base_price"),
      image_url: readNullableString(row, "image_url"),
      dietary_type: readNullableString(row, "dietary_type"),
      is_available: readBoolean(row, "is_available"),
      sort_order: readNumber(row, "sort_order"),
      prep_time_minutes: readNullableNumber(row, "prep_time_minutes"),
      updated_at: readString(row, "updated_at"),
    })),
    productLocations: parseRows(
      response.product_locations,
      "product_locations",
      (row) => ({
        product_id: readString(row, "product_id"),
        is_available: readBoolean(row, "is_available"),
      }),
    ),
    availabilityWindows: parseRows(
      response.availability_windows,
      "availability_windows",
      (row) => ({
        category_id: readNullableString(row, "category_id"),
        product_id: readNullableString(row, "product_id"),
        day_of_week: readNumber(row, "day_of_week"),
        starts_at: readString(row, "starts_at"),
        ends_at: readString(row, "ends_at"),
      }),
    ),
    productOptionGroups: parseRows(
      response.product_option_groups,
      "product_option_groups",
      (row) => ({
        product_id: readString(row, "product_id"),
        option_group_id: readString(row, "option_group_id"),
        sort_order: readNumber(row, "sort_order"),
      }),
    ),
    optionGroups: parseRows(response.option_groups, "option_groups", (row) => ({
      id: readString(row, "id"),
      name: readString(row, "name"),
      selection_type: readString(row, "selection_type"),
      min_selections: readNumber(row, "min_selections"),
      max_selections: readNumber(row, "max_selections"),
      sort_order: readNumber(row, "sort_order"),
    })),
    options: parseRows(response.options, "options", (row) => ({
      id: readString(row, "id"),
      option_group_id: readString(row, "option_group_id"),
      name: readString(row, "name"),
      price_delta: readNumber(row, "price_delta"),
      is_available: readBoolean(row, "is_available"),
      sort_order: readNumber(row, "sort_order"),
    })),
  };
}

function parseMenuBaseline(data: Json | null): MenuBaseline {
  const response = parseJsonObject(data, "The saved menu response is invalid.");

  return {
    categories: parseRows(response.categories, "categories", (row) => ({
      id: readString(row, "id"),
      updatedAt: readString(row, "updated_at"),
    })),
    products: parseRows(response.products, "products", (row) => ({
      id: readString(row, "id"),
      updatedAt: readString(row, "updated_at"),
    })),
  };
}

function parseFeaturedProductIds(data: Json | null): string[] {
  if (!Array.isArray(data) || !data.every((item) => typeof item === "string")) {
    throw new Error("The featured products response is invalid.");
  }
  return data;
}

export async function getMenu(scope: MenuScope): Promise<MenuData> {
  const [menuResponse, featuredResponse] = await Promise.all([
    supabase.schema("ordering").rpc("get_menu", {
      p_business_id: scope.businessId,
      p_location_id: scope.locationId,
    }),
    supabase.schema("ordering").rpc("get_featured_product_ids", {
      p_business_id: scope.businessId,
      p_location_id: scope.locationId,
    }),
  ]);
  throwIfError(menuResponse.error);
  throwIfError(featuredResponse.error);
  const data = menuResponse.data;
  const featuredProductIds = new Set(parseFeaturedProductIds(featuredResponse.data));
  const {
    categories: categoryItems,
    products: productItems,
    productLocations: productLocationItems,
    availabilityWindows,
    productOptionGroups: productGroupLinkItems,
    optionGroups: optionGroupItems,
    options: optionItems,
  } = parseMenuAggregate(data);

  const categoryIds = categoryItems.map((category) => category.id);
  const productIds = productItems.map((product) => product.id);

  const availabilityByProductId = new Map(
    productLocationItems.map((location) => [
      location.product_id,
      location.is_available,
    ]),
  );
  const windowsByCategoryId = new Map<string, typeof availabilityWindows>();
  const windowsByProductId = new Map<string, typeof availabilityWindows>();
  for (const window of availabilityWindows) {
    if (window.category_id && categoryIds.includes(window.category_id)) {
      const entries = windowsByCategoryId.get(window.category_id) ?? [];
      entries.push(window);
      windowsByCategoryId.set(window.category_id, entries);
    }
    if (window.product_id && productIds.includes(window.product_id)) {
      const entries = windowsByProductId.get(window.product_id) ?? [];
      entries.push(window);
      windowsByProductId.set(window.product_id, entries);
    }
  }

  const optionGroupById = new Map(
    optionGroupItems.map((group) => [group.id, group]),
  );
  const optionsByGroupId = new Map<string, typeof optionItems>();
  for (const option of optionItems) {
    const entries = optionsByGroupId.get(option.option_group_id) ?? [];
    entries.push(option);
    optionsByGroupId.set(option.option_group_id, entries);
  }
  const groupsByProductId = new Map<string, VariantGroup[]>();
  for (const link of productGroupLinkItems) {
    const group = optionGroupById.get(link.option_group_id);
    if (!group) continue;
    const entries = groupsByProductId.get(link.product_id) ?? [];
    entries.push({
      id: group.id,
      name: group.name,
      type: group.selection_type === "multiple" ? "multi" : "single",
      required: group.min_selections > 0,
      min: group.min_selections,
      max: group.max_selections,
      catalogSortOrder: group.sort_order,
      options: (optionsByGroupId.get(group.id) ?? []).map((option) => ({
        id: option.id,
        name: option.name,
        price: option.price_delta,
        available: option.is_available,
      })),
    });
    groupsByProductId.set(link.product_id, entries);
  }

  const productsByCategoryId = new Map<string, Product[]>();
  for (const product of productItems) {
    const schedule = scheduleFromWindows(
      windowsByProductId.get(product.id) ?? [],
    );
    const entries = productsByCategoryId.get(product.category_id) ?? [];
    entries.push({
      id: product.id,
      categoryId: product.category_id,
      name: product.name,
      description: product.description ?? "",
      price: product.base_price,
      prepTimeMinutes: product.prep_time_minutes,
      foodType:
        product.dietary_type === "Egg" || product.dietary_type === "Non-veg"
          ? product.dietary_type
          : "Veg",
      tag: "",
      catalogAvailable: product.is_available,
      available:
        availabilityByProductId.get(product.id) ?? product.is_available,
      scheduledUnavailable: false,
      ...schedule,
      image: product.image_url ?? undefined,
      featured: featuredProductIds.has(product.id),
      variantGroups: groupsByProductId.get(product.id) ?? [],
    });
    productsByCategoryId.set(product.category_id, entries);
  }

  return {
    categories: categoryItems.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      available: category.is_active,
      ...scheduleFromWindows(windowsByCategoryId.get(category.id) ?? []),
      products: productsByCategoryId.get(category.id) ?? [],
    })),
    baseline: {
      categories: categoryItems.map((category) => ({
        id: category.id,
        updatedAt: category.updated_at,
      })),
      products: productItems.map((product) => ({
        id: product.id,
        updatedAt: product.updated_at,
      })),
    },
  };
}

export async function saveMenuChanges({
  scope,
  baseline,
  categories,
}: SaveMenuInput) {
  const products = categories.flatMap((category) => category.products);
  const productIds = new Set(products.map((product) => product.id));
  const removedProductIds = baseline.products
    .map((product) => product.id)
    .filter((productId) => !productIds.has(productId));
  const productOptionGroups = products.flatMap((product) =>
    product.variantGroups.map((group, sortOrder) => ({
      product_id: product.id,
      option_group_id: group.id,
      sort_order: sortOrder,
    })),
  );
  const optionGroupsById = new Map<
    string,
    { group: VariantGroup; sortOrder: number }
  >();
  for (const link of productOptionGroups) {
    const group = products
      .find((product) => product.id === link.product_id)
      ?.variantGroups.find((entry) => entry.id === link.option_group_id);
    if (group && !optionGroupsById.has(group.id)) {
      optionGroupsById.set(group.id, { group, sortOrder: link.sort_order });
    }
  }

  const menu: Json = {
    categories: categories.map((category, index) => ({
      id: category.id,
      name: category.name.trim(),
      description: category.description?.trim() || null,
      sort_order: index,
      is_active: category.available,
    })),
    products: products.map((product) => ({
      id: product.id,
      category_id: product.categoryId,
      name: product.name.trim(),
      description: product.description.trim() || null,
      base_price: product.price,
      image_url: imageUrlForSave(product.image),
      dietary_type: product.foodType,
      is_available: product.catalogAvailable ?? product.available,
      location_is_available: product.available,
      sort_order:
        categories
          .find((category) => category.id === product.categoryId)
          ?.products.findIndex((entry) => entry.id === product.id) ?? 0,
      prep_time_minutes: product.prepTimeMinutes ?? null,
    })),
    option_groups: Array.from(optionGroupsById.values()).map(
      ({ group, sortOrder }) => ({
        id: group.id,
        name: group.name.trim(),
        selection_type: group.type === "multi" ? "multiple" : "single",
        min_selections: group.required ? Math.max(1, group.min) : group.min,
        max_selections: group.type === "single" ? 1 : group.max,
        sort_order: group.catalogSortOrder ?? sortOrder,
        options: group.options.map((option, optionIndex) => ({
          id: option.id,
          name: option.name.trim(),
          price_delta: option.price,
          is_available: option.available,
          sort_order: optionIndex,
        })),
      }),
    ),
    product_option_groups: productOptionGroups,
    category_availability_windows: categories.flatMap((category) =>
      appendWindow({ category_id: category.id }, category),
    ),
    product_availability_windows: products.flatMap((product) =>
      appendWindow({ product_id: product.id }, product),
    ),
    removed_product_ids: removedProductIds,
  };
  const rpcBaseline: Json = {
    categories: baseline.categories.map((category) => ({
      id: category.id,
      updated_at: category.updatedAt,
    })),
    products: baseline.products.map((product) => ({
      id: product.id,
      updated_at: product.updatedAt,
    })),
  };

  const { data, error } = await supabase
    .schema("ordering")
    .rpc("save_menu_changes_with_baseline", {
      p_business_id: scope.businessId,
      p_location_id: scope.locationId,
      p_baseline: rpcBaseline,
      p_menu: menu,
      p_featured_product_ids: products
        .filter((product) => product.featured)
        .map((product) => product.id),
    });
  throwIfError(error);
  return parseMenuBaseline(data);
}

export async function setCategoryAvailability(input: {
  businessId: string;
  locationId: string;
  categoryId: string;
  isActive: boolean;
}): Promise<{ categoryId: string; updatedAt: string }> {
  // updated_at is not set here: an ordering.menu_categories trigger stamps
  // it with the server's now() on every update, so a client-supplied value
  // would only be overwritten.
  const { data, error } = await supabase
    .schema("ordering")
    .from("menu_categories")
    .update({ is_active: input.isActive })
    .eq("id", input.categoryId)
    .eq("business_id", input.businessId)
    .eq("location_id", input.locationId)
    .select("id, updated_at")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Could not update category availability.");
  return { categoryId: data.id, updatedAt: data.updated_at };
}

export async function setProductAvailabilityAtLocation(input: {
  locationId: string;
  productId: string;
  isAvailable: boolean;
}): Promise<void> {
  const { data, error } = await supabase
    .schema("ordering")
    .from("product_locations")
    .update({ is_available: input.isAvailable })
    .eq("product_id", input.productId)
    .eq("location_id", input.locationId)
    .select("product_id")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Could not update product availability.");
}
