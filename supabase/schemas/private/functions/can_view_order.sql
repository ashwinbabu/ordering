create or replace function private.can_view_order (
  p_business_id uuid,
  p_customer_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select private.request_is_service_role())
    or (select private.can_operate_orders(p_business_id))
    or exists (
      select 1
      from core.customers as customer
      where customer.id = p_customer_id
        and customer.auth_user_id = (select auth.uid())
    );
$function$;

grant execute on function "private"."can_view_order"(uuid, uuid) to "postgres";

revoke all on function "private"."can_view_order"(uuid, uuid) from public;
