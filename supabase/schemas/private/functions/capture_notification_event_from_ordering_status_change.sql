create or replace function private.capture_notification_event_from_ordering_status_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_business_id uuid;
  v_event_type text;
begin
  if new.ordering_enabled is not distinct from old.ordering_enabled then
    return new;
  end if;

  select l.business_id into v_business_id from core.business_locations l where l.id = new.location_id;
  v_event_type := case when new.ordering_enabled then 'store.resumed' else 'store.paused' end;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  ) values (
    v_event_type, 'location', new.location_id, v_business_id, new.location_id,
    'location:' || new.location_id::text || ':' || v_event_type || ':' || extract(epoch from now())::text,
    now(), '{}'::jsonb
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;

grant execute on function "private"."capture_notification_event_from_ordering_status_change"() to "postgres";
