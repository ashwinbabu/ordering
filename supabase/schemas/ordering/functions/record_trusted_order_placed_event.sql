create or replace function ordering.record_trusted_order_placed_event (
  p_order_id   uuid,
  p_session_id uuid,
  p_metadata   jsonb default '{}'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_event_id uuid;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'trusted order analytics requires the trusted backend';
  end if;

  if p_session_id is null then
    raise exception using errcode = '22023', message = 'order analytics requires the checkout session identifier';
  end if;

  select order_row.*
  into v_order
  from ordering.orders as order_row
  where order_row.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_status not in ('paid', 'not_required')
     or v_order.status = 'payment_pending' then
    raise exception using
      errcode = '22023',
      message = 'trusted order analytics requires a paid or no-payment placed order';
  end if;

  select event.id
  into v_event_id
  from ordering.analytics_events as event
  where event.order_id = p_order_id
    and event.event_name = 'order_placed'
  limit 1;

  if v_event_id is not null then
    return jsonb_build_object('id', v_event_id, 'inserted', false);
  end if;

  insert into ordering.analytics_events (
    business_id,
    location_id,
    session_id,
    customer_id,
    order_id,
    acquisition_source_id,
    event_name,
    metadata,
    occurred_at
  ) values (
    v_order.business_id,
    v_order.location_id,
    p_session_id,
    v_order.customer_id,
    v_order.id,
    v_order.acquisition_source_id,
    'order_placed',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('schema_version', 1),
    now()
  )
  returning id into v_event_id;

  return jsonb_build_object('id', v_event_id, 'inserted', true);
end;
$function$;

grant execute on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) to "postgres", "service_role";

comment on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) is 'Service-only, idempotent order_placed event. Invoke after verified payment/order placement with the checkout session UUID.';

revoke all on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) from public;
