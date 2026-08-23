create or replace function ordering.get_storefront_settings (
  p_location_id uuid
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select jsonb_build_object(
    'schemaVersion', 2,
    'currency', business.currency,
    'locationPhone', location.phone,
    'orderingEnabled', settings.ordering_enabled,
    'orderingMode', settings.ordering_mode,
    'acceptOrdersWhenClosed', settings.accept_orders_when_closed,
    'isOpenNow', private.is_location_open_at(location.id, now()),
    'minimumOrderValue', settings.minimum_order_value,
    'taxMode', settings.tax_mode,
    'taxRate', settings.tax_rate,
    'paymentMethods', jsonb_build_object(
      'defaultMethod', settings.default_payment_method,
      'cash', jsonb_build_object('enabled', settings.cash_on_delivery_enabled),
      'online', jsonb_build_object(
        'configured', exists (
          select 1 from ordering.location_payment_providers as provider
          where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
        ),
        'enabled', settings.online_payments_enabled and exists (
          select 1 from ordering.location_payment_providers as provider
          where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
        ),
        'status', case
          when exists (
            select 1 from ordering.location_payment_providers as provider
            where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
          ) and settings.online_payments_enabled then 'available'
          when exists (
            select 1 from ordering.location_payment_providers as provider
            where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
          ) then 'disabled'
          else 'not_configured'
        end
      )
    ),
    'deliveryZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', zone.id,
        'name', zone.name,
        'minDistanceKm', zone.min_distance_km,
        'maxDistanceKm', zone.max_distance_km,
        'deliveryFee', zone.delivery_fee,
        'freeDeliveryThreshold', zone.free_delivery_threshold,
        'minimumOrderValue', zone.minimum_order_value
      ) order by zone.min_distance_km, zone.id)
      from ordering.delivery_zones as zone
      where zone.location_id = location.id and zone.is_active
    ), '[]'::jsonb)
  )
  from core.business_locations as location
  join core.businesses as business on business.id = location.business_id
  join ordering.restaurant_settings as settings on settings.location_id = location.id
  where location.id = p_location_id
    and location.is_active
    and business.status = 'active'
$function$;

grant execute on function "ordering"."get_storefront_settings"(uuid) to "anon", "authenticated", "postgres";

revoke all on function "ordering"."get_storefront_settings"(uuid) from public;
