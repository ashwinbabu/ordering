create or replace function private.calculate_order_quote (
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid,
  p_trusted_delivery_minutes     smallint,
  p_at                           timestamp with time zone
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_ordering_mode text;
  v_ordering_enabled boolean;
  v_accept_when_closed boolean;
  v_restaurant_minimum numeric(14, 2);
  v_tax_mode text;
  v_tax_rate numeric(7, 4);
  v_currency text;
  v_default_prep_minutes smallint;
  v_aggregator_rate numeric(7, 4);
  v_skrowia_rate numeric(7, 4);
  v_origin_latitude numeric;
  v_origin_longitude numeric;
  v_food_subtotal numeric(14, 2);
  v_coupon_validation jsonb;
  v_coupon_id uuid;
  v_coupon_code text;
  v_coupon_discount numeric(14, 2) := 0;
  v_net_food numeric(14, 2);
  v_tax_total numeric(14, 2);
  v_grand_total numeric(14, 2);
  v_address jsonb;
  v_destination_latitude numeric;
  v_destination_longitude numeric;
  v_distance double precision;
  v_delivery_zone_id uuid;
  v_zone_minimum numeric(14, 2);
  v_normal_delivery_fee numeric(14, 2) := 0;
  v_free_delivery_threshold numeric(14, 2);
  v_delivery_fee numeric(14, 2) := 0;
  v_estimated_delivery_cost numeric(14, 2) := 0;
  v_kitchen_minutes smallint;
  v_estimated_minutes smallint;
begin
  select cart.*
  into v_cart
  from ordering.carts as cart
  join core.businesses as business
    on business.id = cart.business_id
   and business.status = 'active'
  join core.business_locations as location
    on location.business_id = cart.business_id
   and location.id = cart.location_id
   and location.is_active
  where cart.id = p_cart_id;

  if not found then
    raise exception using errcode = '22023', message = 'cart location is unavailable';
  end if;

  select
    settings.ordering_mode,
    settings.ordering_enabled,
    settings.accept_orders_when_closed,
    settings.minimum_order_value,
    settings.tax_mode,
    settings.tax_rate,
    settings.currency,
    settings.default_prep_minutes,
    settings.aggregator_benchmark_rate,
    settings.skrowia_commission_rate,
    location.latitude,
    location.longitude
  into
    v_ordering_mode,
    v_ordering_enabled,
    v_accept_when_closed,
    v_restaurant_minimum,
    v_tax_mode,
    v_tax_rate,
    v_currency,
    v_default_prep_minutes,
    v_aggregator_rate,
    v_skrowia_rate,
    v_origin_latitude,
    v_origin_longitude
  from core.business_locations as location
  join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where location.id = v_cart.location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  if v_cart.status <> 'active' or v_cart.expires_at <= p_at then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if v_cart.customer_id is null or v_cart.customer_business_id is null then
    raise exception using errcode = '42501', message = 'checkout requires authentication';
  end if;

  if not v_ordering_enabled
     or (
       not v_accept_when_closed
       and not private.is_location_open_at(v_cart.location_id, p_at)
     ) then
    raise exception using errcode = '55000', message = 'restaurant is not accepting orders';
  end if;

  if p_fulfillment_type not in ('delivery', 'pickup')
     or (p_fulfillment_type = 'delivery' and v_ordering_mode not in ('delivery', 'both'))
     or (p_fulfillment_type = 'pickup' and v_ordering_mode not in ('pickup', 'both')) then
    raise exception using errcode = '22023', message = 'fulfillment type is unavailable';
  end if;

  if v_aggregator_rate is null then
    raise exception using
      errcode = '55000',
      message = 'aggregator benchmark rate must be configured before checkout';
  end if;

  if not exists (
    select 1 from ordering.cart_items as item where item.cart_id = p_cart_id
  ) then
    raise exception using errcode = '22023', message = 'cart is empty';
  end if;

  if exists (
    select 1
    from ordering.cart_items as item
    left join ordering.products as product
      on product.id = item.product_id
    left join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = product.business_id
    left join ordering.product_locations as location_override
      on location_override.product_id = product.id
     and location_override.location_id = v_cart.location_id
    where item.cart_id = p_cart_id
      and (
        product.id is null
        or product.business_id <> v_cart.business_id
        or not product.is_active
        or not product.is_available
        or not coalesce(location_override.is_available, true)
        or category.id is null
        or not category.is_active
        or (category.location_id is not null
            and category.location_id <> v_cart.location_id)
        or not private.catalog_target_available_at(
          v_cart.location_id, category.id, null, p_at
        )
        or not private.catalog_target_available_at(
          v_cart.location_id, null, product.id, p_at
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'cart contains an unavailable product';
  end if;

  if exists (
    select 1
    from ordering.cart_item_options as selection
    join ordering.cart_items as item
      on item.id = selection.cart_item_id
    left join ordering.options as option_item
      on option_item.id = selection.option_id
    left join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
    left join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
     and attachment.option_group_id = option_group.id
    where item.cart_id = p_cart_id
      and (
        option_item.id is null
        or not option_item.is_active
        or not option_item.is_available
        or not option_group.is_active
        or attachment.product_id is null
      )
  ) then
    raise exception using errcode = '22023', message = 'cart contains an unavailable option';
  end if;

  if exists (
    with selected as (
      select
        item.id as cart_item_id,
        option_item.option_group_id,
        sum(selection.quantity) as selected_count
      from ordering.cart_items as item
      join ordering.cart_item_options as selection
        on selection.cart_item_id = item.id
      join ordering.options as option_item
        on option_item.id = selection.option_id
      where item.cart_id = p_cart_id
      group by item.id, option_item.option_group_id
    )
    select 1
    from ordering.cart_items as item
    join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
    join ordering.option_groups as option_group
      on option_group.id = attachment.option_group_id
     and option_group.is_active
    left join selected
      on selected.cart_item_id = item.id
     and selected.option_group_id = option_group.id
    where item.cart_id = p_cart_id
      and coalesce(selected.selected_count, 0)
        not between option_group.min_selections and option_group.max_selections
  ) then
    raise exception using errcode = '22023', message = 'cart option selections are incomplete';
  end if;

  v_food_subtotal := private.current_cart_subtotal(p_cart_id);

  if v_food_subtotal < v_restaurant_minimum then
    raise exception using errcode = '22023', message = 'restaurant minimum order value is not met';
  end if;

  if v_cart.coupon_id is not null then
    select coupon.code
    into v_coupon_code
    from ordering.coupons as coupon
    where coupon.business_id = v_cart.business_id
      and coupon.id = v_cart.coupon_id;

    v_coupon_validation := ordering.validate_coupon(
      v_cart.business_id,
      v_cart.location_id,
      v_coupon_code,
      v_food_subtotal,
      p_at
    );

    if not coalesce((v_coupon_validation ->> 'valid')::boolean, false) then
      raise exception using errcode = '22023', message = 'attached coupon is unavailable';
    end if;

    v_coupon_id := (v_coupon_validation ->> 'coupon_id')::uuid;
    v_coupon_code := v_coupon_validation ->> 'code';
    v_coupon_discount := (v_coupon_validation ->> 'discount_amount')::numeric;
  end if;

  v_net_food := round(v_food_subtotal - v_coupon_discount, 2);

  select max(coalesce(product.prep_time_minutes, v_default_prep_minutes))
  into v_kitchen_minutes
  from ordering.cart_items as item
  join ordering.products as product
    on product.id = item.product_id
  where item.cart_id = p_cart_id;

  if p_fulfillment_type = 'delivery' then
    select
      jsonb_build_object(
        'schema_version', 1,
        'label', address.label,
        'recipient_name', address.recipient_name,
        'recipient_phone', address.recipient_phone,
        'address_line_1', address.address_line_1,
        'address_line_2', address.address_line_2,
        'landmark', address.landmark,
        'locality', address.locality,
        'city', address.city,
        'state', address.state,
        'postal_code', address.postal_code,
        'delivery_instructions', address.delivery_instructions
      ),
      address.latitude,
      address.longitude
    into v_address, v_destination_latitude, v_destination_longitude
    from core.customer_business_addresses as address
    where address.id = p_customer_business_address_id
      and address.customer_business_id = v_cart.customer_business_id
      and address.business_id = v_cart.business_id
      and address.customer_id = v_cart.customer_id;

    if v_address is null then
      raise exception using errcode = '22023', message = 'owned delivery address is required';
    end if;

    v_distance := private.haversine_distance_km(
      v_origin_latitude,
      v_origin_longitude,
      v_destination_latitude,
      v_destination_longitude
    );

    select
      zone.id,
      zone.minimum_order_value,
      zone.delivery_fee,
      zone.free_delivery_threshold,
      zone.estimated_delivery_cost
    into
      v_delivery_zone_id,
      v_zone_minimum,
      v_normal_delivery_fee,
      v_free_delivery_threshold,
      v_estimated_delivery_cost
    from ordering.delivery_zones as zone
    where zone.location_id = v_cart.location_id
      and zone.is_active
      and v_distance >= zone.min_distance_km::double precision
      and v_distance < zone.max_distance_km::double precision
    order by zone.min_distance_km, zone.id
    limit 1;

    if v_delivery_zone_id is null then
      raise exception using errcode = '22023', message = 'delivery address is unserviceable';
    end if;

    if v_food_subtotal < v_zone_minimum then
      raise exception using errcode = '22023', message = 'delivery-zone minimum is not met';
    end if;

    v_delivery_fee := case
      when v_free_delivery_threshold is not null
       and v_net_food >= v_free_delivery_threshold then 0
      else v_normal_delivery_fee
    end;

    if p_trusted_delivery_minutes is null
       or p_trusted_delivery_minutes < v_kitchen_minutes
       or p_trusted_delivery_minutes > 1440 then
      raise exception using
        errcode = '22023',
        message = 'trusted delivery estimate must include kitchen preparation time';
    end if;

    v_estimated_minutes := p_trusted_delivery_minutes;
  else
    if p_customer_business_address_id is not null then
      raise exception using errcode = '22023', message = 'pickup does not accept a delivery address';
    end if;

    v_estimated_minutes := v_kitchen_minutes;
  end if;

  v_tax_total := case
    when v_tax_mode = 'none' then 0
    when v_tax_mode = 'inclusive' then
      round(v_net_food * v_tax_rate / (100 + v_tax_rate), 2)
    else
      round(v_net_food * v_tax_rate / 100, 2)
  end;

  v_grand_total := case
    when v_tax_mode = 'exclusive' then
      round(v_net_food + v_tax_total + v_delivery_fee, 2)
    else
      round(v_net_food + v_delivery_fee, 2)
  end;

  return jsonb_build_object(
    'business_id', v_cart.business_id,
    'location_id', v_cart.location_id,
    'customer_id', v_cart.customer_id,
    'customer_business_id', v_cart.customer_business_id,
    'acquisition_source_id', v_cart.acquisition_source_id,
    'fulfillment_type', p_fulfillment_type,
    'currency', v_currency,
    'food_subtotal', v_food_subtotal,
    'discount_total', v_coupon_discount,
    'coupon_id', v_coupon_id,
    'coupon_code', v_coupon_code,
    'coupon_discount_amount', v_coupon_discount,
    'loyalty_redeemed', 0,
    'tax_total', v_tax_total,
    'delivery_fee', v_delivery_fee,
    'grand_total', v_grand_total,
    'delivery_address_snapshot', v_address,
    'latitude', v_destination_latitude,
    'longitude', v_destination_longitude,
    'delivery_zone_id', v_delivery_zone_id,
    'delivery_distance_km', case
      when v_distance is null then null
      else round(v_distance::numeric, 3)
    end,
    'normal_delivery_fee', v_normal_delivery_fee,
    'estimated_delivery_cost', v_estimated_delivery_cost,
    'aggregator_benchmark_rate_snapshot', v_aggregator_rate,
    'skrowia_commission_rate_snapshot', v_skrowia_rate,
    'skrowia_commissionable_amount', greatest(v_net_food, 0),
    'estimated_delivery_minutes', v_estimated_minutes,
    'tax_mode', v_tax_mode,
    'tax_rate', v_tax_rate
  );
end;
$function$;

grant execute on function "private"."calculate_order_quote"(uuid, text, uuid, smallint, timestamp with time zone) to "postgres";

revoke all on function "private"."calculate_order_quote"(uuid, text, uuid, smallint, timestamp with time zone) from public;
