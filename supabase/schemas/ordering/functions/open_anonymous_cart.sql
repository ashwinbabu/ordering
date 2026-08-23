create or replace function ordering.open_anonymous_cart (
  p_cart_id               uuid,
  p_business_id           uuid,
  p_location_id           uuid,
  p_anonymous_session_id  uuid,
  p_acquisition_source_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "ordering"."open_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) to "anon", "postgres", "service_role";

revoke all on function "ordering"."open_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) from public;
