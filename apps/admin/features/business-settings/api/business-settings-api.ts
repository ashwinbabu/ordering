import { supabase } from "@/lib/supabase/client";
import {
  SETTINGS_DAYS,
  type BusinessSettingsDraft,
  type DeliveryZoneDraft,
  type OpeningHoursDraft,
} from "@/features/business-settings/business-settings-model";
import type { Json } from "@/lib/supabase/database.types";

interface SettingsScope {
  businessId: string;
  locationId: string;
}

export interface BusinessSettingsBaseline {
  businessUpdatedAt: string;
  restaurantSettingsUpdatedAt: string;
  openingHours: Json[];
  deliveryZones: Json[];
}

export interface BusinessSettingsData {
  draft: BusinessSettingsDraft;
  baseline: BusinessSettingsBaseline;
}

function throwIfError(error: { message: string } | null) {
  if (error) throw error;
}

function asOrderingMode(
  value: string,
): BusinessSettingsDraft["restaurant"]["orderingMode"] {
  if (value === "delivery" || value === "pickup" || value === "both")
    return value;
  throw new Error("The outlet has an unsupported ordering mode.");
}

function asTaxMode(
  value: string,
): BusinessSettingsDraft["restaurant"]["taxMode"] {
  if (value === "none" || value === "inclusive" || value === "exclusive")
    return value;
  throw new Error("The outlet has an unsupported tax mode.");
}

function openingHoursBaseline(row: {
  id: string;
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
}): Json {
  return {
    id: row.id,
    day_of_week: row.day_of_week,
    is_closed: row.is_closed,
    opens_at: row.opens_at,
    closes_at: row.closes_at,
  };
}

