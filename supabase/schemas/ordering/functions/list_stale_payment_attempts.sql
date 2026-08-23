create or replace function ordering.list_stale_payment_attempts (
  p_before timestamp with time zone,
  p_limit  integer                  default 100
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_before is null or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'invalid reconciliation query';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'payment_id', payment.id,
        'order_id', payment.order_id,
        'provider', payment.provider,
        'provider_order_id', payment.provider_order_id,
        'provider_payment_id', payment.provider_payment_id,
        'status', payment.status,
        'amount', payment.amount,
        'currency', payment.currency,
        'updated_at', payment.updated_at
      )
      order by payment.updated_at, payment.id
    )
    from (
      select pending_payment.*
      from ordering.payments as pending_payment
      where pending_payment.status in ('created', 'pending', 'authorized')
        and pending_payment.updated_at < p_before
      order by pending_payment.updated_at, pending_payment.id
      limit p_limit
    ) as payment
  ), '[]'::jsonb);
end;
$function$;

grant execute on function "ordering"."list_stale_payment_attempts"(timestamp with time zone, integer) to "postgres", "service_role";

revoke all on function "ordering"."list_stale_payment_attempts"(timestamp with time zone, integer) from public;
