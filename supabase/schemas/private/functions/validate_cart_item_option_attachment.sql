create or replace function private.validate_cart_item_option_attachment()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if not exists (
    select 1
    from ordering.cart_items as item
    join ordering.options as option_item
      on option_item.id = new.option_id
    join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
     and attachment.option_group_id = option_item.option_group_id
    join ordering.products as product
      on product.id = item.product_id
    join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
     and option_group.business_id = product.business_id
    where item.id = new.cart_item_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'selected option must belong to a group attached to the product';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_cart_item_option_attachment"() to "postgres";

revoke all on function "private"."validate_cart_item_option_attachment"() from public;
