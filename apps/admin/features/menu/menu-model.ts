export type FoodType = "Veg" | "Non-veg" | "Egg";
export type ScheduleMode = "restaurant" | "same" | "different";

export interface VariantOption {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

export interface VariantGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  min: number;
  max: number;
  catalogSortOrder?: number;
  options: VariantOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  prepTimeMinutes?: number | null;
  foodType: FoodType;
  tag: string;
  catalogAvailable?: boolean;
  available: boolean;
  scheduledUnavailable: boolean;
  scheduleMode: ScheduleMode;
  scheduleSummary: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleDays: string[];
  image?: string;
  featured?: boolean;
  variantGroups: VariantGroup[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  available: boolean;
  scheduleMode: ScheduleMode;
  scheduleSummary: string;
  scheduleStart: string;
  scheduleEnd: string;
  scheduleDays: string[];
  products: Product[];
}

export type CategoryDialog =
  | { type: "add" }
  | { type: "rename"; categoryId: string }
  | { type: "schedule"; categoryId: string }
  | { type: "delete"; categoryId: string }
  | null;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduledAvailability = Pick<
  Category,
  "scheduleMode" | "scheduleStart" | "scheduleEnd" | "scheduleDays"
>;

/**
 * Mirrors the storefront's availability-window check in the outlet's timezone.
 * An item without a custom schedule remains available throughout restaurant
 * hours; its manual availability is evaluated separately by the caller.
 */
export function isScheduleActive(
  item: ScheduledAvailability,
  timezone: string,
  now = new Date(),
) {
  if (
    item.scheduleMode === "restaurant" ||
    !item.scheduleStart ||
    !item.scheduleEnd
  ) {
    return true;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const day = values.weekday;
  const time = `${values.hour}:${values.minute}`;

  return (
    item.scheduleDays.includes(day) &&
    time >= item.scheduleStart &&
    time < item.scheduleEnd
  );
}

const burgerVariants: VariantGroup[] = [
  {
    id: "size",
    name: "Choose a size",
    type: "single",
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: "classic", name: "Classic", price: 0, available: true },
      { id: "double", name: "Double patty", price: 140, available: true },
    ],
  },
  {
    id: "extras",
    name: "Add something extra",
    type: "multi",
    required: false,
    min: 0,
    max: 2,
    options: [
      { id: "cheese", name: "Cheese", price: 40, available: true },
      { id: "egg", name: "Fried egg", price: 55, available: true },
    ],
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: "burgers",
    name: "Burgers & wraps",
    available: true,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [
      {
        id: "cafreal-burger",
        name: "Chicken Cafreal Burger",
        description:
          "Goan cafreal chicken, pickled onions, lettuce and house mayo in a toasted bun.",
        categoryId: "burgers",
        price: 280,
        foodType: "Non-veg",
        tag: "Best seller",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: burgerVariants,
      },
      {
        id: "paneer-wrap",
        name: "Paneer Tikka Wrap",
        description:
          "Charred paneer tikka, mint chutney, onions and crisp lettuce.",
        categoryId: "burgers",
        price: 230,
        foodType: "Veg",
        tag: "Chef’s pick",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
      {
        id: "mushroom-burger",
        name: "Mushroom Melt Burger",
        description:
          "Peppery mushrooms, caramelised onions and melted cheddar.",
        categoryId: "burgers",
        price: 250,
        foodType: "Veg",
        tag: "",
        available: false,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "beverages",
    name: "Beverages",
    available: true,
    scheduleMode: "same",
    scheduleSummary: "Daily, 4:00 PM–6:00 PM",
    scheduleStart: "16:00",
    scheduleEnd: "18:00",
    scheduleDays: DAYS,
    products: [
      {
        id: "rose-milk",
        name: "Rose Milk",
        description: "Chilled milk, rose syrup and a touch of cardamom.",
        categoryId: "beverages",
        price: 120,
        foodType: "Veg",
        tag: "Best seller",
        available: true,
        scheduledUnavailable: true,
        scheduleMode: "different",
        scheduleSummary: "Mon–Tue, 5:00 PM–6:00 PM",
        scheduleStart: "17:00",
        scheduleEnd: "18:00",
        scheduleDays: ["Mon", "Tue"],
        variantGroups: [],
      },
      {
        id: "lime-soda",
        name: "Fresh Lime Soda",
        description: "Fresh lime with soda, served sweet, salted or mixed.",
        categoryId: "beverages",
        price: 100,
        foodType: "Veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "same",
        scheduleSummary: "Daily, 4:00 PM–6:00 PM",
        scheduleStart: "16:00",
        scheduleEnd: "18:00",
        scheduleDays: DAYS,
        variantGroups: [
          {
            id: "style",
            name: "Choose lime soda style",
            type: "single",
            required: true,
            min: 1,
            max: 1,
            options: [
              { id: "sweet", name: "Sweet", price: 0, available: true },
              { id: "salted", name: "Salted", price: 0, available: true },
              {
                id: "mixed",
                name: "Sweet & salted",
                price: 0,
                available: true,
              },
            ],
          },
        ],
      },
      {
        id: "cold-coffee",
        name: "Cold Coffee",
        description: "Strong coffee blended with chilled milk and ice.",
        categoryId: "beverages",
        price: 180,
        foodType: "Veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "same",
        scheduleSummary: "Daily, 4:00 PM–6:00 PM",
        scheduleStart: "16:00",
        scheduleEnd: "18:00",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "bowls",
    name: "Rice bowls",
    available: false,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [
      {
        id: "cafreal-bowl",
        name: "Chicken Cafreal Rice Bowl",
        description: "Cafreal chicken, jeera rice, cabbage slaw and lime.",
        categoryId: "bowls",
        price: 320,
        foodType: "Non-veg",
        tag: "",
        available: true,
        scheduledUnavailable: false,
        scheduleMode: "restaurant",
        scheduleSummary: "All restaurant hours",
        scheduleStart: "",
        scheduleEnd: "",
        scheduleDays: DAYS,
        variantGroups: [],
      },
    ],
  },
  {
    id: "desserts",
    name: "Desserts",
    available: true,
    scheduleMode: "restaurant",
    scheduleSummary: "All restaurant hours",
    scheduleStart: "",
    scheduleEnd: "",
    scheduleDays: DAYS,
    products: [],
  },
];

export function cloneCategories(categories: Category[]) {
  return JSON.parse(JSON.stringify(categories)) as Category[];
}

export function createMenuId() {
  return crypto.randomUUID();
}

export function duplicateMenuProduct(
  product: Product,
  categoryId = product.categoryId,
): Product {
  return {
    ...(JSON.parse(JSON.stringify(product)) as Product),
    id: createMenuId(),
    categoryId,
    variantGroups: product.variantGroups.map((group) => ({
      ...(JSON.parse(JSON.stringify(group)) as VariantGroup),
      id: createMenuId(),
      options: group.options.map((option) => ({
        ...(JSON.parse(JSON.stringify(option)) as VariantOption),
        id: createMenuId(),
      })),
    })),
  };
}

export function priceFromInput(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function effectiveProductState(category: Category, product: Product) {
  if (!category.available) return "Unavailable — category off";
  if (!product.available) return "Unavailable";
  return "Available";
}

export function scheduleSummaryFor(
  product: Pick<
    Product,
    "scheduleMode" | "scheduleStart" | "scheduleEnd" | "scheduleDays"
  >,
) {
  if (product.scheduleMode === "restaurant") return "All restaurant hours";
  const start = product.scheduleStart || "16:00";
  const end = product.scheduleEnd || "18:00";
  const format = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m || 0).padStart(2, "0")} ${suffix}`;
  };
  if (product.scheduleMode === "same") {
    return `Daily, ${format(start)}–${format(end)}`;
  }
  const days = product.scheduleDays.length
    ? product.scheduleDays.join(", ")
    : "No days";
  return `${days}, ${format(start)}–${format(end)}`;
}
