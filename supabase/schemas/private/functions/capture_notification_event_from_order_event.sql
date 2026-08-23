create or replace function private.capture_notification_event_from_order_event()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_notification_event_type text;
  v_dedupe_key text;
  v_order ordering.orders%rowtype;
begin
  if new.event_type = 'order_placed'
     or (new.event_type = 'order_created' and new.to_status = 'placed') then
    v_notification_event_type := 'order.placed';
    v_dedupe_key := 'order:' || new.order_id::text || ':placed';
  elsif new.event_type = 'order_cancelled' then
    v_notification_event_type := 'order.cancelled';
    v_dedupe_key := 'order:' || new.order_id::text || ':cancelled';
  else
    return new;
  end if;

  select o.* into v_order from ordering.orders o where o.id = new.order_id;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'order not found while capturing notification event';
  end if;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id,
    source_event_id, dedupe_key, occurred_at, payload
  ) values (
    v_notification_event_type, 'order', new.order_id, new.business_id, v_order.location_id,
    new.id, v_dedupe_key, new.created_at,
    jsonb_build_object(
      'schemaVersion', 1,
      'orderId', new.order_id,
      'customerId', v_order.customer_id,
      'actorType', new.actor_type,
      'fromStatus', new.from_status,
      'toStatus', new.to_status
    )
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;

grant execute on function "private"."capture_notification_event_from_order_event"() to "postgres";
