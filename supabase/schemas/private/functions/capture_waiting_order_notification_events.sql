create or replace function private.capture_waiting_order_notification_events()
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'order.waiting_3m', 'order', o.id, o.business_id, o.location_id,
    'order:' || o.id::text || ':waiting_3m', now(),
    jsonb_build_object('schemaVersion', 1, 'orderId', o.id, 'customerId', o.customer_id, 'actorType', 'system', 'fromStatus', null, 'toStatus', 'placed')
  from ordering.orders o
  where o.status = 'placed' and o.placed_at <= now() - interval '3 minutes'
  on conflict (dedupe_key) do nothing;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'order.waiting_8m', 'order', o.id, o.business_id, o.location_id,
    'order:' || o.id::text || ':waiting_8m', now(),
    jsonb_build_object('schemaVersion', 1, 'orderId', o.id, 'customerId', o.customer_id, 'actorType', 'system', 'fromStatus', null, 'toStatus', 'placed')
  from ordering.orders o
  where o.status = 'placed' and o.placed_at <= now() - interval '8 minutes'
  on conflict (dedupe_key) do nothing;
end;
$function$;

grant execute on function "private"."capture_waiting_order_notification_events"() to "postgres";

revoke all on function "private"."capture_waiting_order_notification_events"() from public;
