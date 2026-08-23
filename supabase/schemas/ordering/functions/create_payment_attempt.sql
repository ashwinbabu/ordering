create or replace function ordering.create_payment_attempt (
  p_payment_id uuid,
  p_order_id   uuid,
  p_provider   text,
  p_amount     numeric,
  p_currency   text,
  p_method     text    default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_payment ordering.payments%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_payment_id is null
     or p_order_id is null
     or p_provider is null
     or btrim(p_provider) = ''
     or p_amount is null
     or p_amount <= 0
     or p_currency is null then
    raise exception using errcode = '22023', message = 'invalid payment attempt';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.status <> 'payment_pending'
     or v_order.payment_status in ('paid', 'partially_refunded', 'refunded') then
    raise exception using errcode = '55000', message = 'order cannot start a payment';
  end if;

  if round(p_amount, 2) <> v_order.grand_total
     or upper(btrim(p_currency)) <> v_order.currency then
    raise exception using
      errcode = '22023',
      message = 'payment amount and currency must match the order snapshot';
  end if;

  insert into ordering.payments (
    id,
    order_id,
    business_id,
    provider,
    status,
    amount,
    currency,
    method
  ) values (
    p_payment_id,
    p_order_id,
    v_order.business_id,
    lower(btrim(p_provider)),
    'created',
    round(p_amount, 2),
    upper(btrim(p_currency)),
    nullif(lower(btrim(p_method)), '')
  )
  on conflict (id) do nothing;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id;

  if v_payment.order_id <> p_order_id
     or v_payment.provider <> lower(btrim(p_provider))
     or v_payment.amount <> round(p_amount, 2)
     or v_payment.currency <> upper(btrim(p_currency)) then
    raise exception using
      errcode = '23505',
      message = 'payment idempotency identifier was reused with different facts';
  end if;

  update ordering.orders
  set payment_status = 'pending'
  where id = p_order_id
    and payment_status <> 'pending';

  if found then
    insert into ordering.order_events (
      order_id,
      business_id,
      event_type,
      actor_type,
      metadata
    ) values (
      p_order_id,
      v_order.business_id,
      'payment_status_changed',
      'system',
      jsonb_build_object(
        'schema_version', 1,
        'payment_id', p_payment_id,
        'from_payment_status', v_order.payment_status,
        'to_payment_status', 'pending'
      )
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'provider', v_payment.provider,
    'status', v_payment.status,
    'amount', v_payment.amount,
    'currency', v_payment.currency,
    'provider_order_id', v_payment.provider_order_id
  );
end;
$function$;

grant execute on function "ordering"."create_payment_attempt"(uuid, uuid, text, numeric, text, text) to "postgres", "service_role";

revoke all on function "ordering"."create_payment_attempt"(uuid, uuid, text, numeric, text, text) from public;
