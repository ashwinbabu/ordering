-- Reverts the "default to today" window added in
-- 20260815140000_orders_queue_today_scope.sql, which was the wrong place to
-- enforce it.
--
-- That migration filtered delivered/cancelled orders by created_at within
-- today's window. An order created yesterday and delivered today therefore
-- vanished from the queue the moment the operator marked it delivered --
-- it disappeared from the Delivered tab and from All. Filtering by the
-- closure timestamp instead would not fix it either, because
-- private.transition_order_internal stamps milestones with
-- coalesce(delivered_at, v_now): an order that already carries a
-- delivered_at keeps the older value rather than being restamped.
--
-- An operations queue must never hide an order the operator just acted on,
-- so the queue no longer applies any date window by default. p_from/p_to
-- remain available for an explicit caller-supplied range, but default to
-- null (no filter). "Today" reporting is derived from each order's own
-- milestone timestamps by the caller instead, which keeps the visible queue
-- and the day's figures independent of one another.
create or replace function ordering.list_orders_for_location(
  p_business_id uuid,
  p_location_id uuid,
  p_statuses text[] default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_operate_orders(p_business_id)) then
    raise exception 'Order queue access denied.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid page size.' using errcode = '22023';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'A complete cursor is required.' using errcode = '22023';
  end if;

  if (p_from is null) <> (p_to is null) then
    raise exception 'A complete date window is required.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', queue_order.id,
        'order_number', queue_order.order_number,
        'fulfillment_type', queue_order.fulfillment_type,
        'status', queue_order.status,
        'payment_status', queue_order.payment_status,
        'currency', queue_order.currency,
        'food_subtotal', queue_order.food_subtotal,
        'discount_total', queue_order.discount_total,
        'tax_total', queue_order.tax_total,
        'delivery_fee', queue_order.delivery_fee,
        'grand_total', queue_order.grand_total,
        'customer_name', queue_order.customer_name_snapshot,
        'customer_phone', queue_order.customer_phone_snapshot,
        'delivery_address', queue_order.delivery_address_snapshot,
        'customer_note', queue_order.customer_note,
        'placed_at', queue_order.placed_at,
        'accepted_at', queue_order.accepted_at,
        'out_for_delivery_at', queue_order.out_for_delivery_at,
        'delivered_at', queue_order.delivered_at,
        'cancelled_at', queue_order.cancelled_at,
        'cancel_reason', queue_order.cancel_reason,
        'estimated_delivery_minutes', queue_order.estimated_delivery_minutes,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_name', item.product_name,
            'quantity', item.quantity,
            'customer_note', item.customer_note,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'option_name', option_item.option_name,
                'quantity', option_item.quantity
              ) order by option_item.id)
              from ordering.order_item_options as option_item
              where option_item.order_item_id = item.id
            ), '[]'::jsonb)
          ) order by item.created_at, item.id)
          from ordering.order_items as item
          where item.order_id = queue_order.id
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_type', event.event_type,
            'created_at', event.created_at
          ) order by event.created_at, event.id)
          from ordering.order_events as event
          where event.order_id = queue_order.id
        ), '[]'::jsonb)
      )
      order by queue_order.created_at desc, queue_order.id desc
    )
    from (
      select placed_order.*
      from ordering.orders as placed_order
      where placed_order.business_id = p_business_id
        and placed_order.location_id = p_location_id
        and (p_statuses is null or placed_order.status = any(p_statuses))
        and (
          p_from is null
          or (placed_order.created_at >= p_from and placed_order.created_at < p_to)
        )
        and (
          p_before_created_at is null
          or (placed_order.created_at, placed_order.id) < (p_before_created_at, p_before_id)
        )
      order by placed_order.created_at desc, placed_order.id desc
      limit p_limit
    ) as queue_order
  ), '[]'::jsonb);
end;
$$;

revoke all on function ordering.list_orders_for_location(uuid, uuid, text[], timestamptz, uuid, integer, timestamptz, timestamptz) from public;
grant execute on function ordering.list_orders_for_location(uuid, uuid, text[], timestamptz, uuid, integer, timestamptz, timestamptz) to authenticated;
