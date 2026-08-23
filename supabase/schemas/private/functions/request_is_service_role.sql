create or replace function private.request_is_service_role()
  returns boolean
  language sql
  stable
  set search_path to ''
  AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.jwt() ->> 'role'),
    ''
  ) = 'service_role';
$function$;

grant execute on function "private"."request_is_service_role"() to "postgres";

revoke all on function "private"."request_is_service_role"() from public;
