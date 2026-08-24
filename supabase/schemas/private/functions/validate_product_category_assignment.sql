create or replace function private.validate_product_category_assignment()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_category_location_id uuid;
begin
  select category.location_id
  into v_category_location_id
  from ordering.menu_categories as category
  where category.business_id = new.business_id
    and category.id = new.category_id;

  if not found then
    return new;
  end if;

  if v_category_location_id is not null and exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.product_id = new.id
      and availability.location_id <> v_category_location_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'product availability windows conflict with the new outlet category';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_product_category_assignment"() to "postgres";

revoke all on function "private"."validate_product_category_assignment"() from public;
