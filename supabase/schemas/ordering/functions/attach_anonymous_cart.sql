create or replace function ordering.attach_anonymous_cart (
  p_business_id          uuid,
  p_location_id          uuid,
  p_anonymous_session_id uuid,
  p_customer_business_id uuid,
  p_new_cart_id          uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_customer_id uuid;
  v_anonymous_cart_id uuid;
  v_customer_cart_id uuid;
  v_target_cart_id uuid;
  v_anonymous_updated_at timestamptz;
  v_customer_updated_at timestamptz;
  v_anonymous_source_id uuid;
  v_anonymous_coupon_id uuid;
  v_coupon_code text;
  v_coupon_validation jsonb;
begin
  if p_anonymous_session_id is null or p_new_cart_id is null then
    raise exception using
      errcode = '22023',
      message = 'anonymous session and fallback cart identifiers are required';
  end if;

  select relationship.customer_id
  into v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  join core.business_locations as location
    on location.business_id = relationship.business_id
   and location.id = p_location_id
  where relationship.id = p_customer_business_id
    and relationship.business_id = p_business_id
    and relationship.status = 'active'
    and customer.auth_user_id = (select auth.uid())
    and location.is_active
  for update of relationship;

  if v_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'active customer relationship is required';
  end if;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now
    and (
      expired_cart.anonymous_session_id = p_anonymous_session_id
      or expired_cart.customer_id = v_customer_id
    );

  -- Every candidate is locked in UUID order before a target is selected.
  perform candidate.id
  from ordering.carts as candidate
  where candidate.business_id = p_business_id
    and candidate.location_id = p_location_id
    and candidate.status in ('active', 'abandoned')
    and candidate.expires_at > v_now
    and (
      candidate.anonymous_session_id = p_anonymous_session_id
      or candidate.customer_id = v_customer_id
    )
  order by candidate.id
  for update;

  select
    cart.id,
    cart.updated_at,
    cart.acquisition_source_id,
    cart.coupon_id
  into
    v_anonymous_cart_id,
    v_anonymous_updated_at,
    v_anonymous_source_id,
    v_anonymous_coupon_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.anonymous_session_id = p_anonymous_session_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1;

  select cart.id, cart.updated_at
  into v_customer_cart_id, v_customer_updated_at
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.customer_id = v_customer_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1;

  if v_customer_cart_id is not null then
    v_target_cart_id := v_customer_cart_id;

    if v_anonymous_cart_id is not null
       and v_anonymous_cart_id <> v_customer_cart_id then
      update ordering.cart_items
      set cart_id = v_target_cart_id
      where cart_id = v_anonymous_cart_id;

      update ordering.carts
      set status = 'abandoned',
          coupon_id = null
      where id = v_anonymous_cart_id;

      update ordering.carts
      set status = 'active',
          anonymous_session_id = null,
          customer_id = v_customer_id,
          customer_business_id = p_customer_business_id,
          acquisition_source_id = case
            when v_anonymous_updated_at >= v_customer_updated_at
              and v_anonymous_source_id is not null
              then v_anonymous_source_id
            else acquisition_source_id
          end,
          coupon_id = case
            when v_anonymous_updated_at >= v_customer_updated_at
              and v_anonymous_coupon_id is not null
              then v_anonymous_coupon_id
            else coupon_id
          end,
          expires_at = v_now + interval '30 days'
      where id = v_target_cart_id;
    else
      update ordering.carts
      set status = 'active',
          anonymous_session_id = null,
          expires_at = v_now + interval '30 days'
      where id = v_target_cart_id;
    end if;

  elsif v_anonymous_cart_id is not null then
    v_target_cart_id := v_anonymous_cart_id;

    update ordering.carts
    set status = 'active',
        anonymous_session_id = null,
        customer_id = v_customer_id,
        customer_business_id = p_customer_business_id,
        expires_at = v_now + interval '30 days'
    where id = v_target_cart_id;

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
    )
    select
      p_new_cart_id,
      p_business_id,
      p_location_id,
      v_customer_id,
      p_customer_business_id,
      'active',
      source.id,
      v_now + interval '30 days'
    from ordering.acquisition_sources as source
    where source.business_id = p_business_id
      and source.code = 'DIRECT'
      and source.is_active
    returning id into v_target_cart_id;

    if v_target_cart_id is null then
      raise exception using
        errcode = '55000',
        message = 'DIRECT acquisition source is unavailable';
    end if;
  end if;

  -- Retain valid lines, prune catalog rows that can no longer belong to the
  -- cart, and remove unavailable/unattached option selections. Required-group
  -- completeness is then surfaced by the mutation/quote APIs.
  delete from ordering.cart_items as item
  where item.cart_id = v_target_cart_id
    and not exists (
      select 1
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      left join ordering.product_locations as location_override
        on location_override.product_id = product.id
       and location_override.location_id = p_location_id
      where product.id = item.product_id
        and product.business_id = p_business_id
        and product.is_active
        and product.is_available
        and coalesce(location_override.is_available, true)
        and category.is_active
        and (category.location_id is null or category.location_id = p_location_id)
    );

  delete from ordering.cart_item_options as selection
  using ordering.cart_items as item
  where selection.cart_item_id = item.id
    and item.cart_id = v_target_cart_id
    and not exists (
      select 1
      from ordering.options as option_item
      join ordering.option_groups as option_group
        on option_group.id = option_item.option_group_id
       and option_group.is_active
      join ordering.product_option_groups as attachment
        on attachment.product_id = item.product_id
       and attachment.option_group_id = option_group.id
      where option_item.id = selection.option_id
        and option_item.is_active
        and option_item.is_available
    );

  select coupon.code
  into v_coupon_code
  from ordering.carts as cart
  join ordering.coupons as coupon
    on coupon.business_id = cart.business_id
   and coupon.id = cart.coupon_id
  where cart.id = v_target_cart_id;

  if v_coupon_code is not null then
    v_coupon_validation := ordering.validate_coupon(
      p_business_id,
      p_location_id,
      v_coupon_code,
      private.current_cart_subtotal(v_target_cart_id),
      v_now
    );

    if not coalesce((v_coupon_validation ->> 'valid')::boolean, false) then
      update ordering.carts set coupon_id = null where id = v_target_cart_id;
    end if;
  end if;

  return ordering.get_cart(v_target_cart_id, null);
end;
$function$;

grant execute on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) to "authenticated", "postgres";

comment on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) is 'Attaches and deterministically merges a same-location anonymous cart after Auth.';

revoke all on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) from public;
