create or replace function ordering.save_menu_changes_with_baseline (
  p_business_id          uuid,
  p_location_id          uuid,
  p_baseline             jsonb,
  p_menu                 jsonb,
  p_featured_product_ids uuid[] default null::uuid[]
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_menu_for_save jsonb;
  v_removed_category_ids uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save a menu.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to manage this menu.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if p_menu is null
    or jsonb_typeof(p_menu) <> 'object'
    or jsonb_typeof(p_menu -> 'removed_category_ids') <> 'array' then
    raise exception 'The menu save payload is incomplete.' using errcode = '22023';
  end if;

  select coalesce(array_agg(item.id), '{}'::uuid[])
  into v_removed_category_ids
  from jsonb_to_recordset(p_menu -> 'removed_category_ids') as item(id uuid);

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'removed_category_ids') as item(id uuid)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'A category can only be removed once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_removed_category_ids) as removed(id)
    left join jsonb_to_recordset(p_baseline -> 'categories') as baseline(id uuid, updated_at timestamptz)
      on baseline.id = removed.id
    where baseline.id is null
  ) then
    raise exception 'Only categories from the current menu can be removed.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'categories') as category(id uuid, name text, description text, sort_order integer, is_active boolean)
    join unnest(v_removed_category_ids) as removed(id)
      on removed.id = category.id
  ) then
    raise exception 'A removed category cannot also be saved.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_baseline -> 'categories') as baseline(id uuid, updated_at timestamptz)
    left join jsonb_to_recordset(p_menu -> 'categories') as category(id uuid, name text, description text, sort_order integer, is_active boolean)
      on category.id = baseline.id
    left join unnest(v_removed_category_ids) as removed(id)
      on removed.id = baseline.id
    where category.id is null
      and removed.id is null
  ) then
    raise exception 'Categories must be saved or explicitly removed.' using errcode = '22023';
  end if;

  v_menu_for_save := jsonb_set(
    p_menu,
    '{categories}',
    (p_menu -> 'categories') || coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'description', category.description,
        'sort_order', category.sort_order,
        'is_active', category.is_active
      ) order by category.sort_order, category.id)
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
        and category.id = any(v_removed_category_ids)
    ), '[]'::jsonb)
  );

  perform ordering.save_menu_changes(
    p_business_id,
    p_location_id,
    p_baseline,
    v_menu_for_save
  );

  if exists (
    select 1
    from ordering.products as product
    where product.business_id = p_business_id
      and product.category_id = any(v_removed_category_ids)
  ) then
    raise exception 'A category with products cannot be deleted. Move or remove its products first.' using errcode = '23503';
  end if;

delete from ordering.catalog_availability_windows as availability_window
where availability_window.category_id = any(v_removed_category_ids);

  delete from ordering.menu_categories as category
  where category.business_id = p_business_id
    and category.location_id = p_location_id
    and category.id = any(v_removed_category_ids);

  if p_featured_product_ids is not null then
    perform ordering.save_featured_product_ids(
      p_business_id,
      p_location_id,
      p_featured_product_ids
    );
  end if;

  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'updated_at', category.updated_at
      ) order by category.sort_order, category.id)
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'updated_at', product.updated_at
      ) order by product.sort_order, product.id)
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      where product.business_id = p_business_id
        and category.location_id = p_location_id
        and product.is_active
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."save_menu_changes_with_baseline"(uuid, uuid, jsonb, jsonb, uuid[]) to "authenticated", "postgres";

revoke all on function "ordering"."save_menu_changes_with_baseline"(uuid, uuid, jsonb, jsonb, uuid[]) from public;
