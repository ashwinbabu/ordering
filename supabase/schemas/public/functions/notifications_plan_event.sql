create or replace function public.notifications_plan_event (
  p_event_id   uuid,
  p_deliveries jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_event notifications.events%rowtype;
  v_item jsonb;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select e.* into v_event from notifications.events e where e.id = p_event_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_event.status <> 'planning' then
    raise exception using errcode = '55000',
      message = format('event %s is not in planning status (found %s)', p_event_id, v_event.status);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
  loop
    insert into notifications.deliveries (
      event_id, business_id, location_id, channel, template_key,
      recipient_type, recipient_id, recipient_address, locale, payload,
      status, skip_reason
    ) values (
      p_event_id,
      v_event.business_id,
      v_event.location_id,
      v_item->>'channel',
      v_item->>'templateKey',
      v_item->>'recipientType',
      nullif(v_item->>'recipientId', '')::uuid,
      nullif(v_item->>'recipientAddress', ''),
      coalesce(v_item->>'locale', 'en-IN'),
      coalesce(v_item->'payload', '{}'::jsonb),
      coalesce(v_item->>'status', 'pending'),
      nullif(v_item->>'skipReason', '')
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  update notifications.events
  set status = 'planned', planned_at = now(), last_error = null, updated_at = now()
  where id = p_event_id;
end;
$function$;

grant execute on function "public"."notifications_plan_event"(uuid, jsonb) to "postgres", "service_role";

revoke all on function "public"."notifications_plan_event"(uuid, jsonb) from public;
