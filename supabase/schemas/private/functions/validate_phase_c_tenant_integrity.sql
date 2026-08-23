create or replace function private.validate_phase_c_tenant_integrity()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_left_business_id uuid;
  v_right_business_id uuid;
  v_target_location_id uuid;
begin
  if tg_table_schema <> 'ordering' then
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C tenant-integrity target';
  end if;

  if tg_table_name = 'product_locations' then
    select product.business_id
    into v_left_business_id
    from ordering.products as product
    where product.id = new.product_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'product does not exist';
    end if;

    select location.business_id
    into v_right_business_id
    from core.business_locations as location
    where location.id = new.location_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'location does not exist';
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'product and location must belong to the same business';
    end if;

  elsif tg_table_name = 'product_option_groups' then
    select product.business_id
    into v_left_business_id
    from ordering.products as product
    where product.id = new.product_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'product does not exist';
    end if;

    select option_group.business_id
    into v_right_business_id
    from ordering.option_groups as option_group
    where option_group.id = new.option_group_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'option group does not exist';
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'product and option group must belong to the same business';
    end if;

  elsif tg_table_name = 'catalog_availability_windows' then
    if (new.category_id is null) = (new.product_id is null) then
      raise exception using
        errcode = '23514',
        message = 'exactly one catalog availability target is required';
    end if;

    select location.business_id
    into v_right_business_id
    from core.business_locations as location
    where location.id = new.location_id
    for update;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'location does not exist';
    end if;

    if new.category_id is not null then
      select category.business_id, category.location_id
      into v_left_business_id, v_target_location_id
      from ordering.menu_categories as category
      where category.id = new.category_id;

      if not found then
        raise exception using
          errcode = '23503',
          message = 'category does not exist';
      end if;

    else
      select product.business_id, category.location_id
      into v_left_business_id, v_target_location_id
      from ordering.products as product
      join ordering.menu_categories as category
        on category.business_id = product.business_id
       and category.id = product.category_id
      where product.id = new.product_id
      for update of product;

      if not found then
        raise exception using
          errcode = '23503',
          message = 'product does not exist';
      end if;
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'catalog target and location must belong to the same business';
    end if;

    if v_target_location_id is not null
       and v_target_location_id <> new.location_id then
      raise exception using
        errcode = '23514',
        message = 'outlet-specific catalog target must use its own location';
    end if;

  else
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C tenant-integrity target';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_phase_c_tenant_integrity"() to "postgres";

revoke all on function "private"."validate_phase_c_tenant_integrity"() from public;
