import { getSupabaseClient } from "../../../lib/supabase/client";
import { readArray, readBoolean, readNullableNumber, readNumber, readRecord, readString } from "../../../lib/supabase/json-parsing";
import { callUntypedRpc } from "../../../lib/supabase/untyped-rpc";
import type { StorefrontDeliveryZone, StorefrontSettings, TaxMode } from "../../../domain/cart";

function parseTaxMode(value: string): TaxMode {
  if (value !== "none" && value !== "inclusive" && value !== "exclusive") {
    throw new Error("The restaurant tax mode is invalid.");
  }

  return value;
}

function parseOrderingMode(value: string): StorefrontSettings["orderingMode"] {
  if (value !== "delivery" && value !== "pickup" && value !== "both") {
    throw new Error("The restaurant ordering mode is invalid.");
  }

  return value;
}

function parseDeliveryZone(value: unknown): StorefrontDeliveryZone {
  const zone = readRecord(value as never, "A delivery zone");
  return {
    id: readString(zone.id, "A delivery zone ID"),
    name: readString(zone.name, "A delivery zone name"),
    minDistanceKm: readNumber(zone.minDistanceKm, "A delivery zone minimum distance"),
    maxDistanceKm: readNumber(zone.maxDistanceKm, "A delivery zone maximum distance"),
    deliveryFee: readNumber(zone.deliveryFee, "A delivery zone fee"),
    freeDeliveryThreshold: readNullableNumber(zone.freeDeliveryThreshold, "A delivery zone free-delivery threshold"),
    minimumOrderValue: readNumber(zone.minimumOrderValue, "A delivery zone minimum order value"),
  };
}

/**
 * Reads the public, location-scoped restaurant settings boundary
 * (ordering.get_storefront_settings): minimum order, tax, and delivery
 * zones. These are the server-authoritative inputs the cart uses to display
 * an honest estimate; the final total is still validated server-side before
 * payment.
 */
export async function getStorefrontSettings(locationId: string): Promise<StorefrontSettings | null> {
  const client = getSupabaseClient().schema("ordering");
  const result = await callUntypedRpc(client, "get_storefront_settings", { p_location_id: locationId });
  if (result.error) throw result.error;
  if (result.data === null) return null;

  const settings = readRecord(result.data as never, "The storefront settings response");
  if (readNumber(settings.schemaVersion, "The storefront settings schema version") !== 1) {
    throw new Error("The storefront settings schema version is unsupported.");
  }

  return {
    schemaVersion: 1,
    currency: readString(settings.currency, "The storefront currency"),
    orderingEnabled: readBoolean(settings.orderingEnabled, "The storefront ordering-enabled flag"),
    orderingMode: parseOrderingMode(readString(settings.orderingMode, "The storefront ordering mode")),
    acceptOrdersWhenClosed: readBoolean(settings.acceptOrdersWhenClosed, "The storefront accept-when-closed flag"),
    isOpenNow: readBoolean(settings.isOpenNow, "The storefront open-now flag"),
    minimumOrderValue: readNumber(settings.minimumOrderValue, "The storefront minimum order value"),
    taxMode: parseTaxMode(readString(settings.taxMode, "The storefront tax mode")),
    taxRate: readNumber(settings.taxRate, "The storefront tax rate"),
    deliveryZones: readArray(settings.deliveryZones as never, "The storefront delivery zones").map(parseDeliveryZone),
  };
}
