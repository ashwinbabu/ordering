create or replace function ordering.list_orders (
  p_business_id       uuid,
  p_statuses          text[]                   default null::text[],
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_id         uuid                     default null::uuid,
  p_limit             integer                  default 50
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.can_operate_orders(p_business_id) then
    raise exception using errcode = '42501', message = 'order queue access denied';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'invalid page size';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'complete cursor is required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', queue_order.id,
        'order_number', queue_order.order_number,
        'location_id', queue_order.location_id,
        'fulfillment_type', queue_order.fulfillment_type,
        'status', queue_order.status,
        'payment_status', queue_order.payment_status,
        'payment_method', queue_order.payment_method,
        'grand_total', queue_order.grand_total,
        'currency', queue_order.currency,
        'customer_name', queue_order.customer_name_snapshot,
        'customer_phone', queue_order.customer_phone_snapshot,
        'placed_at', queue_order.placed_at,
        'estimated_delivery_minutes', queue_order.estimated_delivery_minutes,
        'created_at', queue_order.created_at
      )
      order by queue_order.created_at desc, queue_order.id desc
    )
    from (
      select placed_order.*
      from ordering.orders as placed_order
      where placed_order.business_id = p_business_id
        and (p_statuses is null or placed_order.status = any(p_statuses))
        and (
          p_before_created_at is null
          or (placed_order.created_at, placed_order.id)
            < (p_before_created_at, p_before_id)
        )
      order by placed_order.created_at desc, placed_order.id desc
      limit p_limit
    ) as queue_order
  ), '[]'::jsonb);
end;
$function$;

grant execute on function "ordering"."list_orders"(uuid, text[], timestamp with time zone, uuid, integer) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."list_orders"(uuid, text[], timestamp with time zone, uuid, integer) from public;
