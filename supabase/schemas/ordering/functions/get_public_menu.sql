create or replace function ordering.get_public_menu (
  p_business_slug text,
  p_location_id   uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_business_id uuid;
  v_business_name text;
  v_business_slug text;
  v_business_timezone text;
  v_business_currency text;
  v_location_name text;
  v_address_line_1 text;
  v_address_line_2 text;
  v_locality text;
  v_city text;
  v_state text;
  v_postal_code text;
  v_phone text;
  v_ordering_enabled boolean;
  v_ordering_mode text;
  v_minimum_order_value numeric(14, 2);
  v_accept_orders_when_closed boolean;
  v_tax_mode text;
  v_default_prep_minutes smallint;
  v_ordering_currency text;
  v_is_open_now boolean;
  v_can_accept_orders_now boolean;
begin
  if p_business_slug is null
     or btrim(p_business_slug) = ''
     or p_location_id is null then
    return null;
  end if;

  select
    business.id,
    business.name,
    business.slug,
    business.timezone,
    business.currency,
    location.name,
    location.address_line_1,
    location.address_line_2,
    location.locality,
    location.city,
    location.state,
    location.postal_code,
    location.phone,
    settings.ordering_enabled,
    settings.ordering_mode,
    settings.minimum_order_value,
    settings.accept_orders_when_closed,
    settings.tax_mode,
    settings.default_prep_minutes,
    settings.currency
  into
    v_business_id,
    v_business_name,
    v_business_slug,
    v_business_timezone,
    v_business_currency,
    v_location_name,
    v_address_line_1,
    v_address_line_2,
    v_locality,
    v_city,
    v_state,
    v_postal_code,
    v_phone,
    v_ordering_enabled,
    v_ordering_mode,
    v_minimum_order_value,
    v_accept_orders_when_closed,
    v_tax_mode,
    v_default_prep_minutes,
    v_ordering_currency
  from core.businesses as business
  join core.business_locations as location
    on location.business_id = business.id
  left join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where business.slug = lower(btrim(p_business_slug))
    and business.status = 'active'
    and location.id = p_location_id
    and location.is_active;

  if not found then
    return null;
  end if;

  v_is_open_now := private.is_location_open_at(p_location_id, v_now);
  v_can_accept_orders_now := coalesce(v_ordering_enabled, false)
    and (
      coalesce(v_accept_orders_when_closed, false)
      or v_is_open_now
    );

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name,
      'slug', v_business_slug,
      'timezone', v_business_timezone,
      'currency', v_business_currency
    ),
    'location', jsonb_build_object(
      'id', p_location_id,
      'name', v_location_name,
      'address_line_1', v_address_line_1,
      'address_line_2', v_address_line_2,
      'locality', v_locality,
      'city', v_city,
      'state', v_state,
      'postal_code', v_postal_code,
      'phone', v_phone
    ),
    'settings', jsonb_build_object(
      'ordering_enabled', coalesce(v_ordering_enabled, false),
      'ordering_mode', v_ordering_mode,
      'minimum_order_value', coalesce(v_minimum_order_value, 0),
      'currency', coalesce(v_ordering_currency, v_business_currency),
      'default_prep_minutes', v_default_prep_minutes,
      'prices_include_tax', coalesce(v_tax_mode = 'inclusive', false)
    ),
    'opening_hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', hours.day_of_week,
          'opens_at', case
            when hours.opens_at is null then null
            else to_char(hours.opens_at, 'HH24:MI')
          end,
          'closes_at', case
            when hours.closes_at is null then null
            else to_char(hours.closes_at, 'HH24:MI')
          end,
          'is_closed', hours.is_closed
        )
        order by
          hours.day_of_week,
          hours.is_closed desc,
          hours.opens_at nulls first,
          hours.id
      )
      from ordering.opening_hours as hours
      where hours.location_id = p_location_id
    ), '[]'::jsonb),
    'is_open_now', v_is_open_now,
    'can_accept_orders_now', v_can_accept_orders_now,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category_row.id,
          'name', category_row.name,
          'description', category_row.description,
          'sort_order', category_row.sort_order,
          'is_available_now',
            v_can_accept_orders_now and category_row.schedule_available,
          'availability_windows', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day_of_week', availability.day_of_week,
                'starts_at', to_char(availability.starts_at, 'HH24:MI'),
                'ends_at', to_char(availability.ends_at, 'HH24:MI')
              )
              order by availability.day_of_week
            )
            from ordering.catalog_availability_windows as availability
            where availability.location_id = p_location_id
              and availability.category_id = category_row.id
          ), '[]'::jsonb),
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', product_row.id,
                'name', product_row.name,
                'description', product_row.description,
                'price', product_row.effective_price,
                'image_url', product_row.image_url,
                'dietary_type', product_row.dietary_type,
                'is_sold_out', not product_row.stock_available,
                'is_available_now',
                  v_can_accept_orders_now
                  and category_row.schedule_available
                  and product_row.stock_available
                  and product_row.schedule_available
                  and product_row.required_options_satisfied,
                'sort_order', product_row.sort_order,
                'prep_time_minutes', coalesce(
                  product_row.prep_time_minutes,
                  v_default_prep_minutes
                ),
                'availability_windows', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'day_of_week', availability.day_of_week,
                      'starts_at', to_char(
                        availability.starts_at,
                        'HH24:MI'
                      ),
                      'ends_at', to_char(
                        availability.ends_at,
                        'HH24:MI'
                      )
                    )
                    order by availability.day_of_week
                  )
                  from ordering.catalog_availability_windows as availability
                  where availability.location_id = p_location_id
                    and availability.product_id = product_row.id
                ), '[]'::jsonb),
                'option_groups', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', option_group.id,
                      'name', option_group.name,
                      'selection_type', option_group.selection_type,
                      'min_selections', option_group.min_selections,
                      'max_selections', option_group.max_selections,
                      'sort_order', attachment.sort_order,
                      'options', coalesce((
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', option_item.id,
                            'name', option_item.name,
                            'price_delta', option_item.price_delta,
                            'is_available', option_item.is_available,
                            'sort_order', option_item.sort_order
                          )
                          order by
                            option_item.sort_order,
                            option_item.name,
                            option_item.id
                        )
                        from ordering.options as option_item
                        where option_item.option_group_id = option_group.id
                          and option_item.is_active
                      ), '[]'::jsonb)
                    )
                    order by
                      attachment.sort_order,
                      option_group.name,
                      option_group.id
                  )
                  from ordering.product_option_groups as attachment
                  join ordering.option_groups as option_group
                    on option_group.id = attachment.option_group_id
                  where attachment.product_id = product_row.id
                    and option_group.is_active
                ), '[]'::jsonb)
              )
              order by
                product_row.sort_order,
                product_row.name,
                product_row.id
            )
            from (
              select
                product.id,
                product.name,
                product.description,
                coalesce(
                  location_override.price_override,
                  product.base_price
                ) as effective_price,
                product.image_url,
                product.dietary_type,
                product.is_available
                  and coalesce(
                    location_override.is_available,
                    true
                  ) as stock_available,
                product.sort_order,
                product.prep_time_minutes,
                private.catalog_target_available_at(
                  p_location_id,
                  null,
                  product.id,
                  v_now
                ) as schedule_available,
                not exists (
                  select 1
                  from ordering.product_option_groups as required_attachment
                  join ordering.option_groups as required_group
                    on required_group.id = required_attachment.option_group_id
                  where required_attachment.product_id = product.id
                    and required_group.is_active
                    and required_group.min_selections > 0
                    and (
                      select count(*)
                      from ordering.options as available_option
                      where available_option.option_group_id = required_group.id
                        and available_option.is_active
                        and available_option.is_available
                    ) < required_group.min_selections
                ) as required_options_satisfied
              from ordering.products as product
              left join ordering.product_locations as location_override
                on location_override.product_id = product.id
               and location_override.location_id = p_location_id
              where product.business_id = v_business_id
                and product.category_id = category_row.id
                and product.is_active
            ) as product_row
          ), '[]'::jsonb)
        )
        order by
          category_row.sort_order,
          category_row.name,
          category_row.id
      )
      from (
        select
          category.id,
          category.name,
          category.description,
          category.sort_order,
          private.catalog_target_available_at(
            p_location_id,
            category.id,
            null,
            v_now
          ) as schedule_available
        from ordering.menu_categories as category
        where category.business_id = v_business_id
          and category.is_active
          and (
            category.location_id is null
            or category.location_id = p_location_id
          )
          and exists (
            select 1
            from ordering.products as active_product
            where active_product.business_id = v_business_id
              and active_product.category_id = category.id
              and active_product.is_active
          )
      ) as category_row
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."get_public_menu"(text, uuid) to "anon", "authenticated", "postgres", "service_role";

comment on function "ordering"."get_public_menu"(text, uuid) is 'Safe active menu projection; excludes internal rates, costs, and inactive rows.';

revoke all on function "ordering"."get_public_menu"(text, uuid) from public;
