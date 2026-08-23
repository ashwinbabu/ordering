create or replace function ordering.save_featured_product_ids (
  p_business_id uuid,
  p_location_id uuid,
  p_product_ids uuid[]
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save featured products.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to manage featured products.' using errcode = '42501';
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

  if exists (
    select 1
    from unnest(coalesce(p_product_ids, '{}'::uuid[])) as submitted(product_id)
    left join ordering.product_locations as product_location
      on product_location.product_id = submitted.product_id
     and product_location.location_id = p_location_id
    left join ordering.products as product
      on product.id = submitted.product_id
     and product.business_id = p_business_id
     and product.is_active
    where product_location.product_id is null
      or product.id is null
  ) then
    raise exception 'Every featured product must belong to the selected business and outlet.' using errcode = '22023';
  end if;

  delete from ordering.location_featured_products as featured
  where featured.location_id = p_location_id
    and not (featured.product_id = any(coalesce(p_product_ids, '{}'::uuid[])));

  insert into ordering.location_featured_products as featured (
    product_id,
    location_id,
    sort_order,
    is_active
  )
  select submitted.product_id, p_location_id, submitted.sort_order, true
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) with ordinality as submitted(product_id, sort_order)
  on conflict (product_id, location_id) do update
  set sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();
end;
$function$;

grant execute on function "ordering"."save_featured_product_ids"(uuid, uuid, uuid[]) to "authenticated", "postgres";

revoke all on function "ordering"."save_featured_product_ids"(uuid, uuid, uuid[]) from public;
