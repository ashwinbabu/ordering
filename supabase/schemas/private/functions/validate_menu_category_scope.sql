create or replace function private.validate_menu_category_scope()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform 1
  from core.businesses as business
  where business.id = new.business_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'business does not exist';
  end if;

  if new.location_id is null then
    if exists (
      select 1
      from ordering.menu_categories as category
      where category.business_id = new.business_id
        and category.location_id is not null
        and lower(btrim(category.name)) = lower(btrim(new.name))
        and category.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'global category name conflicts with an outlet category';
    end if;
  else
    if exists (
      select 1
      from ordering.menu_categories as category
      where category.business_id = new.business_id
        and category.location_id is null
        and lower(btrim(category.name)) = lower(btrim(new.name))
        and category.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'outlet category name conflicts with a global category';
    end if;
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_menu_category_scope"() to "postgres";

revoke all on function "private"."validate_menu_category_scope"() from public;
