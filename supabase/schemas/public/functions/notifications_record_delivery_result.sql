create or replace function public.notifications_record_delivery_result (
  p_delivery_id         uuid,
  p_outcome             text,
  p_provider            text    default null::text,
  p_provider_message_id text    default null::text,
  p_error               text    default null::text,
  p_max_attempts        integer default 5,
  p_skip_reason         text    default null::text
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

  if p_outcome not in ('sent', 'retry', 'permanent_failure', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid delivery outcome';
  end if;

  select attempt_count into v_attempt_count
  from notifications.deliveries where id = p_delivery_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'delivery not found';
  end if;

  if p_outcome = 'sent' then
    update notifications.deliveries
    set status = 'sent',
        sent_at = now(),
        provider = p_provider,
        provider_message_id = p_provider_message_id,
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'skipped' then
    update notifications.deliveries
    set status = 'skipped',
        skip_reason = coalesce(p_skip_reason, 'channel_disabled'),
        provider = coalesce(p_provider, provider),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'permanent_failure' then
    update notifications.deliveries
    set status = 'dead',
        last_error = left(p_error, 2000),
        provider = coalesce(p_provider, provider),
        updated_at = now()
    where id = p_delivery_id;
  else
    if v_attempt_count >= p_max_attempts then
      update notifications.deliveries
      set status = 'dead',
          last_error = left(p_error, 2000),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    else
      update notifications.deliveries
      set status = 'failed',
          last_error = left(p_error, 2000),
          next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    end if;
  end if;
end;
$function$;

grant execute on function "public"."notifications_record_delivery_result"(uuid, text, text, text, text, integer, text) to "postgres", "service_role";

revoke all on function "public"."notifications_record_delivery_result"(uuid, text, text, text, text, integer, text) from public;
