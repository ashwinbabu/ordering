create or replace function ordering.mark_payment_pending (
  p_payment_id        uuid,
  p_provider_order_id text,
  p_gateway_payload   jsonb default '{}'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_provider_order_id is null or btrim(p_provider_order_id) = '' then
    raise exception using errcode = '22023', message = 'provider order id is required';
  end if;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment was not found';
  end if;

  if v_payment.status = 'paid' then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'provider_order_id', v_payment.provider_order_id
    );
  end if;

  if v_payment.status = 'pending' then
    if v_payment.provider_order_id = btrim(p_provider_order_id) then
      return jsonb_build_object(
        'payment_id', v_payment.id,
        'status', v_payment.status,
        'provider_order_id', v_payment.provider_order_id
      );
    end if;

    raise exception using
      errcode = '55000',
      message = 'payment is already pending under a different provider order id';
  end if;

  if v_payment.status <> 'created' then
    raise exception using errcode = '55000', message = 'payment is not awaiting provider creation';
  end if;

  update ordering.payments
  set provider_order_id = btrim(p_provider_order_id),
      status = 'pending',
      gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb)
  where id = p_payment_id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'pending',
    'provider_order_id', btrim(p_provider_order_id)
  );
end;
$function$;

grant execute on function "ordering"."mark_payment_pending"(uuid, text, jsonb) to "postgres", "service_role";

revoke all on function "ordering"."mark_payment_pending"(uuid, text, jsonb) from public;
