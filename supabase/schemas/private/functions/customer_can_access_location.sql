create or replace function private.customer_can_access_location (
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.customers as customer
      join core.customer_businesses as link
        on link.customer_id = customer.id
      join core.business_locations as location
        on location.business_id = link.business_id
      where customer.auth_user_id = (select auth.uid())
        and location.id = p_location_id
    );
$function$;

grant execute on function "private"."customer_can_access_location"(uuid) to "postgres";
