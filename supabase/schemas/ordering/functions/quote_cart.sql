create or replace function ordering.quote_cart (
  p_cart_id                      uuid,
  p_anonymous_session_id         uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_trusted_delivery_minutes     smallint default null::smallint
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_quote jsonb;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  v_quote := private.calculate_order_quote(
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_trusted_delivery_minutes,
    now()
  );

  -- Remove internal economics and raw tax configuration from the customer
  -- response while retaining the payable components.
  return v_quote
    - 'estimated_delivery_cost'
    - 'aggregator_benchmark_rate_snapshot'
    - 'skrowia_commission_rate_snapshot'
    - 'skrowia_commissionable_amount'
    - 'tax_mode'
    - 'tax_rate';
end;
$function$;

grant execute on function "ordering"."quote_cart"(uuid, uuid, text, uuid, smallint) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."quote_cart"(uuid, uuid, text, uuid, smallint) from public;
