create or replace function private.can_manage_sensitive_business_configuration (
  p_business_id uuid
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
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

grant execute on function "private"."can_manage_sensitive_business_configuration"(uuid) to "postgres";
