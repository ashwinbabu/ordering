create or replace function private.current_cart_subtotal (
  p_cart_id uuid
)
  returns numeric
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select coalesce(round(sum(
    (
      coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0)
    ) * item.quantity
  ), 2), 0)::numeric(14, 2)
  from ordering.cart_items as item
  join ordering.carts as cart
    on cart.id = item.cart_id
  join ordering.products as product
    on product.id = item.product_id
  left join ordering.product_locations as location_override
    on location_override.product_id = product.id
   and location_override.location_id = cart.location_id
  left join lateral (
    select sum(option_item.price_delta * selection.quantity) as amount
    from ordering.cart_item_options as selection
    join ordering.options as option_item
      on option_item.id = selection.option_id
    where selection.cart_item_id = item.id
  ) as option_total on true
  where item.cart_id = p_cart_id;
$function$;

grant execute on function "private"."current_cart_subtotal"(uuid) to "postgres";

revoke all on function "private"."current_cart_subtotal"(uuid) from public;
