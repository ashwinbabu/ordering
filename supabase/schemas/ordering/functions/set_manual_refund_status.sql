create or replace function ordering.set_manual_refund_status (
  p_refund_id          uuid,
  p_new_status         text,
  p_external_reference text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_refund ordering.refunds%rowtype;
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_operator_id uuid;
  v_completed_total numeric(14, 2);
  v_old_status text;
begin
  if p_new_status not in ('processing', 'completed', 'failed', 'cancelled') then
    raise exception using errcode = '22023', message = 'invalid refund status';
  end if;

  select refund.*
  into v_refund
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'refund was not found';
  end if;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = v_refund.payment_id
  for update;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = v_refund.order_id
  for update;

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
  where refund.payment_id = v_refund.payment_id
  order by refund.id
  for update;

  select refund.*
  into v_refund
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if v_refund.status = p_new_status then
    return ordering.get_order_finance(v_refund.order_id);
  end if;

  if v_refund.status in ('completed', 'cancelled')
     or (
       v_refund.status = 'pending'
       and p_new_status not in ('processing', 'completed', 'failed', 'cancelled')
     )
     or (
       v_refund.status = 'processing'
       and p_new_status not in ('completed', 'failed', 'cancelled')
     )
     or (
       v_refund.status = 'failed'
       and p_new_status not in ('processing', 'completed', 'cancelled')
     ) then
    raise exception using errcode = '22023', message = 'invalid refund transition';
  end if;

  if p_new_status = 'completed'
     and (p_external_reference is null or btrim(p_external_reference) = '') then
    raise exception using
      errcode = '22023',
      message = 'external refund reference is required for completion';
  end if;

  v_old_status := v_refund.status;

  update ordering.refunds
  set status = p_new_status,
      processed_by = case
        when p_new_status = 'completed' then v_operator_id
        else processed_by
      end,
      external_reference = case
        when p_external_reference is null then external_reference
        else btrim(p_external_reference)
      end,
      processed_at = case
        when p_new_status = 'completed' then now()
        else null
      end
  where id = p_refund_id;

  select coalesce(sum(refund.amount), 0)
  into v_completed_total
  from ordering.refunds as refund
  where refund.payment_id = v_refund.payment_id
    and refund.status = 'completed';

  update ordering.orders
  set payment_status = case
    when v_completed_total >= v_payment.amount then 'refunded'
    when v_completed_total > 0 then 'partially_refunded'
    else 'paid'
  end
  where id = v_order.id;

  if p_new_status = 'completed'
     and v_old_status <> 'completed'
     and v_order.status = 'delivered' then
    update core.customer_businesses
    set lifetime_order_value = greatest(
      lifetime_order_value - v_refund.amount,
      0
    )
    where id = v_order.customer_business_id
      and business_id = v_order.business_id
      and customer_id = v_order.customer_id;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  ) values (
    v_order.id,
    v_order.business_id,
    'refund_recorded',
    'admin',
    v_operator_id,
    jsonb_build_object(
      'schema_version', 1,
      'refund_id', p_refund_id,
      'payment_id', v_refund.payment_id,
      'from_refund_status', v_old_status,
      'to_refund_status', p_new_status,
      'amount', v_refund.amount
    )
  );

  return ordering.get_order_finance(v_order.id);
end;
$function$;

grant execute on function "ordering"."set_manual_refund_status"(uuid, text, text) to "authenticated", "postgres";

revoke all on function "ordering"."set_manual_refund_status"(uuid, text, text) from public;
