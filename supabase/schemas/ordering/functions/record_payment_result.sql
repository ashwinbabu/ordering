create or replace function ordering.record_payment_result (
  p_payment_id          uuid,
  p_result_status       text,
  p_provider_event_id   text,
  p_provider_payment_id text                     default null::text,
  p_method              text                     default null::text,
  p_gateway_payload     jsonb                    default '{}'::jsonb,
  p_gateway_fee         numeric                  default null::numeric,
  p_gateway_tax         numeric                  default null::numeric,
  p_occurred_at         timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_existing_order_id uuid;
  v_order_was_placed boolean := false;
  v_new_order_payment_status text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_result_status not in ('authorized', 'paid', 'failed', 'cancelled')
     or p_provider_event_id is null
     or btrim(p_provider_event_id) = ''
     or char_length(btrim(p_provider_event_id)) > 255
     or (p_gateway_fee is not null and p_gateway_fee < 0)
     or (p_gateway_tax is not null and p_gateway_tax < 0) then
    raise exception using errcode = '22023', message = 'invalid verified payment result';
  end if;

  select event.order_id
  into v_existing_order_id
  from ordering.order_events as event
  join ordering.payments as existing_payment
    on existing_payment.order_id = event.order_id
   and existing_payment.id = p_payment_id
  where event.event_type = 'payment_status_changed'
    and event.metadata ->> 'provider' = existing_payment.provider
    and event.metadata ->> 'provider_event_id' = btrim(p_provider_event_id)
  limit 1;

  if v_existing_order_id is not null then
    return ordering.get_order(v_existing_order_id);
  end if;

  -- Lock order is always payment -> order for webhook/refund consistency.
  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment was not found';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = v_payment.order_id
  for update;

  if v_payment.status = 'paid' then
    return ordering.get_order(v_order.id);
  end if;

  if p_result_status in ('authorized', 'paid')
     and (p_provider_payment_id is null or btrim(p_provider_payment_id) = '') then
    raise exception using
      errcode = '22023',
      message = 'provider payment id is required for authorization or capture';
  end if;

  if p_result_status = 'paid' then
    update ordering.payments
    set provider_payment_id = btrim(p_provider_payment_id),
        status = 'paid',
        method = coalesce(nullif(lower(btrim(p_method)), ''), method),
        gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb),
        gateway_fee = case
          when p_gateway_fee is null then null else round(p_gateway_fee, 2)
        end,
        gateway_tax = case
          when p_gateway_tax is null then null else round(p_gateway_tax, 2)
        end,
        paid_at = coalesce(p_occurred_at, now()),
        failed_at = null
    where id = p_payment_id;

    v_order_was_placed := v_order.status = 'payment_pending';

    update ordering.orders
    set payment_status = 'paid',
        status = case
          when status = 'payment_pending' then 'placed'
          else status
        end,
        placed_at = case
          when status = 'payment_pending' then coalesce(placed_at, p_occurred_at, now())
          else placed_at
        end
    where id = v_order.id;

    v_new_order_payment_status := 'paid';
  else
    update ordering.payments
    set provider_payment_id = coalesce(
          nullif(btrim(p_provider_payment_id), ''),
          provider_payment_id
        ),
        status = p_result_status,
        method = coalesce(nullif(lower(btrim(p_method)), ''), method),
        gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb),
        failed_at = case
          when p_result_status = 'failed' then coalesce(p_occurred_at, now())
          else null
        end
    where id = p_payment_id;

    if p_result_status = 'authorized' then
      v_new_order_payment_status := 'pending';
    elsif exists (
      select 1
      from ordering.payments as other_payment
      where other_payment.order_id = v_order.id
        and other_payment.id <> p_payment_id
        and other_payment.status in ('created', 'pending', 'authorized')
    ) then
      v_new_order_payment_status := 'pending';
    else
      v_new_order_payment_status := 'failed';
    end if;

    update ordering.orders
    set payment_status = v_new_order_payment_status
    where id = v_order.id;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    metadata,
    created_at
  ) values (
    v_order.id,
    v_order.business_id,
    'payment_status_changed',
    v_order.status,
    case when v_order_was_placed then 'placed' else v_order.status end,
    'system',
    jsonb_build_object(
      'schema_version', 1,
      'payment_id', p_payment_id,
      'provider', v_payment.provider,
      'provider_event_id', btrim(p_provider_event_id),
      'from_payment_status', v_order.payment_status,
      'to_payment_status', v_new_order_payment_status,
      'payment_result', p_result_status
    ),
    coalesce(p_occurred_at, now())
  );

  if v_order_was_placed then
    insert into ordering.order_events (
      order_id,
      business_id,
      event_type,
      from_status,
      to_status,
      actor_type,
      metadata,
      created_at
    ) values (
      v_order.id,
      v_order.business_id,
      'order_placed',
      'payment_pending',
      'placed',
      'system',
      jsonb_build_object('schema_version', 1, 'payment_id', p_payment_id),
      coalesce(p_occurred_at, now())
    );
  end if;

  return ordering.get_order(v_order.id);
end;
$function$;

grant execute on function "ordering"."record_payment_result"(uuid, text, text, text, text, jsonb, numeric, numeric, timestamp with time zone) to "postgres", "service_role";

revoke all on function "ordering"."record_payment_result"(uuid, text, text, text, text, jsonb, numeric, numeric, timestamp with time zone) from public;
