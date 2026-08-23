create or replace function ordering.create_manual_refund (
  p_refund_id  uuid,
  p_order_id   uuid,
  p_payment_id uuid,
  p_amount     numeric,
  p_reason     text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_operator_id uuid;
  v_existing ordering.refunds%rowtype;
begin
  if p_refund_id is null
     or p_amount is null
     or p_amount <= 0
     or p_reason is null
     or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'invalid manual refund';
  end if;

  select refund.*
  into v_existing
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.payment_id <> p_payment_id
       or v_existing.amount <> round(p_amount, 2)
       or v_existing.reason <> btrim(p_reason) then
      raise exception using
        errcode = '23505',
        message = 'refund idempotency identifier was reused with different facts';
    end if;
    return ordering.get_order_finance(p_order_id);
  end if;

  -- Consistent lock order: payment, order, then refund rows by UUID.
  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
    and payment.order_id = p_order_id
  for update;

  if not found or v_payment.status <> 'paid' then
    raise exception using errcode = '22023', message = 'captured payment is required';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
    and placed_order.business_id = v_payment.business_id
  for update;

  if not found then
    raise exception using errcode = '23514', message = 'payment/order mismatch';
  end if;

  select operator_user.id
  into v_operator_id
  from core.business_users as membership
  join core.users as operator_user
    on operator_user.id = membership.user_id
  where membership.business_id = v_order.business_id
    and membership.is_active
    and membership.role in ('owner', 'admin')
    and operator_user.auth_user_id = (select auth.uid());

  if v_operator_id is null then
    raise exception using errcode = '42501', message = 'owner or admin is required';
  end if;

  perform refund.id
  from ordering.refunds as refund
  where refund.payment_id = p_payment_id
  order by refund.id
  for update;

  insert into ordering.refunds (
    id,
    order_id,
    payment_id,
    amount,
    method,
    status,
    reason
  ) values (
    p_refund_id,
    p_order_id,
    p_payment_id,
    round(p_amount, 2),
    'manual',
    'pending',
    btrim(p_reason)
  );

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_order.business_id,
    'refund_recorded',
    'admin',
    v_operator_id,
    jsonb_build_object(
      'schema_version', 1,
      'refund_id', p_refund_id,
      'payment_id', p_payment_id,
      'refund_status', 'pending',
      'amount', round(p_amount, 2)
    )
  );

  return ordering.get_order_finance(p_order_id);
end;
$function$;

grant execute on function "ordering"."create_manual_refund"(uuid, uuid, uuid, numeric, text) to "authenticated", "postgres";

revoke all on function "ordering"."create_manual_refund"(uuid, uuid, uuid, numeric, text) from public;
