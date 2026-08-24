create or replace function public.notifications_set_business_preferences (
  p_business_id                  uuid,
  p_notify_owner_on_cancellation boolean
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to manage this business';
  end if;

  insert into notifications.business_preferences (business_id, notify_owner_on_cancellation)
  values (p_business_id, p_notify_owner_on_cancellation)
  on conflict (business_id) do update
  set notify_owner_on_cancellation = excluded.notify_owner_on_cancellation;

  return jsonb_build_object('notifyOwnerOnCancellation', p_notify_owner_on_cancellation);
end;
$function$;

grant execute on function "public"."notifications_set_business_preferences"(uuid, boolean) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_set_business_preferences"(uuid, boolean) from public;
