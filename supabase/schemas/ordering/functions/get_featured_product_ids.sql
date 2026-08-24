create or replace function ordering.get_featured_product_ids (
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
    raise exception 'Authentication is required to read featured products.' using errcode = '42501';
  end if;

  if not (select private.is_active_location_member(p_location_id))
    or not exists (
      select 1
      from core.business_locations as location
      where location.id = p_location_id
        and location.business_id = p_business_id
        and location.is_active
    ) then
    raise exception 'You do not have permission to read featured products.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(featured.product_id order by featured.sort_order, featured.product_id)
    from ordering.location_featured_products as featured
    join ordering.product_locations as product_location
      on product_location.product_id = featured.product_id
     and product_location.location_id = featured.location_id
    join ordering.products as product
      on product.id = featured.product_id
     and product.business_id = p_business_id
     and product.is_active
    where featured.location_id = p_location_id
      and featured.is_active
  ), '[]'::jsonb);
end;
$function$;

grant execute on function "ordering"."get_featured_product_ids"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_featured_product_ids"(uuid, uuid) from public;
