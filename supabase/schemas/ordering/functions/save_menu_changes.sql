create or replace function ordering.save_menu_changes (
  p_business_id uuid,
  p_location_id uuid,
  p_baseline    jsonb,
  p_menu        jsonb
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
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
    or jsonb_typeof(p_menu -> 'categories') <> 'array'
    or jsonb_typeof(p_menu -> 'products') <> 'array'
    or jsonb_typeof(p_menu -> 'option_groups') <> 'array'
    or jsonb_typeof(p_menu -> 'product_option_groups') <> 'array'
    or jsonb_typeof(p_menu -> 'category_availability_windows') <> 'array'
    or jsonb_typeof(p_menu -> 'product_availability_windows') <> 'array'
    or jsonb_typeof(p_menu -> 'removed_product_ids') <> 'array' then
    raise exception 'The menu save payload is incomplete.' using errcode = '22023';
  end if;

  if p_baseline is null
    or jsonb_typeof(p_baseline) <> 'object'
    or jsonb_typeof(p_baseline -> 'categories') <> 'array'
    or jsonb_typeof(p_baseline -> 'products') <> 'array' then
    raise exception 'The menu baseline is incomplete.' using errcode = '22023';
  end if;

  if octet_length(p_menu::text) > 1048576 then
    raise exception 'The menu save payload is too large.' using errcode = '54000';
  end if;

  -- Lock the current scope before comparing the client snapshot. Every save
  -- updates these revisions, including option and schedule changes.
  perform 1
  from ordering.menu_categories as category
  where category.business_id = p_business_id
    and category.location_id = p_location_id
  for update;

  perform 1
  from ordering.products as product
  join ordering.menu_categories as category
    on category.id = product.category_id
   and category.business_id = product.business_id
  where product.business_id = p_business_id
    and category.location_id = p_location_id
  for update;

  if exists (
    with baseline as (
      select item.id, item.updated_at
      from jsonb_to_recordset(p_baseline -> 'categories') as item(id uuid, updated_at timestamptz)
    ), current as (
      select category.id, category.updated_at
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    )
    select 1
    from baseline
    full join current using (id)
    where baseline.id is null
      or current.id is null
      or baseline.updated_at is distinct from current.updated_at
  ) then
    raise exception 'The menu changed in another session. Reload and review the latest version.' using errcode = '40001';
  end if;

  if exists (
    with baseline as (
      select item.id, item.updated_at
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), current as (
      select product.id, product.updated_at
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      where product.business_id = p_business_id
        and category.location_id = p_location_id
        and product.is_active
    )
    select 1
    from baseline
    full join current using (id)
    where baseline.id is null
      or current.id is null
      or baseline.updated_at is distinct from current.updated_at
  ) then
    raise exception 'The menu changed in another session. Reload and review the latest version.' using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each category must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each product must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with baseline_products as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), removed_products as (
      select value::uuid as id
      from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
    )
    select 1
    from baseline_products as baseline
    left join incoming_products as incoming on incoming.id = baseline.id
    left join removed_products as removed on removed.id = baseline.id
    where (incoming.id is null and removed.id is null)
       or (incoming.id is not null and removed.id is not null)
  ) then
    raise exception 'Removed products must match the submitted menu snapshot.' using errcode = '22023';
  end if;

  if exists (
    with baseline_products as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), removed_products as (
      select value::uuid as id
      from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
    )
    select 1
    from removed_products as removed
    left join baseline_products as baseline on baseline.id = removed.id
    where baseline.id is null
  ) then
    raise exception 'A removed product was not part of the loaded menu.' using errcode = '22023';
  end if;

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    )
    select 1
    from incoming_categories as incoming
    join ordering.menu_categories as category on category.id = incoming.id
    where category.business_id <> p_business_id
       or category.location_id is distinct from p_location_id
  ) then
    raise exception 'A category belongs to a different menu.' using errcode = '22023';
  end if;

  if exists (
    with baseline_categories as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'categories') as item(id uuid, updated_at timestamptz)
    ), incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    )
    select 1
    from baseline_categories as baseline
    left join incoming_categories as incoming on incoming.id = baseline.id
    where incoming.id is null
  ) then
    raise exception 'Deleting saved categories is not supported by this menu operation.' using errcode = '22023';
  end if;

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    ), incoming_products as (
      select item.id, item.category_id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    )
    select 1
    from incoming_products as product
    left join incoming_categories as category on category.id = product.category_id
    where category.id is null
  ) then
    raise exception 'Every product must belong to a category in this menu.' using errcode = '22023';
  end if;

  if exists (
    with incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    )
    select 1
    from incoming_products as incoming
    join ordering.products as product on product.id = incoming.id
    where product.business_id <> p_business_id
  ) then
    raise exception 'A product belongs to a different business.' using errcode = '22023';
  end if;

  with incoming_categories as (
    select
      item.id,
      btrim(item.name) as name,
      nullif(btrim(item.description), '') as description,
      item.sort_order,
      item.is_active
    from jsonb_to_recordset(p_menu -> 'categories') as item(
      id uuid,
      name text,
      description text,
      sort_order integer,
      is_active boolean
    )
  )
  insert into ordering.menu_categories as category (
    id,
    business_id,
    location_id,
    name,
    description,
    sort_order,
    is_active
  )
  select
    incoming.id,
    p_business_id,
    p_location_id,
    incoming.name,
    incoming.description,
    incoming.sort_order,
    incoming.is_active
  from incoming_categories as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now()
  where category.business_id = p_business_id
    and category.location_id = p_location_id;

  with incoming_products as (
    select
      item.id,
      item.category_id,
      btrim(item.name) as name,
      nullif(btrim(item.description), '') as description,
      item.base_price,
      nullif(btrim(item.image_url), '') as image_url,
      nullif(btrim(item.dietary_type), '') as dietary_type,
      item.is_available,
      item.sort_order,
      item.prep_time_minutes
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  insert into ordering.products as product (
    id,
    business_id,
    category_id,
    name,
    description,
    base_price,
    image_url,
    dietary_type,
    is_active,
    is_available,
    sort_order,
    prep_time_minutes
  )
  select
    incoming.id,
    p_business_id,
    incoming.category_id,
    incoming.name,
    incoming.description,
    incoming.base_price,
    incoming.image_url,
    incoming.dietary_type,
    true,
    incoming.is_available,
    incoming.sort_order,
    incoming.prep_time_minutes
  from incoming_products as incoming
  on conflict (id) do update
  set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    base_price = excluded.base_price,
    image_url = excluded.image_url,
    dietary_type = excluded.dietary_type,
    is_active = excluded.is_active,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order,
    prep_time_minutes = excluded.prep_time_minutes,
    updated_at = now()
  where product.business_id = p_business_id;

  with removed_products as (
    select value::uuid as id
    from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
  )
  update ordering.products as product
  set
    is_active = false,
    is_available = false,
    updated_at = now()
  from removed_products as removed,
    ordering.menu_categories as category
  where product.id = removed.id
    and product.business_id = p_business_id
    and category.id = product.category_id
    and category.business_id = product.business_id
    and category.location_id = p_location_id;

  with incoming_products as (
    select item.id, item.location_is_available
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      location_is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  insert into ordering.product_locations as product_location (
    product_id,
    location_id,
    is_available,
    price_override
  )
  select incoming.id, p_location_id, incoming.location_is_available, null
  from incoming_products as incoming
  on conflict (product_id, location_id) do update
  set is_available = excluded.is_available;

  with removed_products as (
    select value::uuid as id
    from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
  )
  update ordering.product_locations as product_location
  set is_available = false
  from removed_products as removed
  where product_location.product_id = removed.id
    and product_location.location_id = p_location_id;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each option group must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), incoming_groups as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_links as (
      select item.product_id, item.option_group_id
      from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
        product_id uuid,
        option_group_id uuid,
        sort_order integer
      )
    )
    select 1
    from incoming_links as link
    left join incoming_products as product on product.id = link.product_id
    left join incoming_groups as option_group on option_group.id = link.option_group_id
    where product.id is null or option_group.id is null
  ) then
    raise exception 'Every option-group link must belong to submitted menu items.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
    group by item.product_id, item.option_group_id
    having count(*) > 1
  ) then
    raise exception 'Each product-option group link must be unique.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    )
    select 1
    from incoming_groups as incoming
    join ordering.option_groups as option_group on option_group.id = incoming.id
    where option_group.business_id <> p_business_id
  ) then
    raise exception 'An option group belongs to a different business.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id as option_group_id, item.options
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_options as (
      select option_group.option_group_id, option.id
      from incoming_groups as option_group
      cross join lateral jsonb_to_recordset(option_group.options) as option(
        id uuid,
        name text,
        price_delta numeric,
        is_available boolean,
        sort_order integer
      )
    )
    select 1
    from incoming_options
    group by id
    having count(*) > 1
  ) then
    raise exception 'Each option must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id as option_group_id, item.options
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_options as (
      select option_group.option_group_id, option.id
      from incoming_groups as option_group
      cross join lateral jsonb_to_recordset(option_group.options) as option(
        id uuid,
        name text,
        price_delta numeric,
        is_available boolean,
        sort_order integer
      )
    )
    select 1
    from incoming_options as incoming
    join ordering.options as option on option.id = incoming.id
    where option.option_group_id <> incoming.option_group_id
  ) then
    raise exception 'An option belongs to a different option group.' using errcode = '22023';
  end if;

  with incoming_groups as (
    select
      item.id,
      item.product_id,
      btrim(item.name) as name,
      item.selection_type,
      item.min_selections,
      item.max_selections,
      item.sort_order,
      item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  )
  insert into ordering.option_groups as option_group (
    id,
    business_id,
    name,
    selection_type,
    min_selections,
    max_selections,
    sort_order,
    is_active
  )
  select
    incoming.id,
    p_business_id,
    incoming.name,
    incoming.selection_type,
    incoming.min_selections,
    incoming.max_selections,
    incoming.sort_order,
    true
  from incoming_groups as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    selection_type = excluded.selection_type,
    min_selections = excluded.min_selections,
    max_selections = excluded.max_selections,
    sort_order = excluded.sort_order,
    is_active = true
  where option_group.business_id = p_business_id;

  with incoming_links as (
    select item.product_id, item.option_group_id, item.sort_order
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
  )
  insert into ordering.product_option_groups as product_option_group (
    product_id,
    option_group_id,
    sort_order
  )
  select incoming.product_id, incoming.option_group_id, incoming.sort_order
  from incoming_links as incoming
  on conflict (product_id, option_group_id) do update
  set sort_order = excluded.sort_order;

  with incoming_products as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  ), incoming_links as (
    select item.product_id, item.option_group_id
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
  )
  delete from ordering.product_option_groups as product_option_group
  where product_option_group.product_id in (select id from incoming_products)
    and not exists (
      select 1
      from incoming_links as incoming
      where incoming.option_group_id = product_option_group.option_group_id
        and incoming.product_id = product_option_group.product_id
    );

  with incoming_groups as (
    select item.id, item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  ), incoming_options as (
    select
      option_group.id as option_group_id,
      option.id,
      btrim(option.name) as name,
      option.price_delta,
      option.is_available,
      option.sort_order
    from incoming_groups as option_group
    cross join lateral jsonb_to_recordset(option_group.options) as option(
      id uuid,
      name text,
      price_delta numeric,
      is_available boolean,
      sort_order integer
    )
  )
  insert into ordering.options as option (
    id,
    option_group_id,
    name,
    price_delta,
    is_active,
    is_available,
    sort_order
  )
  select
    incoming.id,
    incoming.option_group_id,
    incoming.name,
    incoming.price_delta,
    true,
    incoming.is_available,
    incoming.sort_order
  from incoming_options as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    price_delta = excluded.price_delta,
    is_active = true,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order
  where option.option_group_id = excluded.option_group_id;

  with incoming_groups as (
    select item.id, item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  ), incoming_options as (
    select option_group.id as option_group_id, option.id
    from incoming_groups as option_group
    cross join lateral jsonb_to_recordset(option_group.options) as option(
      id uuid,
      name text,
      price_delta numeric,
      is_available boolean,
      sort_order integer
    )
  )
  update ordering.options as option
  set
    is_active = false,
    is_available = false
  where option.option_group_id in (select id from incoming_groups)
    and not exists (
      select 1
      from incoming_options as incoming
      where incoming.id = option.id
        and incoming.option_group_id = option.option_group_id
    );

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    ), incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), incoming_windows as (
      select item.category_id as target_id, 'category'::text as target_type, item.day_of_week, item.starts_at, item.ends_at
      from jsonb_to_recordset(p_menu -> 'category_availability_windows') as item(
        category_id uuid,
        day_of_week smallint,
        starts_at time,
        ends_at time
      )
      union all
      select item.product_id, 'product'::text, item.day_of_week, item.starts_at, item.ends_at
      from jsonb_to_recordset(p_menu -> 'product_availability_windows') as item(
        product_id uuid,
        day_of_week smallint,
        starts_at time,
        ends_at time
      )
    )
    select 1
    from incoming_windows as availability_window
    where availability_window.target_id is null
       or availability_window.day_of_week not between 1 and 7
       or availability_window.starts_at >= availability_window.ends_at
       or (availability_window.target_type = 'category' and not exists (select 1 from incoming_categories as category where category.id = availability_window.target_id))
       or (availability_window.target_type = 'product' and not exists (select 1 from incoming_products as product where product.id = availability_window.target_id))
  ) then
    raise exception 'Availability windows must belong to submitted menu items and use a valid time range.' using errcode = '22023';
  end if;

  with incoming_categories as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
  ), incoming_products as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  delete from ordering.catalog_availability_windows as availability_window
  where availability_window.location_id = p_location_id
    and (
      availability_window.category_id in (select id from incoming_categories)
      or availability_window.product_id in (select id from incoming_products)
    );

  insert into ordering.catalog_availability_windows as availability_window (
    location_id,
    category_id,
    product_id,
    day_of_week,
    starts_at,
    ends_at
  )
  select
    p_location_id,
    item.category_id,
    null,
    item.day_of_week,
    item.starts_at,
    item.ends_at
  from jsonb_to_recordset(p_menu -> 'category_availability_windows') as item(
    category_id uuid,
    day_of_week smallint,
    starts_at time,
    ends_at time
  )
  union all
  select
    p_location_id,
    null,
    item.product_id,
    item.day_of_week,
    item.starts_at,
    item.ends_at
  from jsonb_to_recordset(p_menu -> 'product_availability_windows') as item(
    product_id uuid,
    day_of_week smallint,
    starts_at time,
    ends_at time
  );

  -- Option and schedule tables have no revision fields. Touching the parent
  -- records makes their changes part of the next optimistic-concurrency check.
  update ordering.menu_categories as category
  set updated_at = now()
  where category.id in (
    select item.id
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
  );

  update ordering.products as product
  set updated_at = now()
  where product.id in (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  );
end;
$function$;

grant execute on function "ordering"."save_menu_changes"(uuid, uuid, jsonb, jsonb) to "authenticated", "postgres";

revoke all on function "ordering"."save_menu_changes"(uuid, uuid, jsonb, jsonb) from public;
