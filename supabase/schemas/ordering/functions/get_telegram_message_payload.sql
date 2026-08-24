create or replace function ordering.get_telegram_message_payload (
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
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram payload requires the trusted backend';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'business_id', v_order.business_id,
    'location_id', v_order.location_id,
    'order_number', v_order.order_number,
    'fulfillment_type', v_order.fulfillment_type,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'currency', v_order.currency,
    'grand_total', v_order.grand_total,
    'customer_name', v_order.customer_name_snapshot,
    'customer_phone', v_order.customer_phone_snapshot,
    'delivery_address', v_order.delivery_address_snapshot,
    'customer_note', v_order.customer_note,
    'restaurant_note', v_order.restaurant_note,
    'estimated_delivery_minutes', v_order.estimated_delivery_minutes,
    'placed_at', v_order.placed_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_name', item.product_name,
          'quantity', item.quantity,
          'line_total', item.line_total,
          'customer_note', item.customer_note,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'option_group_name', selected.option_group_name,
                'option_name', selected.option_name,
                'quantity', selected.quantity
              ) order by selected.id
            )
            from ordering.order_item_options as selected
            where selected.order_item_id = item.id
          ), '[]'::jsonb)
        ) order by item.created_at, item.id
      )
      from ordering.order_items as item
      where item.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."get_telegram_message_payload"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."get_telegram_message_payload"(uuid) from public;
