-- Surfaces the business logo (added in 20260816120000_business_logo.sql) in
-- the public storefront menu boundary so the storefront header can render it.
-- Rebuilt from the version in 20260816080000_storefront_ordering_status.sql;
-- only the business.logoUrl field is new here.
create or replace function ordering.get_storefront_menu(p_location_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with requested_location as (
    select
      location.id as location_id,
      location.business_id,
      location.name as location_name,
      business.name as business_name,
      business.slug as business_slug,
      business.currency,
      business.logo_url as business_logo_url,
      business.timezone as business_timezone,
      -- Left joined: a location without a settings row still returns its menu,
      -- and defaults to accepting orders to match the Admin client default.
      coalesce(settings.ordering_enabled, true) as ordering_enabled
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    left join ordering.restaurant_settings as settings
      on settings.location_id = location.id
    where location.id = p_location_id
      and location.is_active
      and business.status = 'active'
  ), current_local_time as (
    select
      requested_location.*,
      extract(isodow from now() at time zone requested_location.business_timezone)::smallint as iso_day_of_week,
      (now() at time zone requested_location.business_timezone)::time as local_time
    from requested_location
  ), visible_categories as (
    select
      category.id,
      category.name,
      category.description,
      category.sort_order,
      current_local_time.location_id,
      current_local_time.business_id,
      current_local_time.iso_day_of_week,
      current_local_time.local_time,
      not exists (
        select 1
        from ordering.catalog_availability_windows as availability_window
        where availability_window.location_id = current_local_time.location_id
          and availability_window.category_id = category.id
      )
      or exists (
        select 1
        from ordering.catalog_availability_windows as availability_window
        where availability_window.location_id = current_local_time.location_id
          and availability_window.category_id = category.id
          and availability_window.day_of_week = current_local_time.iso_day_of_week
          and current_local_time.local_time >= availability_window.starts_at
          and current_local_time.local_time < availability_window.ends_at
      ) as schedule_available
    from current_local_time
    join ordering.menu_categories as category
      on category.business_id = current_local_time.business_id
     and (category.location_id = current_local_time.location_id or category.location_id is null)
    where category.is_active
  ), visible_products as (
    select
      product.id,
      product.category_id,
      product.name,
      product.description,
      coalesce(product_location.price_override, product.base_price) as base_price,
      product.image_url,
      product.dietary_type,
      product.sort_order,
      category.schedule_available
        and product.is_available
        and product_location.is_available
        and (
          not exists (
            select 1
            from ordering.catalog_availability_windows as availability_window
            where availability_window.location_id = category.location_id
              and availability_window.product_id = product.id
          )
          or exists (
            select 1
            from ordering.catalog_availability_windows as availability_window
            where availability_window.location_id = category.location_id
              and availability_window.product_id = product.id
              and availability_window.day_of_week = category.iso_day_of_week
              and category.local_time >= availability_window.starts_at
              and category.local_time < availability_window.ends_at
          )
        )
        and not exists (
          select 1
          from ordering.product_option_groups as product_option_group
          join ordering.option_groups as option_group
            on option_group.id = product_option_group.option_group_id
           and option_group.business_id = category.business_id
          where product_option_group.product_id = product.id
            and option_group.is_active
            and option_group.min_selections > 0
            and not exists (
              select 1
              from ordering.options as option
              where option.option_group_id = option_group.id
                and option.is_active
                and option.is_available
            )
        ) as available
    from visible_categories as category
    join ordering.products as product
      on product.category_id = category.id
     and product.business_id = category.business_id
     and product.is_active
    join ordering.product_locations as product_location
      on product_location.product_id = product.id
     and product_location.location_id = category.location_id
  ), categories_with_products as (
    select category.*
    from visible_categories as category
    where exists (
      select 1
      from visible_products as product
      where product.category_id = category.id
    )
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'orderingEnabled', location.ordering_enabled,
    'business', jsonb_build_object(
      'id', location.business_id,
      'name', location.business_name,
      'slug', location.business_slug,
      'currency', location.currency,
      'logoUrl', location.business_logo_url
    ),
    'location', jsonb_build_object(
      'id', location.location_id,
      'name', location.location_name
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'description', category.description,
          'sortOrder', category.sort_order,
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', product.id,
                'name', product.name,
                'description', product.description,
                'basePrice', product.base_price,
                'image', product.image_url,
                'dietaryType', product.dietary_type,
                'available', product.available,
                'sortOrder', product.sort_order,
                'optionGroups', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', option_group.id,
                      'name', option_group.name,
                      'selectionType', option_group.selection_type,
                      'minSelections', option_group.min_selections,
                      'maxSelections', option_group.max_selections,
                      'sortOrder', product_option_group.sort_order,
                      'options', coalesce((
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', option.id,
                            'name', option.name,
                            'priceDelta', option.price_delta,
                            'available', option.is_available,
                            'sortOrder', option.sort_order
                          )
                          order by option.sort_order, option.id
                        )
                        from ordering.options as option
                        where option.option_group_id = option_group.id
                          and option.is_active
                          and option.is_available
                      ), '[]'::jsonb)
                    )
                    order by product_option_group.sort_order, option_group.id
                  )
                  from ordering.product_option_groups as product_option_group
                  join ordering.option_groups as option_group
                    on option_group.id = product_option_group.option_group_id
                   and option_group.business_id = location.business_id
                  where product_option_group.product_id = product.id
                    and option_group.is_active
                    and exists (
                      select 1
                      from ordering.options as option
                      where option.option_group_id = option_group.id
                        and option.is_active
                        and option.is_available
                    )
                ), '[]'::jsonb)
              )
              order by product.sort_order, product.id
            )
            from visible_products as product
            where product.category_id = category.id
          ), '[]'::jsonb)
        )
        order by category.sort_order, category.id
      )
      from categories_with_products as category
    ), '[]'::jsonb)
  )
  from current_local_time as location;
$$;

comment on function ordering.get_storefront_menu(uuid) is
  'Returns a location-scoped customer menu, the business logo, and whether the outlet is accepting orders. Invalid or inactive locations return null.';

revoke all on function ordering.get_storefront_menu(uuid) from public;
grant execute on function ordering.get_storefront_menu(uuid) to anon, authenticated;
