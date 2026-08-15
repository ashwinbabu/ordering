-- Storefront cart integration: the ordering.carts/cart_items RPC surface
-- (open_anonymous_cart, get_cart, set_cart_item, remove_cart_item,
-- set_cart_coupon) was built for a trusted-backend caller only
-- (private.request_is_service_role()), so an anonymous storefront visitor
-- using the publishable/anon key could never open or mutate their own cart.
-- This migration lets an anonymous caller access a cart it can prove
-- ownership of by presenting the cart's own anonymous_session_id (a
-- client-generated, unguessable UUID persisted in browser storage) --
-- the same bearer-token pattern used by most guest-cart implementations.
-- Authenticated-customer cart access is unchanged.

create or replace function private.can_access_cart(
  p_cart_id uuid,
  p_anonymous_session_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from ordering.carts as cart
    left join core.customers as customer
      on customer.id = cart.customer_id
    where cart.id = p_cart_id
      and (
        (
          cart.customer_id is not null
          and customer.auth_user_id = (select auth.uid())
        )
        or
        (
          (select private.request_is_service_role())
          and (
            cart.customer_id is not null
            or cart.anonymous_session_id = p_anonymous_session_id
          )
        )
        or
        (
          cart.customer_id is null
          and cart.anonymous_session_id is not null
          and p_anonymous_session_id is not null
          and cart.anonymous_session_id = p_anonymous_session_id
        )
      )
  );
$$;

create or replace function ordering.open_anonymous_cart(
  p_cart_id uuid,
  p_business_id uuid,
  p_location_id uuid,
  p_anonymous_session_id uuid,
  p_acquisition_source_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_source_id uuid;
  v_cart_id uuid;
begin
  if p_cart_id is null or p_anonymous_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'stable cart and anonymous session identifiers are required';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    join ordering.restaurant_settings as settings
      on settings.location_id = location.id
    where business.id = p_business_id
      and business.status = 'active'
      and location.id = p_location_id
      and location.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'business location is unavailable';
  end if;

  select source.id
  into v_source_id
  from ordering.acquisition_sources as source
  left join ordering.campaigns as campaign
    on campaign.business_id = source.business_id
   and campaign.id = source.campaign_id
  where source.business_id = p_business_id
    and source.is_active
    and (
      source.id = p_acquisition_source_id
      or (p_acquisition_source_id is null and source.code = 'DIRECT')
    )
    and (
      source.campaign_id is null
      or (
        campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= v_now)
        and (campaign.ends_at is null or v_now < campaign.ends_at)
      )
    );

  if v_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'acquisition source is unavailable';
  end if;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.anonymous_session_id = p_anonymous_session_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now;

  select cart.id
  into v_cart_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.anonymous_session_id = p_anonymous_session_id
    and cart.status = 'abandoned'
    and cart.expires_at > v_now
  order by cart.updated_at desc, cart.id
  limit 1
  for update;

  if v_cart_id is not null then
    update ordering.carts
    set status = 'active',
        acquisition_source_id = v_source_id,
        expires_at = v_now + interval '30 days'
    where id = v_cart_id;
  else
    insert into ordering.carts (
      id,
      business_id,
      location_id,
      anonymous_session_id,
      status,
      acquisition_source_id,
      expires_at
    )
    values (
      p_cart_id,
      p_business_id,
      p_location_id,
      p_anonymous_session_id,
      'active',
      v_source_id,
      v_now + interval '30 days'
    )
    on conflict (business_id, location_id, anonymous_session_id)
      where status = 'active' and anonymous_session_id is not null
    do update
      set acquisition_source_id = excluded.acquisition_source_id,
          expires_at = v_now + interval '30 days'
    returning ordering.carts.id into v_cart_id;
  end if;

  return ordering.get_cart(v_cart_id, p_anonymous_session_id);
end;
$$;

grant execute on function ordering.open_anonymous_cart(uuid, uuid, uuid, uuid, uuid) to anon;
grant execute on function ordering.get_cart(uuid, uuid) to anon;
grant execute on function ordering.set_cart_item(uuid, uuid, uuid, uuid, integer, text, jsonb) to anon;
grant execute on function ordering.remove_cart_item(uuid, uuid, uuid) to anon;
grant execute on function ordering.set_cart_coupon(uuid, uuid, text) to anon;

-- Public, read-only storefront boundary for the restaurant-level settings the
-- cart needs to price and gate checkout (minimum order, tax, delivery
-- zones). Mirrors the existing get_storefront_menu public-read pattern; no
-- internal economics (aggregator/commission rates) are exposed.
create or replace function ordering.get_storefront_settings(p_location_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'currency', business.currency,
    'orderingEnabled', settings.ordering_enabled,
    'orderingMode', settings.ordering_mode,
    'acceptOrdersWhenClosed', settings.accept_orders_when_closed,
    'isOpenNow', private.is_location_open_at(location.id, now()),
    'minimumOrderValue', settings.minimum_order_value,
    'taxMode', settings.tax_mode,
    'taxRate', settings.tax_rate,
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
      where zone.location_id = location.id
        and zone.is_active
    ), '[]'::jsonb)
  )
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where location.id = p_location_id
    and location.is_active
    and business.status = 'active'
$$;

revoke all on function ordering.get_storefront_settings(uuid) from public;
grant execute on function ordering.get_storefront_settings(uuid) to anon, authenticated;
