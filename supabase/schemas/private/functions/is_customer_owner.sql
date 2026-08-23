create or replace function private.is_customer_owner (
  p_customer_id uuid
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
      where customer.id = p_customer_id
        and customer.auth_user_id = (select auth.uid())
    );
$function$;

grant execute on function "private"."is_customer_owner"(uuid) to "authenticated", "postgres";

revoke all on function "private"."is_customer_owner"(uuid) from public;
