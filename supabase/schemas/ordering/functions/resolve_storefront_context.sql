create or replace function ordering.resolve_storefront_context (
  p_hostname text
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select jsonb_build_object(
    'businessId', business.id,
    'locationId', location.id,
    'businessName', business.name,
    'locationName', location.name
  )
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  where lower(location.storefront_domain) = rtrim(lower(btrim(p_hostname)), '.')
    and location.is_active
    and business.status = 'active'
  limit 1;
$function$;

grant execute on function "ordering"."resolve_storefront_context"(text) to "anon", "authenticated", "postgres";

revoke all on function "ordering"."resolve_storefront_context"(text) from public;
