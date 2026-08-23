create or replace function private.enforce_phase_c_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if tg_table_schema <> 'ordering' then
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C trigger target';
  end if;

  if tg_table_name = 'restaurant_settings' then
    if new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'restaurant settings location_id is immutable';
    end if;

  elsif tg_table_name = 'opening_hours' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'opening-hours identity is immutable';
    end if;

  elsif tg_table_name = 'menu_categories' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'menu-category identity, business, and outlet scope are immutable';
    end if;

  elsif tg_table_name = 'products' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'product identity and business are immutable';
    end if;

  elsif tg_table_name = 'product_locations' then
    if new.product_id is distinct from old.product_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'product-location mapping identity is immutable';
    end if;

  elsif tg_table_name = 'option_groups' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'option-group identity and business are immutable';
    end if;

  elsif tg_table_name = 'options' then
    if new.id is distinct from old.id
       or new.option_group_id is distinct from old.option_group_id then
      raise exception using
        errcode = '23514',
        message = 'option identity and parent group are immutable';
    end if;

  elsif tg_table_name = 'product_option_groups' then
    if new.product_id is distinct from old.product_id
       or new.option_group_id is distinct from old.option_group_id then
      raise exception using
        errcode = '23514',
        message = 'product-option-group mapping identity is immutable';
    end if;

  elsif tg_table_name = 'delivery_zones' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'delivery-zone identity and location are immutable';
    end if;

  elsif tg_table_name = 'catalog_availability_windows' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id
       or new.category_id is distinct from old.category_id
       or new.product_id is distinct from old.product_id then
      raise exception using
        errcode = '23514',
        message = 'catalog availability target and location are immutable';
    end if;

  else
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C trigger target';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_phase_c_identity"() to "postgres";

revoke all on function "private"."enforce_phase_c_identity"() from public;
