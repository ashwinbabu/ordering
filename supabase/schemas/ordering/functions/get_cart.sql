create or replace function ordering.get_cart (
  p_cart_id              uuid,
  p_anonymous_session_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using
      errcode = '42501',
      message = 'cart access denied';
  end if;

  select jsonb_build_object(
    'id', cart.id,
    'business_id', cart.business_id,
    'location_id', cart.location_id,
    'status', cart.status,
    'is_authenticated', cart.customer_id is not null,
    'updated_at', cart.updated_at,
    'expires_at', cart.expires_at,
    'estimated_food_subtotal', private.current_cart_subtotal(cart.id),
    'coupon', case
      when coupon.id is null then null
      else jsonb_build_object('id', coupon.id, 'code', coupon.code)
    end,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'product_id', product.id,
          'product_name', product.name,
          'quantity', item.quantity,
          'customer_note', item.customer_note,
          'base_unit_price', coalesce(
            location_override.price_override,
            product.base_price
          ),
          'modifier_unit_total', coalesce(option_total.amount, 0),
          'estimated_line_total', round((
            coalesce(location_override.price_override, product.base_price)
            + coalesce(option_total.amount, 0)
          ) * item.quantity, 2),
          'options', coalesce(option_total.options, '[]'::jsonb)
        )
        order by item.created_at, item.id
      )
      from ordering.cart_items as item
      join ordering.products as product
        on product.id = item.product_id
      left join ordering.product_locations as location_override
        on location_override.product_id = product.id
       and location_override.location_id = cart.location_id
      left join lateral (
        select
          sum(option_item.price_delta * selection.quantity) as amount,
          jsonb_agg(
            jsonb_build_object(
              'option_id', option_item.id,
              'name', option_item.name,
              'price_delta', option_item.price_delta,
              'quantity', selection.quantity
            )
            order by option_group.sort_order, option_item.sort_order,
              option_item.id
          ) as options
        from ordering.cart_item_options as selection
        join ordering.options as option_item
          on option_item.id = selection.option_id
        join ordering.option_groups as option_group
          on option_group.id = option_item.option_group_id
        where selection.cart_item_id = item.id
      ) as option_total on true
      where item.cart_id = cart.id
    ), '[]'::jsonb)
  )
  into v_result
  from ordering.carts as cart
  left join ordering.coupons as coupon
    on coupon.business_id = cart.business_id
   and coupon.id = cart.coupon_id
  where cart.id = p_cart_id;

  return v_result;
end;
$function$;

grant execute on function "ordering"."get_cart"(uuid, uuid) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_cart"(uuid, uuid) from public;
