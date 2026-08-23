create or replace function public.notifications_mark_event_failed (
  p_event_id     uuid,
  p_error        text,
  p_max_attempts integer default 8
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_attempt_count int;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select attempt_count into v_attempt_count
  from notifications.events where id = p_event_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_attempt_count >= p_max_attempts then
    update notifications.events
    set status = 'dead', last_error = left(p_error, 2000), updated_at = now()
    where id = p_event_id;
  else
    update notifications.events
    set status = 'failed',
        last_error = left(p_error, 2000),
        next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
        updated_at = now()
    where id = p_event_id;
  end if;
end;
$function$;

grant execute on function "public"."notifications_mark_event_failed"(uuid, text, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_mark_event_failed"(uuid, text, integer) from public;
