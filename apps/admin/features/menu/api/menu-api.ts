import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
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

export async function getMenu(scope: MenuScope): Promise<MenuData> {
  const ordering = supabase.schema("ordering");
  const { data: categoryRows, error: categoryError } = await ordering
    .from("menu_categories")
    .select("id, name, description, sort_order, is_active, updated_at")
    .eq("business_id", scope.businessId)
    .eq("location_id", scope.locationId)
    .order("sort_order");
  throwIfError(categoryError);
  const categoryItems = categoryRows ?? [];

  const categoryIds = categoryItems.map((category) => category.id);
  if (!categoryIds.length) {
    return { categories: [], baseline: { categories: [], products: [] } };
  }

  const { data: productRows, error: productError } = await ordering
    .from("products")
    .select(
      "id, category_id, name, description, base_price, image_url, dietary_type, is_available, sort_order, prep_time_minutes, updated_at",
    )
    .eq("business_id", scope.businessId)
    .eq("is_active", true)
    .in("category_id", categoryIds)
    .order("sort_order");
  throwIfError(productError);
  const productItems = productRows ?? [];

  const productIds = productItems.map((product) => product.id);
  const [
    { data: productLocations, error: productLocationError },
    { data: windows, error: windowError },
  ] = await Promise.all([
    productIds.length
      ? ordering
          .from("product_locations")
          .select("product_id, is_available")
          .eq("location_id", scope.locationId)
          .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
    ordering
      .from("catalog_availability_windows")
      .select("category_id, product_id, day_of_week, starts_at, ends_at")
      .eq("location_id", scope.locationId),
  ]);
  throwIfError(productLocationError);
  throwIfError(windowError);
  const productLocationItems = productLocations ?? [];
  const availabilityWindows = windows ?? [];

  const [{ data: productGroupLinks, error: productGroupLinkError }] =
    await Promise.all([
      productIds.length
        ? ordering
            .from("product_option_groups")
            .select("product_id, option_group_id, sort_order")
            .in("product_id", productIds)
            .order("sort_order")
        : Promise.resolve({ data: [], error: null }),
    ]);
  throwIfError(productGroupLinkError);
  const productGroupLinkItems = productGroupLinks ?? [];

  const optionGroupIds = productGroupLinkItems.map(
    (link) => link.option_group_id,
  );
  const [
    { data: optionGroups, error: optionGroupError },
    { data: optionRows, error: optionError },
  ] = await Promise.all([
    optionGroupIds.length
      ? ordering
          .from("option_groups")
          .select(
            "id, name, selection_type, min_selections, max_selections, sort_order",
          )
          .eq("business_id", scope.businessId)
          .eq("is_active", true)
          .in("id", optionGroupIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    optionGroupIds.length
      ? ordering
          .from("options")
          .select(
            "id, option_group_id, name, price_delta, is_available, sort_order",
          )
          .eq("is_active", true)
          .in("option_group_id", optionGroupIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwIfError(optionGroupError);
  throwIfError(optionError);
  const optionGroupItems = optionGroups ?? [];
  const optionItems = optionRows ?? [];

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

  const { error } = await supabase.schema("ordering").rpc("save_menu_changes", {
    p_business_id: scope.businessId,
    p_location_id: scope.locationId,
    p_baseline: rpcBaseline,
    p_menu: menu,
  });
  throwIfError(error);
}
