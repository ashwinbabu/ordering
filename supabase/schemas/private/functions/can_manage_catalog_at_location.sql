create or replace function private.can_manage_catalog_at_location (
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
      from core.business_locations as location
      join core.business_users as membership
        on membership.business_id = location.business_id
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where location.id = p_location_id
        and membership.is_active
        and membership.role in ('owner', 'admin', 'manager')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

grant execute on function "private"."can_manage_catalog_at_location"(uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_catalog_at_location"(uuid) from public;
