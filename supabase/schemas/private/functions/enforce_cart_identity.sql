create or replace function private.enforce_cart_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if tg_table_name = 'carts' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'cart identity, business, and location are immutable';
    end if;
  elsif tg_table_name = 'cart_items' then
    if new.id is distinct from old.id
       or new.product_id is distinct from old.product_id then
      raise exception using
        errcode = '23514',
        message = 'cart-item identity and product are immutable';
    end if;
  elsif tg_table_name = 'cart_item_options' then
    if new.cart_item_id is distinct from old.cart_item_id
       or new.option_id is distinct from old.option_id then
      raise exception using
        errcode = '23514',
        message = 'cart-item option identity is immutable';
    end if;
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_cart_identity"() to "postgres";

revoke all on function "private"."enforce_cart_identity"() from public;
