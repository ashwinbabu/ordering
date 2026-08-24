create or replace function ordering.save_business_settings (
  p_business_id uuid,
  p_location_id uuid,
  p_baseline    jsonb,
  p_settings    jsonb
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
  v_restaurant_settings ordering.restaurant_settings%rowtype;
  v_current_opening_hours jsonb;
  v_current_delivery_zones jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save business settings.' using errcode = '42501';
  end if;

  if p_baseline is null
    or jsonb_typeof(p_baseline) <> 'object'
    or jsonb_typeof(p_baseline -> 'opening_hours') <> 'array'
    or jsonb_typeof(p_baseline -> 'delivery_zones') <> 'array' then
    raise exception 'The settings baseline is incomplete. Reload and try again.' using errcode = '22023';
  end if;

  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or jsonb_typeof(p_settings -> 'general') <> 'object'
    or jsonb_typeof(p_settings -> 'restaurant') <> 'object'
    or jsonb_typeof(p_settings -> 'opening_hours') <> 'array'
    or jsonb_typeof(p_settings -> 'delivery_zones') <> 'array' then
    raise exception 'The settings save payload is incomplete.' using errcode = '22023';
  end if;

  select *
  into v_location
  from core.business_locations
  where id = p_location_id
    and business_id = p_business_id
    and is_active
  for update;

  if not found then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception 'You do not have permission to edit business settings for this outlet.' using errcode = '42501';
  end if;

  select *
  into v_business
  from core.businesses
  where id = p_business_id
  for update;

  select *
  into v_restaurant_settings
  from ordering.restaurant_settings
  where location_id = p_location_id
  for update;

  if not found then
    raise exception 'Restaurant settings are not configured for this outlet.' using errcode = '22023';
  end if;

  perform 1
  from ordering.opening_hours
  where location_id = p_location_id
  for update;

  perform 1
  from ordering.delivery_zones
  where location_id = p_location_id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'day_of_week', day_of_week,
        'is_closed', is_closed,
        'opens_at', opens_at,
        'closes_at', closes_at
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_current_opening_hours
  from ordering.opening_hours
  where location_id = p_location_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'name', name,
        'min_distance_km', min_distance_km,
        'max_distance_km', max_distance_km,
        'delivery_fee', delivery_fee,
        'free_delivery_threshold', free_delivery_threshold,
        'minimum_order_value', minimum_order_value,
        'estimated_delivery_cost', estimated_delivery_cost,
        'is_active', is_active,
        'sort_order', sort_order
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_current_delivery_zones
  from ordering.delivery_zones
  where location_id = p_location_id;

  if (p_baseline ->> 'business_updated_at')::timestamptz is distinct from v_business.updated_at
    or (p_baseline ->> 'restaurant_settings_updated_at')::timestamptz is distinct from v_restaurant_settings.updated_at
    or (p_baseline -> 'opening_hours') is distinct from v_current_opening_hours
    or (p_baseline -> 'delivery_zones') is distinct from v_current_delivery_zones then
    raise exception 'Business settings changed in another session. Reload and review the latest values.' using errcode = '40001';
  end if;

  if jsonb_array_length(p_settings -> 'opening_hours') <> 7
    or exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'opening_hours') as item(day_of_week integer)
      where item.day_of_week is null
         or item.day_of_week < 1
         or item.day_of_week > 7
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'opening_hours') as item(day_of_week integer)
      group by day_of_week
      having count(*) <> 1
    ) then
    raise exception 'Opening hours must contain exactly one entry for each day.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Each delivery zone must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
    join ordering.delivery_zones as zone on zone.id = item.id
    where zone.location_id <> p_location_id
  ) then
    raise exception 'A delivery zone belongs to a different outlet.' using errcode = '22023';
  end if;

  update core.businesses
  set
    name = btrim(p_settings -> 'general' ->> 'business_name'),
    updated_at = now()
  where id = p_business_id;

  update core.business_locations
  set
    name = btrim(p_settings -> 'general' ->> 'location_name'),
    phone = nullif(btrim(p_settings -> 'general' ->> 'phone'), ''),
    address_line_1 = btrim(p_settings -> 'general' ->> 'address_line_1'),
    locality = nullif(btrim(p_settings -> 'general' ->> 'locality'), ''),
    city = btrim(p_settings -> 'general' ->> 'city'),
    state = btrim(p_settings -> 'general' ->> 'state'),
    postal_code = nullif(btrim(p_settings -> 'general' ->> 'postal_code'), '')
  where id = p_location_id;

  update ordering.restaurant_settings
  set
    currency = (select currency from core.businesses where id = p_business_id),
    ordering_mode = btrim(p_settings -> 'restaurant' ->> 'ordering_mode'),
    minimum_order_value = (p_settings -> 'restaurant' ->> 'minimum_order_value')::numeric,
    default_prep_minutes = (p_settings -> 'restaurant' ->> 'default_prep_minutes')::smallint,
    accept_orders_when_closed = (p_settings -> 'restaurant' ->> 'accept_orders_when_closed')::boolean,
    tax_mode = btrim(p_settings -> 'restaurant' ->> 'tax_mode'),
    tax_rate = (p_settings -> 'restaurant' ->> 'tax_rate')::numeric
  where location_id = p_location_id;

  delete from ordering.opening_hours
  where location_id = p_location_id;

  insert into ordering.opening_hours (
    location_id,
    day_of_week,
    is_closed,
    opens_at,
    closes_at
  )
  select
    p_location_id,
    item.day_of_week,
    item.is_closed,
    case when item.is_closed then null else item.opens_at end,
    case when item.is_closed then null else item.closes_at end
  from jsonb_to_recordset(p_settings -> 'opening_hours') as item(
    day_of_week integer,
    is_closed boolean,
    opens_at time,
    closes_at time
  );

  -- Temporarily deactivate current zones before applying their replacement
  -- ranges. The existing validation trigger then rejects any final overlap.
  update ordering.delivery_zones
  set is_active = false
  where location_id = p_location_id
    and is_active;

  insert into ordering.delivery_zones as zone (
    id,
    location_id,
    name,
    min_distance_km,
    max_distance_km,
    delivery_fee,
    free_delivery_threshold,
    minimum_order_value,
    estimated_delivery_cost,
    is_active,
    sort_order
  )
  select
    item.id,
    p_location_id,
    btrim(item.name),
    item.min_distance_km,
    item.max_distance_km,
    item.delivery_fee,
    item.free_delivery_threshold,
    item.minimum_order_value,
    item.estimated_delivery_cost,
    item.is_active,
    item.sort_order
  from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(
    id uuid,
    name text,
    min_distance_km numeric,
    max_distance_km numeric,
    delivery_fee numeric,
    free_delivery_threshold numeric,
    minimum_order_value numeric,
    estimated_delivery_cost numeric,
    is_active boolean,
    sort_order integer
  )
  on conflict (id) do update
  set
    name = excluded.name,
    min_distance_km = excluded.min_distance_km,
    max_distance_km = excluded.max_distance_km,
    delivery_fee = excluded.delivery_fee,
    free_delivery_threshold = excluded.free_delivery_threshold,
    minimum_order_value = excluded.minimum_order_value,
    estimated_delivery_cost = excluded.estimated_delivery_cost,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order
  where zone.location_id = p_location_id;

  -- Zones retained by historical orders are deactivated; unused removed zones
  -- are deleted, so the Admin screen no longer shows them.
  update ordering.delivery_zones as zone
  set is_active = false
  where zone.location_id = p_location_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
      where item.id = zone.id
    )
    and exists (
      select 1
      from ordering.orders as order_record
      where order_record.location_id = p_location_id
        and order_record.delivery_zone_id = zone.id
    );

  delete from ordering.delivery_zones as zone
  where zone.location_id = p_location_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
      where item.id = zone.id
    )
    and not exists (
      select 1
      from ordering.orders as order_record
      where order_record.location_id = p_location_id
        and order_record.delivery_zone_id = zone.id
    );
end;
$function$;

grant execute on function "ordering"."save_business_settings"(uuid, uuid, jsonb, jsonb) to "authenticated", "postgres";

revoke all on function "ordering"."save_business_settings"(uuid, uuid, jsonb, jsonb) from public;
