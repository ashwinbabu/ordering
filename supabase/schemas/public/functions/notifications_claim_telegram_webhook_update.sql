create or replace function public.notifications_claim_telegram_webhook_update (
  p_update_id bigint
)
  returns boolean
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  insert into notifications.telegram_webhook_updates (update_id)
  values (p_update_id)
  on conflict (update_id) do nothing;

  return found;
end;
$function$;

grant execute on function "public"."notifications_claim_telegram_webhook_update"(bigint) to "postgres", "service_role";

revoke all on function "public"."notifications_claim_telegram_webhook_update"(bigint) from public;
