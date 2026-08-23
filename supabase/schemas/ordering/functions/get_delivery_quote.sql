create or replace function ordering.get_delivery_quote (
  p_location_id                  uuid,
  p_destination_latitude         numeric,
  p_destination_longitude        numeric,
  p_food_subtotal_after_discount numeric
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_origin_latitude numeric;
  v_origin_longitude numeric;
  v_ordering_mode text;
  v_restaurant_minimum numeric(14, 2);
  v_distance double precision;
  v_zone_minimum numeric(14, 2);
  v_normal_delivery_fee numeric(14, 2);
  v_free_delivery_threshold numeric(14, 2);
  v_customer_delivery_fee numeric(14, 2);
  v_zone_found boolean;
  v_delivery_supported boolean;
begin
  if p_location_id is null
     or p_destination_latitude is null
     or p_destination_latitude not between -90 and 90
     or p_destination_longitude is null
     or p_destination_longitude not between -180 and 180
     or p_food_subtotal_after_discount is null
     or p_food_subtotal_after_discount < 0 then
    raise exception using
      errcode = '22023',
      message = 'valid location, coordinates, and nonnegative subtotal are required';
  end if;

  select
    location.latitude,
    location.longitude,
    settings.ordering_mode,
    settings.minimum_order_value
  into
    v_origin_latitude,
    v_origin_longitude,
    v_ordering_mode,
    v_restaurant_minimum
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where location.id = p_location_id
    and location.is_active
    and business.status = 'active';

  if not found then
    return null;
  end if;

  v_distance := private.haversine_distance_km(
    v_origin_latitude,
    v_origin_longitude,
    p_destination_latitude,
    p_destination_longitude
  );

  select
    zone.minimum_order_value,
    zone.delivery_fee,
    zone.free_delivery_threshold
  into
    v_zone_minimum,
    v_normal_delivery_fee,
    v_free_delivery_threshold
  from ordering.delivery_zones as zone
  where zone.location_id = p_location_id
    and zone.is_active
    and v_distance >= zone.min_distance_km::double precision
    and v_distance < zone.max_distance_km::double precision
  order by zone.min_distance_km, zone.id
  limit 1;

  v_zone_found := found;
  v_delivery_supported := v_ordering_mode in ('delivery', 'both');

  if v_zone_found and v_delivery_supported then
    v_customer_delivery_fee := case
      when v_free_delivery_threshold is not null
       and p_food_subtotal_after_discount >= v_free_delivery_threshold then 0
      else v_normal_delivery_fee
    end;
  end if;

  return jsonb_build_object(
    'serviceable', v_zone_found and v_delivery_supported,
    'distance_km', round(v_distance::numeric, 3),
    'minimum_order_value', case
      when v_zone_found and v_delivery_supported then
        greatest(v_restaurant_minimum, v_zone_minimum)
      else null
    end,
    'normal_delivery_fee', case
      when v_zone_found and v_delivery_supported then v_normal_delivery_fee
      else null
    end,
    'delivery_fee', case
      when v_zone_found and v_delivery_supported then v_customer_delivery_fee
      else null
    end
  );
end;
$function$;

grant execute on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) to "anon", "authenticated", "postgres", "service_role";

comment on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) is 'Safe radial delivery estimate; never exposes internal delivery cost.';

revoke all on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) from public;
