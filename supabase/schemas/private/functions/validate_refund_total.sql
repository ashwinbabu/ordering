create or replace function private.validate_refund_total()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_payment_amount numeric(14, 2);
  v_existing_amount numeric(14, 2);
begin
  select payment.amount
  into v_payment_amount
  from ordering.payments as payment
  where payment.id = new.payment_id
    and payment.order_id = new.order_id
    and payment.status = 'paid'
  for update;

  if v_payment_amount is null then
    raise exception using
      errcode = '23514',
      message = 'refund requires a captured payment for the same order';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(sum(refund.amount), 0)
    into v_existing_amount
    from ordering.refunds as refund
    where refund.payment_id = new.payment_id
      and refund.status <> 'cancelled';
  else
    select coalesce(sum(refund.amount), 0)
    into v_existing_amount
    from ordering.refunds as refund
    where refund.payment_id = new.payment_id
      and refund.status <> 'cancelled'
      and refund.id <> old.id;
  end if;

  if new.status <> 'cancelled'
     and v_existing_amount + new.amount > v_payment_amount then
    raise exception using
      errcode = '23514',
      message = 'cumulative refunds cannot exceed the captured payment';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.payment_id is distinct from old.payment_id
    or new.amount is distinct from old.amount
    or new.method is distinct from old.method
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'refund identity, amount, method, and reason are immutable';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_refund_total"() to "postgres";

revoke all on function "private"."validate_refund_total"() from public;
