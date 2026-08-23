create or replace function ordering.get_menu (
  p_business_id uuid,
  p_location_id uuid
)
  returns jsonb
  language plpgsql
  stable
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read a menu.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to read this menu.' using errcode = '42501';
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

  return (
    with scoped_categories as (
      select
        category.id,
        category.name,
        category.description,
        category.sort_order,
        category.is_active,
        category.updated_at
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    ),
    scoped_products as (
      select
        product.id,
        product.category_id,
        product.name,
        product.description,
        product.base_price,
        product.image_url,
        product.dietary_type,
        product.is_available,
        product.sort_order,
        product.prep_time_minutes,
        product.updated_at
      from ordering.products as product
      join scoped_categories as category on category.id = product.category_id
      where product.business_id = p_business_id
        and product.is_active
    ),
    scoped_product_locations as (
      select product_location.product_id, product_location.is_available
      from ordering.product_locations as product_location
      join scoped_products as product on product.id = product_location.product_id
      where product_location.location_id = p_location_id
    ),
    scoped_availability_windows as (
      select
        availability_window.category_id,
        availability_window.product_id,
        availability_window.day_of_week,
        availability_window.starts_at,
        availability_window.ends_at
      from ordering.catalog_availability_windows as availability_window
      where availability_window.location_id = p_location_id
        and (
          availability_window.category_id in (select id from scoped_categories)
          or availability_window.product_id in (select id from scoped_products)
        )
    ),
    scoped_product_option_groups as (
      select
        product_option_group.product_id,
        product_option_group.option_group_id,
        product_option_group.sort_order
      from ordering.product_option_groups as product_option_group
      join scoped_products as product on product.id = product_option_group.product_id
    ),
    scoped_option_groups as (
      select
        option_group.id,
        option_group.name,
        option_group.selection_type,
        option_group.min_selections,
        option_group.max_selections,
        option_group.sort_order
      from ordering.option_groups as option_group
      where option_group.business_id = p_business_id
        and option_group.is_active
        and option_group.id in (
          select distinct option_group_id
          from scoped_product_option_groups
        )
    ),
    scoped_options as (
      select
        option.id,
        option.option_group_id,
        option.name,
        option.price_delta,
        option.is_available,
        option.sort_order
      from ordering.options as option
      join scoped_option_groups as option_group
        on option_group.id = option.option_group_id
      where option.is_active
    )
    select jsonb_build_object(
      'schema_version', 1,
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'description', category.description,
          'sort_order', category.sort_order,
          'is_active', category.is_active,
          'updated_at', category.updated_at
        ) order by category.sort_order, category.id)
        from scoped_categories as category
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', product.id,
          'category_id', product.category_id,
          'name', product.name,
          'description', product.description,
          'base_price', product.base_price,
          'image_url', product.image_url,
          'dietary_type', product.dietary_type,
          'is_available', product.is_available,
          'sort_order', product.sort_order,
          'prep_time_minutes', product.prep_time_minutes,
          'updated_at', product.updated_at
        ) order by product.sort_order, product.id)
        from scoped_products as product
      ), '[]'::jsonb),
      'product_locations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', product_location.product_id,
          'is_available', product_location.is_available
        ) order by product_location.product_id)
        from scoped_product_locations as product_location
      ), '[]'::jsonb),
      'availability_windows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'category_id', availability_window.category_id,
          'product_id', availability_window.product_id,
          'day_of_week', availability_window.day_of_week,
          'starts_at', availability_window.starts_at,
          'ends_at', availability_window.ends_at
        ) order by
          availability_window.category_id nulls last,
          availability_window.product_id nulls last,
          availability_window.day_of_week,
          availability_window.starts_at,
          availability_window.ends_at)
        from scoped_availability_windows as availability_window
      ), '[]'::jsonb),
      'product_option_groups', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', product_option_group.product_id,
          'option_group_id', product_option_group.option_group_id,
          'sort_order', product_option_group.sort_order
        ) order by
          product_option_group.product_id,
          product_option_group.sort_order,
          product_option_group.option_group_id)
        from scoped_product_option_groups as product_option_group
      ), '[]'::jsonb),
      'option_groups', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option_group.id,
          'name', option_group.name,
          'selection_type', option_group.selection_type,
          'min_selections', option_group.min_selections,
          'max_selections', option_group.max_selections,
          'sort_order', option_group.sort_order
        ) order by option_group.sort_order, option_group.id)
        from scoped_option_groups as option_group
      ), '[]'::jsonb),
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option.id,
          'option_group_id', option.option_group_id,
          'name', option.name,
          'price_delta', option.price_delta,
          'is_available', option.is_available,
          'sort_order', option.sort_order
        ) order by option.sort_order, option.id)
        from scoped_options as option
      ), '[]'::jsonb)
    )
  );
end;
$function$;

grant execute on function "ordering"."get_menu"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_menu"(uuid, uuid) from public;
