export const SETTINGS_DAYS = [
  { dayOfWeek: 1, label: "Mon" },
  { dayOfWeek: 2, label: "Tue" },
  { dayOfWeek: 3, label: "Wed" },
  { dayOfWeek: 4, label: "Thu" },
  { dayOfWeek: 5, label: "Fri" },
  { dayOfWeek: 6, label: "Sat" },
  { dayOfWeek: 7, label: "Sun" },
] as const;

export interface OpeningHoursDraft {
  dayOfWeek: number;
  label: string;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
}

export interface DeliveryZoneDraft {
  id: string;
  name: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  deliveryFee: number;
  freeDeliveryThreshold: number | null;
  minimumOrderValue: number;
  estimatedDeliveryCost: number;
  isActive: boolean;
}

export interface BusinessSettingsDraft {
  general: {
    businessName: string;
    locationName: string;
    phone: string;
    addressLine1: string;
    locality: string;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    logoUrl: string | null;
  };
  restaurant: {
    orderingMode: "delivery" | "pickup" | "both";
    minimumOrderValue: number;
    defaultPrepMinutes: number;
    acceptOrdersWhenClosed: boolean;
    taxMode: "none" | "inclusive" | "exclusive";
    taxRate: number;
  };
  openingHours: OpeningHoursDraft[];
  deliveryZones: DeliveryZoneDraft[];
  commercials: {
    currency: string;
    timezone: string;
    skrowiaCommissionRate: number;
    aggregatorBenchmarkRate: number | null;
  };
}

export type SettingsSection =
  | "general"
  | "ordering"
  | "hours"
  | "tax"
  | "delivery";

export function cloneBusinessSettingsDraft(
  draft: BusinessSettingsDraft,
): BusinessSettingsDraft {
  return structuredClone(draft);
}
