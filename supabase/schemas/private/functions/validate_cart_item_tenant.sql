create or replace function private.validate_cart_item_tenant()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if not exists (
    select 1
    from ordering.carts as cart
    join ordering.products as product
      on product.id = new.product_id
     and product.business_id = cart.business_id
    join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = cart.business_id
     and (category.location_id is null or category.location_id = cart.location_id)
    where cart.id = new.cart_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'cart product must belong to the cart business and location scope';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_cart_item_tenant"() to "postgres";

revoke all on function "private"."validate_cart_item_tenant"() from public;
