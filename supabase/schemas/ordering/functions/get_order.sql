create or replace function ordering.get_order (
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
  v_is_operator boolean;
  v_result jsonb;
begin
  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found or not (select private.can_view_order(v_order.business_id, v_order.customer_id)) then
    raise exception using errcode = '42501', message = 'order access denied';
  end if;

  v_is_operator := private.can_operate_orders(v_order.business_id) or private.request_is_service_role();

  select jsonb_build_object(
    'id', placed_order.id,
    'order_number', placed_order.order_number,
    'business_id', placed_order.business_id,
    'location_id', placed_order.location_id,
    'fulfillment_type', placed_order.fulfillment_type,
    'status', placed_order.status,
    'payment_status', placed_order.payment_status,
    'payment_method', placed_order.payment_method,
    'currency', placed_order.currency,
    'food_subtotal', placed_order.food_subtotal,
    'discount_total', placed_order.discount_total,
    'tax_total', placed_order.tax_total,
    'delivery_fee', placed_order.delivery_fee,
    'loyalty_redeemed', placed_order.loyalty_redeemed,
    'grand_total', placed_order.grand_total,
    'customer_name', placed_order.customer_name_snapshot,
    'customer_phone', placed_order.customer_phone_snapshot,
    'delivery_address', placed_order.delivery_address_snapshot,
    'delivery_contact', case when placed_order.fulfillment_type = 'delivery' then jsonb_build_object(
      'method', coalesce(placed_order.delivery_contact_method_snapshot, 'phone'),
      'phone', coalesce(placed_order.delivery_contact_phone_snapshot, placed_order.customer_phone_snapshot),
      'telegram_username', placed_order.delivery_contact_telegram_username_snapshot
    ) else null end,
    'customer_note', placed_order.customer_note,
    'restaurant_note', case when v_is_operator then placed_order.restaurant_note else null end,
    'placed_at', placed_order.placed_at,
    'accepted_at', placed_order.accepted_at,
    'out_for_delivery_at', placed_order.out_for_delivery_at,
    'delivered_at', placed_order.delivered_at,
    'cancelled_at', placed_order.cancelled_at,
    'cancel_reason', placed_order.cancel_reason,
    'estimated_delivery_minutes', placed_order.estimated_delivery_minutes,
    'coupon_code', placed_order.coupon_code_snapshot,
    'coupon_discount_amount', placed_order.coupon_discount_amount,
    'customer_cancel_seconds_remaining', case
      when placed_order.status = 'placed' and placed_order.placed_at is not null
      then greatest(0, floor(extract(epoch from (placed_order.placed_at + interval '90 seconds' - now())))::integer)
      else 0
    end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'product_id', item.product_id,
        'product_name', item.product_name,
        'quantity', item.quantity,
        'base_unit_price', item.base_unit_price,
        'modifier_unit_total', item.modifier_unit_total,
        'final_unit_price', item.final_unit_price,
        'line_total', item.line_total,
        'customer_note', item.customer_note,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'option_group_name', selected.option_group_name,
            'option_id', selected.option_id,
            'option_name', selected.option_name,
            'price_delta', selected.price_delta,
            'quantity', selected.quantity
          ) order by selected.id)
          from ordering.order_item_options as selected
          where selected.order_item_id = item.id
        ), '[]'::jsonb)
      ) order by item.created_at, item.id)
      from ordering.order_items as item
      where item.order_id = placed_order.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', event.event_type,
        'from_status', event.from_status,
        'to_status', event.to_status,
        'actor_type', event.actor_type,
        'created_at', event.created_at
      ) order by event.created_at, event.id)
      from ordering.order_events as event
      where event.order_id = placed_order.id
    ), '[]'::jsonb),
    'created_at', placed_order.created_at,
    'updated_at', placed_order.updated_at
  ) into v_result
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  return v_result;
end;
$function$;

grant execute on function "ordering"."get_order"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_order"(uuid) from public;
