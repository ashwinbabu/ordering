create or replace function public.notifications_get_business_preferences (
  p_business_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_notify boolean;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to view this business';
  end if;

  select bp.notify_owner_on_cancellation into v_notify
  from notifications.business_preferences bp where bp.business_id = p_business_id;

  return jsonb_build_object('notifyOwnerOnCancellation', coalesce(v_notify, false));
end;
$function$;

grant execute on function "public"."notifications_get_business_preferences"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_get_business_preferences"(uuid) from public;
