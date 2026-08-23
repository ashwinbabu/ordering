create or replace function ordering.checkout_cart (
  p_order_id                     uuid,
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_customer_note                text     default null::text,
  p_trusted_delivery_minutes     smallint default null::smallint,
  p_payment_method               text     default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_quote jsonb;
  v_order_number text;
  v_order_number_prefix text;
  v_order_number_sequence integer;
  v_order_number_date date;
  v_business_slug text;
  v_business_timezone text;
  v_customer_name text;
  v_customer_phone text;
  v_line_total numeric(14, 2);
  v_actor_type text;
  v_actor_id uuid;
  v_payment_method text;
  v_status text;
  v_placed_at timestamptz;
begin
  if p_order_id is null or p_cart_id is null then
    raise exception using
      errcode = '22023',
      message = 'stable order and cart identifiers are required';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));

  if v_payment_method not in ('online', 'cash') then
    raise exception using
      errcode = '22023',
      message = 'unsupported payment method';
  end if;

  -- A cash order is complete the moment it is created: there is no provider
  -- hand-off to wait on, so it goes straight to 'placed' with placed_at set
  -- (orders_status_milestones_check requires placed_at whenever status is
  -- anything other than payment_pending/cancelled).
  v_status := case when v_payment_method = 'cash' then 'placed' else 'payment_pending' end;
  v_placed_at := case when v_payment_method = 'cash' then now() else null end;

  if not (select private.can_access_cart(p_cart_id, null)) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status = 'converted' then
    if v_cart.converted_order_id = p_order_id then
      return ordering.get_order(p_order_id);
    end if;
    raise exception using errcode = '55000', message = 'cart is already converted';
  end if;

  if v_cart.customer_id is null or v_cart.customer_business_id is null then
    raise exception using errcode = '42501', message = 'checkout requires authentication';
  end if;

  perform 1
  from ordering.restaurant_settings as settings
  where settings.location_id = v_cart.location_id
  for share;

  perform product.id
  from ordering.products as product
  join ordering.cart_items as item
    on item.product_id = product.id
  where item.cart_id = p_cart_id
  order by product.id
  for share of product;

  perform option_item.id
  from ordering.options as option_item
  join ordering.cart_item_options as selection
    on selection.option_id = option_item.id
  join ordering.cart_items as item
    on item.id = selection.cart_item_id
  where item.cart_id = p_cart_id
  order by option_item.id
  for share of option_item;

  v_quote := private.calculate_order_quote(
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_trusted_delivery_minutes,
    now()
  );

  select business.slug, business.timezone
  into v_business_slug, v_business_timezone
  from core.businesses as business
  where business.id = v_cart.business_id;

  select
    coalesce(nullif(btrim(customer.display_name), ''), 'Customer'),
    coalesce(customer.preferred_contact_phone_e164, customer.phone_e164)
  into v_customer_name, v_customer_phone
  from core.customers as customer
  where customer.id = v_cart.customer_id;

  if v_customer_phone is null then
    raise exception using
      errcode = '22023',
      message = 'a contact phone is required before checkout';
  end if;

  v_order_number_date := (now() at time zone v_business_timezone)::date;

  v_order_number_prefix := upper(
    coalesce(nullif(left(regexp_replace(v_business_slug, '[^a-z0-9]', '', 'g'), 4), ''), 'A2')
    || '-' || to_char(v_order_number_date, 'YYMMDD')
    || '-'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_cart.business_id::text || ':' || v_order_number_date::text,
      0
    )
  );

  select coalesce(max(
    substring(placed_order.order_number from '([0-9]+)$')::integer
  ), 0) + 1
  into v_order_number_sequence
  from ordering.orders as placed_order
  where placed_order.business_id = v_cart.business_id
    and left(placed_order.order_number, char_length(v_order_number_prefix))
      = v_order_number_prefix;

  if v_order_number_sequence > 999999 then
    raise exception using
      errcode = '54000',
      message = 'daily order number capacity exceeded';
  end if;

  v_order_number := v_order_number_prefix
    || lpad(v_order_number_sequence::text, 6, '0');

  insert into ordering.orders (
    id,
    order_number,
    business_id,
    location_id,
    customer_id,
    customer_business_id,
    acquisition_source_id,
    fulfillment_type,
    status,
    payment_status,
    payment_method,
    placed_at,
    currency,
    food_subtotal,
    discount_total,
    tax_total,
    delivery_fee,
    loyalty_redeemed,
    grand_total,
    customer_name_snapshot,
    customer_phone_snapshot,
    delivery_address_snapshot,
    latitude,
    longitude,
    customer_note,
    delivery_zone_id,
    delivery_distance_km,
    normal_delivery_fee,
    estimated_delivery_cost,
    aggregator_benchmark_rate_snapshot,
    skrowia_commission_rate_snapshot,
    skrowia_commissionable_amount,
    estimated_delivery_minutes,
    coupon_id,
    coupon_code_snapshot,
    coupon_discount_amount
  ) values (
    p_order_id,
    v_order_number,
    (v_quote ->> 'business_id')::uuid,
    (v_quote ->> 'location_id')::uuid,
    (v_quote ->> 'customer_id')::uuid,
    (v_quote ->> 'customer_business_id')::uuid,
    (v_quote ->> 'acquisition_source_id')::uuid,
    v_quote ->> 'fulfillment_type',
    v_status,
    'pending',
    v_payment_method,
    v_placed_at,
    v_quote ->> 'currency',
    (v_quote ->> 'food_subtotal')::numeric,
    (v_quote ->> 'discount_total')::numeric,
    (v_quote ->> 'tax_total')::numeric,
    (v_quote ->> 'delivery_fee')::numeric,
    0,
    (v_quote ->> 'grand_total')::numeric,
    v_customer_name,
    v_customer_phone,
    nullif(v_quote -> 'delivery_address_snapshot', 'null'::jsonb),
    (v_quote ->> 'latitude')::numeric,
    (v_quote ->> 'longitude')::numeric,
    nullif(btrim(p_customer_note), ''),
    (v_quote ->> 'delivery_zone_id')::uuid,
    (v_quote ->> 'delivery_distance_km')::numeric,
    (v_quote ->> 'normal_delivery_fee')::numeric,
    (v_quote ->> 'estimated_delivery_cost')::numeric,
    (v_quote ->> 'aggregator_benchmark_rate_snapshot')::numeric,
    (v_quote ->> 'skrowia_commission_rate_snapshot')::numeric,
    (v_quote ->> 'skrowia_commissionable_amount')::numeric,
    (v_quote ->> 'estimated_delivery_minutes')::smallint,
    (v_quote ->> 'coupon_id')::uuid,
    v_quote ->> 'coupon_code',
    (v_quote ->> 'coupon_discount_amount')::numeric
  );

  insert into ordering.order_items (
    id,
    order_id,
    product_id,
    product_name,
    quantity,
    base_unit_price,
    modifier_unit_total,
    final_unit_price,
    line_total,
    customer_note,
    category_id_snapshot
  )
  select
    private.snapshot_order_item_id(p_order_id, item.id),
    p_order_id,
    product.id,
    product.name,
    item.quantity,
    coalesce(location_override.price_override, product.base_price),
    coalesce(option_total.amount, 0),
    coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0),
    round((
      coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0)
    ) * item.quantity, 2),
    item.customer_note,
    product.category_id
  from ordering.cart_items as item
  join ordering.products as product
    on product.id = item.product_id
  left join ordering.product_locations as location_override
    on location_override.product_id = product.id
   and location_override.location_id = v_cart.location_id
  left join lateral (
    select sum(option_item.price_delta * selection.quantity) as amount
    from ordering.cart_item_options as selection
    join ordering.options as option_item
      on option_item.id = selection.option_id
    where selection.cart_item_id = item.id
  ) as option_total on true
  where item.cart_id = p_cart_id;

  insert into ordering.order_item_options (
    order_item_id,
    option_group_name,
    option_id,
    option_name,
    price_delta,
    quantity
  )
  select
    private.snapshot_order_item_id(p_order_id, item.id),
    option_group.name,
    option_item.id,
    option_item.name,
    option_item.price_delta,
    selection.quantity
  from ordering.cart_items as item
  join ordering.cart_item_options as selection
    on selection.cart_item_id = item.id
  join ordering.options as option_item
    on option_item.id = selection.option_id
  join ordering.option_groups as option_group
    on option_group.id = option_item.option_group_id
  where item.cart_id = p_cart_id;

  select coalesce(sum(item.line_total), 0)
  into v_line_total
  from ordering.order_items as item
  where item.order_id = p_order_id;

  if v_line_total <> (v_quote ->> 'food_subtotal')::numeric then
    raise exception using
      errcode = '23514',
      message = 'order line snapshots do not reconcile to food subtotal';
  end if;

  v_actor_type := case when (select auth.uid()) is null then 'system' else 'customer' end;
  v_actor_id := case when v_actor_type = 'customer' then v_cart.customer_id else null end;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_cart.business_id,
    'order_created',
    null,
    v_status,
    v_actor_type,
    v_actor_id,
    jsonb_build_object(
      'schema_version', 1,
      'cart_id', p_cart_id,
      'payment_method', v_payment_method
    )
  );

  update ordering.carts
  set status = 'converted',
      converted_order_id = p_order_id
  where id = p_cart_id
    and status = 'active';

  if not found then
    raise exception using errcode = '40001', message = 'cart conversion lost a race';
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

grant execute on function "ordering"."checkout_cart"(uuid, uuid, text, uuid, text, smallint, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."checkout_cart"(uuid, uuid, text, uuid, text, smallint, text) from public;
