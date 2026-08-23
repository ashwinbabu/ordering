create or replace function ordering.list_customer_orders (
  p_business_id uuid,
  p_location_id uuid,
  p_limit       integer default 20
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_customer_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  select customer.id into v_customer_id
  from core.customers as customer
  where customer.auth_user_id = (select auth.uid());

  if v_customer_id is null then
    return jsonb_build_object('schemaVersion', 1, 'orders', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'orders', coalesce((
      select jsonb_agg(entry order by entry ->> 'placedAt' desc nulls last)
      from (
        select jsonb_build_object(
          'id', o.id,
          'orderNumber', o.order_number,
          'status', o.status,
          'paymentStatus', o.payment_status,
          'paymentMethod', o.payment_method,
          'fulfillmentType', o.fulfillment_type,
          'currency', o.currency,
          'foodSubtotal', o.food_subtotal,
          'discountTotal', o.discount_total,
          'taxTotal', o.tax_total,
          'deliveryFee', o.delivery_fee,
          'grandTotal', o.grand_total,
          'couponCode', o.coupon_code_snapshot,
          'customerNote', o.customer_note,
          'cancelReason', o.cancel_reason,
          'deliveryAddress', o.delivery_address_snapshot,
          'deliveryContact', case when o.fulfillment_type = 'delivery' then jsonb_build_object(
            'method', coalesce(o.delivery_contact_method_snapshot, 'phone'),
            'phone', coalesce(o.delivery_contact_phone_snapshot, o.customer_phone_snapshot),
            'telegramUsername', o.delivery_contact_telegram_username_snapshot
          ) else null end,
          'estimatedDeliveryMinutes', o.estimated_delivery_minutes,
          'placedAt', o.placed_at,
          'acceptedAt', o.accepted_at,
          'outForDeliveryAt', o.out_for_delivery_at,
          'deliveredAt', o.delivered_at,
          'cancelledAt', o.cancelled_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', item.id,
              'productId', item.product_id,
              'productName', item.product_name,
              'quantity', item.quantity,
              'finalUnitPrice', item.final_unit_price,
              'lineTotal', item.line_total,
              'customerNote', item.customer_note,
              'options', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'optionName', opt.option_name,
                  'optionGroupName', opt.option_group_name,
                  'priceDelta', opt.price_delta
                ) order by opt.option_group_name, opt.option_name)
                from ordering.order_item_options as opt
                where opt.order_item_id = item.id
              ), '[]'::jsonb)
            ) order by item.created_at, item.id)
            from ordering.order_items as item
            where item.order_id = o.id
          ), '[]'::jsonb)
        ) as entry
        from ordering.orders as o
        where o.customer_id = v_customer_id
          and o.business_id = p_business_id
          and o.location_id = p_location_id
          and o.status <> 'payment_pending'
        order by o.placed_at desc nulls last
        limit v_limit
      ) as ordered_entries
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."list_customer_orders"(uuid, uuid, integer) to "authenticated", "postgres";

revoke all on function "ordering"."list_customer_orders"(uuid, uuid, integer) from public;