function deliveryZoneBaseline(row: {
  id: string;
  name: string;
  min_distance_km: number;
  max_distance_km: number;
  delivery_fee: number;
  free_delivery_threshold: number | null;
  minimum_order_value: number;
  estimated_delivery_cost: number;
  is_active: boolean;
  sort_order: number;
}): Json {
  return {
    id: row.id,
    name: row.name,
    min_distance_km: row.min_distance_km,
    max_distance_km: row.max_distance_km,
    delivery_fee: row.delivery_fee,
    free_delivery_threshold: row.free_delivery_threshold,
    minimum_order_value: row.minimum_order_value,
    estimated_delivery_cost: row.estimated_delivery_cost,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

export async function getBusinessSettings(
  scope: SettingsScope,
): Promise<BusinessSettingsData> {
  const core = supabase.schema("core");
  const ordering = supabase.schema("ordering");
  const [
    { data: business, error: businessError },
    { data: location, error: locationError },
    { data: restaurant, error: restaurantError },
    { data: openingHours, error: openingHoursError },
    { data: deliveryZones, error: deliveryZonesError },
  ] = await Promise.all([
    core
      .from("businesses")
      .select("id, name, currency, timezone, logo_url, updated_at")
      .eq("id", scope.businessId)
      .single(),
    core
      .from("business_locations")
      .select(
        "id, business_id, name, phone, address_line_1, locality, city, state, postal_code, latitude, longitude",
      )
      .eq("id", scope.locationId)
      .eq("business_id", scope.businessId)
      .single(),
    ordering
      .from("restaurant_settings")
      .select(
        "location_id, ordering_mode, minimum_order_value, default_prep_minutes, accept_orders_when_closed, tax_mode, tax_rate, skrowia_commission_rate, aggregator_benchmark_rate, updated_at",
      )
      .eq("location_id", scope.locationId)
      .single(),
    ordering
      .from("opening_hours")
      .select("id, day_of_week, is_closed, opens_at, closes_at")
      .eq("location_id", scope.locationId)
      .order("id"),
    ordering
      .from("delivery_zones")
      .select(
        "id, name, min_distance_km, max_distance_km, delivery_fee, free_delivery_threshold, minimum_order_value, estimated_delivery_cost, is_active, sort_order",
      )
      .eq("location_id", scope.locationId)
      .order("sort_order")
      .order("id"),
  ]);
  throwIfError(businessError);
  throwIfError(locationError);
  throwIfError(restaurantError);
  throwIfError(openingHoursError);
  throwIfError(deliveryZonesError);

  if (!business || !location || !restaurant) {
    throw new Error(
      "The selected outlet does not have a complete settings record.",
    );
  }
  const openingHoursRows = openingHours ?? [];
  const deliveryZoneRows = deliveryZones ?? [];

  const hoursByDay = new Map<number, typeof openingHoursRows>();
  for (const row of openingHoursRows) {
    const entries = hoursByDay.get(row.day_of_week) ?? [];
    entries.push(row);
    hoursByDay.set(row.day_of_week, entries);
  }
  if ([...hoursByDay.values()].some((entries) => entries.length > 1)) {
    throw new Error(
      "This outlet has multiple opening intervals on a day, which this editor does not yet support.",
    );
  }

  const openingHoursDraft: OpeningHoursDraft[] = SETTINGS_DAYS.map(
    ({ dayOfWeek, label }) => {
      const row = hoursByDay.get(dayOfWeek)?.[0];
      return {
        dayOfWeek,
        label,
        isClosed: row?.is_closed ?? true,
        opensAt: row?.opens_at?.slice(0, 5) ?? "08:00",
        closesAt: row?.closes_at?.slice(0, 5) ?? "22:30",
      };
    },
  );

  const deliveryZoneDraft: DeliveryZoneDraft[] = deliveryZoneRows.map(
    (zone) => ({
      id: zone.id,
      name: zone.name,
      minDistanceKm: zone.min_distance_km,
      maxDistanceKm: zone.max_distance_km,
      deliveryFee: zone.delivery_fee,
      freeDeliveryThreshold: zone.free_delivery_threshold,
      minimumOrderValue: zone.minimum_order_value,
      estimatedDeliveryCost: zone.estimated_delivery_cost,
      isActive: zone.is_active,
    }),
  );

  return {
    draft: {
      general: {
        businessName: business.name,
        locationName: location.name,
        phone: location.phone ?? "",
        addressLine1: location.address_line_1,
        locality: location.locality ?? "",
        city: location.city,
        state: location.state,
        postalCode: location.postal_code ?? "",
        latitude: location.latitude,
        longitude: location.longitude,
        logoUrl: business.logo_url,
      },
      restaurant: {
        orderingMode: asOrderingMode(restaurant.ordering_mode),
        minimumOrderValue: restaurant.minimum_order_value,
        defaultPrepMinutes: restaurant.default_prep_minutes,
        acceptOrdersWhenClosed: restaurant.accept_orders_when_closed,
        taxMode: asTaxMode(restaurant.tax_mode),
        taxRate: restaurant.tax_rate,
      },
      openingHours: openingHoursDraft,
      deliveryZones: deliveryZoneDraft,
      commercials: {
        currency: business.currency,
        timezone: business.timezone,
        skrowiaCommissionRate: restaurant.skrowia_commission_rate,
        aggregatorBenchmarkRate: restaurant.aggregator_benchmark_rate,
      },
    },
    baseline: {
      businessUpdatedAt: business.updated_at,
      restaurantSettingsUpdatedAt: restaurant.updated_at,
      openingHours: openingHoursRows
        .map(openingHoursBaseline)
        .sort((left, right) =>
          String((left as { id: string }).id).localeCompare(
            String((right as { id: string }).id),
          ),
        ),
      deliveryZones: deliveryZoneRows
        .map(deliveryZoneBaseline)
        .sort((left, right) =>
          String((left as { id: string }).id).localeCompare(
            String((right as { id: string }).id),
          ),
        ),
    },
  };
}

export async function saveBusinessSettings({
  businessId,
  locationId,
  baseline,
  draft,
}: SettingsScope & {
  baseline: BusinessSettingsBaseline;
  draft: BusinessSettingsDraft;
}) {
  const payload: Json = {
    general: {
      business_name: draft.general.businessName,
      location_name: draft.general.locationName,
      phone: draft.general.phone,
      address_line_1: draft.general.addressLine1,
      locality: draft.general.locality,
      city: draft.general.city,
      state: draft.general.state,
      postal_code: draft.general.postalCode,
    },
    restaurant: {
      ordering_mode: draft.restaurant.orderingMode,
      minimum_order_value: draft.restaurant.minimumOrderValue,
      default_prep_minutes: draft.restaurant.defaultPrepMinutes,
      accept_orders_when_closed: draft.restaurant.acceptOrdersWhenClosed,
      tax_mode: draft.restaurant.taxMode,
      tax_rate: draft.restaurant.taxRate,
    },
    opening_hours: draft.openingHours.map((row) => ({
      day_of_week: row.dayOfWeek,
      is_closed: row.isClosed,
      opens_at: row.isClosed ? null : row.opensAt,
      closes_at: row.isClosed ? null : row.closesAt,
    })),
    delivery_zones: draft.deliveryZones.map((zone, index) => ({
      id: zone.id,
      name: zone.name,
      min_distance_km: zone.minDistanceKm,
      max_distance_km: zone.maxDistanceKm,
      delivery_fee: zone.deliveryFee,
      free_delivery_threshold: zone.freeDeliveryThreshold,
      minimum_order_value: zone.minimumOrderValue,
      estimated_delivery_cost: zone.estimatedDeliveryCost,
      is_active: zone.isActive,
      sort_order: index,
    })),
  };
  const rpcBaseline: Json = {
    business_updated_at: baseline.businessUpdatedAt,
    restaurant_settings_updated_at: baseline.restaurantSettingsUpdatedAt,
    opening_hours: baseline.openingHours,
    delivery_zones: baseline.deliveryZones,
  };

  const { error } = await supabase
    .schema("ordering")
    .rpc("save_business_settings", {
      p_business_id: businessId,
      p_location_id: locationId,
      p_baseline: rpcBaseline,
      p_settings: payload,
    });
  throwIfError(error);
}

const LOGO_BUCKET = "business-logos";

function logoPathFromUrl(businessId: string, logoUrl: string): string | null {
  const marker = `/${LOGO_BUCKET}/`;
  const index = logoUrl.indexOf(marker);
  if (index === -1) return null;
  const path = logoUrl.slice(index + marker.length).split("?")[0];
  return path.startsWith(`${businessId}/`) ? path : null;
}

export async function uploadBusinessLogo(
  businessId: string,
  file: Blob,
  extension: string,
): Promise<string> {
  const path = `${businessId}/logo-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  throwIfError(uploadError);

  const { data: existing, error: fetchError } = await supabase
    .schema("core")
    .from("businesses")
    .select("logo_url")
    .eq("id", businessId)
    .single();
  throwIfError(fetchError);

  const { data: publicUrlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .schema("core")
    .from("businesses")
    .update({ logo_url: logoUrl })
    .eq("id", businessId);
  throwIfError(updateError);

  const previousPath = existing?.logo_url
    ? logoPathFromUrl(businessId, existing.logo_url)
    : null;
  if (previousPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([previousPath]);
  }

  return logoUrl;
}

export async function deleteBusinessLogo(businessId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .schema("core")
    .from("businesses")
    .select("logo_url")
    .eq("id", businessId)
    .single();
  throwIfError(fetchError);

  const { error: updateError } = await supabase
    .schema("core")
    .from("businesses")
    .update({ logo_url: null })
    .eq("id", businessId);
  throwIfError(updateError);

  const previousPath = existing?.logo_url
    ? logoPathFromUrl(businessId, existing.logo_url)
    : null;
  if (previousPath) {
    await supabase.storage.from(LOGO_BUCKET).remove([previousPath]);
  }
}
