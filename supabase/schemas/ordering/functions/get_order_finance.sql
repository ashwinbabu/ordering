create or replace function ordering.get_order_finance (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
begin
  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found or not private.can_view_order_finance(v_order.business_id) then
    raise exception using errcode = '42501', message = 'finance access denied';
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'currency', v_order.currency,
    'food_subtotal', v_order.food_subtotal,
    'discount_total', v_order.discount_total,
    'tax_total', v_order.tax_total,
    'delivery_fee', v_order.delivery_fee,
    'grand_total', v_order.grand_total,
    'normal_delivery_fee', v_order.normal_delivery_fee,
    'estimated_delivery_cost', v_order.estimated_delivery_cost,
    'aggregator_benchmark_rate', v_order.aggregator_benchmark_rate_snapshot,
    'skrowia_commission_rate', v_order.skrowia_commission_rate_snapshot,
    'skrowia_commissionable_amount', v_order.skrowia_commissionable_amount,
    'skrowia_commission_due', round(
      v_order.skrowia_commissionable_amount
      * v_order.skrowia_commission_rate_snapshot / 100,
      2
    ),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', payment.id,
          'provider', payment.provider,
          'provider_order_id', payment.provider_order_id,
          'provider_payment_id', payment.provider_payment_id,
          'status', payment.status,
          'amount', payment.amount,
          'currency', payment.currency,
          'method', payment.method,
          'gateway_fee', payment.gateway_fee,
          'gateway_tax', payment.gateway_tax,
          'paid_at', payment.paid_at,
          'failed_at', payment.failed_at,
          'created_at', payment.created_at,
          'updated_at', payment.updated_at
        )
        order by payment.created_at, payment.id
      )
      from ordering.payments as payment
      where payment.order_id = v_order.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', refund.id,
          'payment_id', refund.payment_id,
          'amount', refund.amount,
          'method', refund.method,
          'status', refund.status,
          'reason', refund.reason,
          'processed_by', refund.processed_by,
          'external_reference', refund.external_reference,
          'processed_at', refund.processed_at,
          'created_at', refund.created_at
        )
        order by refund.created_at, refund.id
      )
      from ordering.refunds as refund
      where refund.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."get_order_finance"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_order_finance"(uuid) from public;
