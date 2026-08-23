create or replace function ordering.set_cart_item (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_cart_item_id         uuid,
  p_product_id           uuid,
  p_quantity             integer,
  p_customer_note        text    default null::text,
  p_options              jsonb   default '[]'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_now timestamptz := now();
  v_written_id uuid;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  if p_cart_item_id is null
     or p_product_id is null
     or p_quantity is null
     or p_quantity <= 0
     or p_options is null
     or jsonb_typeof(p_options) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'valid item, product, quantity, and option array are required';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status <> 'active' or v_cart.expires_at <= v_now then
    if v_cart.status = 'active' and v_cart.expires_at <= v_now then
      update ordering.carts set status = 'expired' where id = p_cart_id;
    end if;
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if not exists (
    select 1
    from ordering.products as product
    join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = product.business_id
    join ordering.restaurant_settings as settings
      on settings.location_id = v_cart.location_id
    left join ordering.product_locations as location_override
      on location_override.product_id = product.id
     and location_override.location_id = v_cart.location_id
    where product.id = p_product_id
      and product.business_id = v_cart.business_id
      and product.is_active
      and product.is_available
      and coalesce(location_override.is_available, true)
      and category.is_active
      and (category.location_id is null or category.location_id = v_cart.location_id)
      and settings.ordering_enabled
      and (
        settings.accept_orders_when_closed
        or private.is_location_open_at(v_cart.location_id, v_now)
      )
      and private.catalog_target_available_at(
        v_cart.location_id,
        category.id,
        null,
        v_now
      )
      and private.catalog_target_available_at(
        v_cart.location_id,
        null,
        product.id,
        v_now
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'product is unavailable for this cart';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value ->> 'option_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'each option requires a UUID option_id and positive quantity';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as entry(value)
    group by (entry.value ->> 'option_id')::uuid
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'duplicate option selections are not allowed';
  end if;

  if exists (
    with selected as (
      select
        (entry.value ->> 'option_id')::uuid as option_id,
        (entry.value ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_options) as entry(value)
    )
    select 1
    from selected
    left join ordering.options as option_item
      on option_item.id = selected.option_id
    left join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
    left join ordering.product_option_groups as attachment
      on attachment.product_id = p_product_id
     and attachment.option_group_id = option_group.id
    where option_item.id is null
      or not option_item.is_active
      or not option_item.is_available
      or not option_group.is_active
      or attachment.product_id is null
      or selected.quantity <= 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'one or more selected options are unavailable or unattached';
  end if;

  if exists (
    with selected as (
      select
        option_item.option_group_id,
        sum((entry.value ->> 'quantity')::integer) as selected_count
      from jsonb_array_elements(p_options) as entry(value)
      join ordering.options as option_item
        on option_item.id = (entry.value ->> 'option_id')::uuid
      group by option_item.option_group_id
    )
    select 1
    from ordering.product_option_groups as attachment
    join ordering.option_groups as option_group
      on option_group.id = attachment.option_group_id
    left join selected
      on selected.option_group_id = option_group.id
    where attachment.product_id = p_product_id
      and option_group.is_active
      and coalesce(selected.selected_count, 0)
        not between option_group.min_selections and option_group.max_selections
  ) then
    raise exception using
      errcode = '22023',
      message = 'option selection count violates a product option group';
  end if;

  insert into ordering.cart_items as existing_item (
    id,
    cart_id,
    product_id,
    quantity,
    customer_note
  ) values (
    p_cart_item_id,
    p_cart_id,
    p_product_id,
    p_quantity,
    nullif(btrim(p_customer_note), '')
  )
  on conflict (id)
  do update
    set quantity = excluded.quantity,
        customer_note = excluded.customer_note
    where existing_item.cart_id = p_cart_id
      and existing_item.product_id = p_product_id
  returning existing_item.id into v_written_id;

  if v_written_id is null then
    raise exception using
      errcode = '23505',
      message = 'cart item identifier belongs to a different line';
  end if;

  delete from ordering.cart_item_options
  where cart_item_id = p_cart_item_id;

  insert into ordering.cart_item_options (cart_item_id, option_id, quantity)
  select
    p_cart_item_id,
    (entry.value ->> 'option_id')::uuid,
    (entry.value ->> 'quantity')::integer
  from jsonb_array_elements(p_options) as entry(value);

  update ordering.carts
  set expires_at = v_now + interval '30 days'
  where id = p_cart_id;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

grant execute on function "ordering"."set_cart_item"(uuid, uuid, uuid, uuid, integer, text, jsonb) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."set_cart_item"(uuid, uuid, uuid, uuid, integer, text, jsonb) from public;
