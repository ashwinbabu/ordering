create or replace function ordering.open_customer_cart (
  p_cart_id               uuid,
  p_business_id           uuid,
  p_location_id           uuid,
  p_customer_business_id  uuid,
  p_acquisition_source_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_customer_id uuid;
  v_source_id uuid;
  v_cart_id uuid;
begin
  select relationship.customer_id
  into v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  join core.business_locations as location
    on location.business_id = relationship.business_id
  join core.businesses as business
    on business.id = relationship.business_id
  where relationship.id = p_customer_business_id
    and relationship.business_id = p_business_id
    and relationship.status = 'active'
    and customer.auth_user_id = (select auth.uid())
    and location.id = p_location_id
    and location.is_active
    and business.status = 'active';

  if v_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'active customer relationship is required';
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

  -- Locking the customer-business relationship serializes same-customer cart
  -- creation without locking the whole location.
  perform 1
  from core.customer_businesses
  where id = p_customer_business_id
  for update;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.customer_id = v_customer_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now;

  select cart.id
  into v_cart_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.customer_id = v_customer_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1
  for update;

  if v_cart_id is not null then
    update ordering.carts
    set status = 'active',
        anonymous_session_id = null,
        customer_id = v_customer_id,
        customer_business_id = p_customer_business_id,
        acquisition_source_id = v_source_id,
        expires_at = v_now + interval '30 days'
    where id = v_cart_id;
  else
    insert into ordering.carts (
      id,
      business_id,
      location_id,
      customer_id,
      customer_business_id,
      status,
      acquisition_source_id,
      expires_at
    ) values (
      p_cart_id,
      p_business_id,
      p_location_id,
      v_customer_id,
      p_customer_business_id,
      'active',
      v_source_id,
      v_now + interval '30 days'
    )
    returning id into v_cart_id;
  end if;

  return ordering.get_cart(v_cart_id, null);
end;
$function$;

grant execute on function "ordering"."open_customer_cart"(uuid, uuid, uuid, uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."open_customer_cart"(uuid, uuid, uuid, uuid, uuid) from public;
