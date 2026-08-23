create or replace function private.transition_order_internal (
  p_order_id         uuid,
  p_expected_status  text,
  p_new_status       text,
  p_cancel_reason    text,
  p_actor_mode       text   default 'request'::text,
  p_telegram_user_id bigint default null::bigint
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_now timestamptz := now();
  v_customer_actor boolean := false;
  v_operator_id uuid;
  v_service_actor boolean := false;
  v_telegram_staff_id uuid;
  v_allowed boolean := false;
  v_event_type text;
  v_actor_type text;
  v_actor_id uuid;
begin
  if p_actor_mode not in ('request', 'telegram') then
    raise exception using errcode = '22023', message = 'invalid transition actor mode';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  v_service_actor := private.request_is_service_role();

  if p_actor_mode = 'telegram' then
    if not v_service_actor then
      raise exception using errcode = '42501', message = 'Telegram transitions require the trusted backend';
    end if;

    if p_telegram_user_id is null then
      raise exception using errcode = '22023', message = 'Telegram sender identifier is required';
    end if;

    select staff.id
    into v_telegram_staff_id
    from ordering.telegram_staff as staff
    where staff.business_id = v_order.business_id
      and staff.telegram_user_id = p_telegram_user_id
      and staff.is_authorized
    for update;

    if v_telegram_staff_id is null then
      raise exception using errcode = '42501', message = 'Telegram staff authorization denied';
    end if;
  else
    select exists (
      select 1
      from core.customers as customer
      where customer.id = v_order.customer_id
        and customer.auth_user_id = (select auth.uid())
    ) into v_customer_actor;

    select operator_user.id
    into v_operator_id
    from core.business_users as membership
    join core.users as operator_user
      on operator_user.id = membership.user_id
    where membership.business_id = v_order.business_id
      and membership.is_active
      and operator_user.auth_user_id = (select auth.uid());

    if not v_service_actor and not v_customer_actor and v_operator_id is null then
      raise exception using errcode = '42501', message = 'order transition denied';
    end if;
  end if;

  -- The duplicate callback acknowledgement is intentionally successful, but
  -- authorization above still has to pass for a disabled staff mapping.
  if v_order.status = p_new_status then
    return ordering.get_order(p_order_id);
  end if;

  if v_order.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'order status changed before this transition';
  end if;

  if p_new_status = 'cancelled' then
    if p_cancel_reason is null or btrim(p_cancel_reason) = '' then
      raise exception using errcode = '22023', message = 'cancellation reason is required';
    end if;

    v_allowed := (
      p_actor_mode = 'request'
      and v_customer_actor
      and v_operator_id is null
      and v_order.status = 'placed'
      and v_order.placed_at is not null
      and v_now < v_order.placed_at + interval '90 seconds'
    ) or (
      (v_operator_id is not null or v_telegram_staff_id is not null)
      and v_order.status in (
        'placed', 'needs_attention', 'accepted',
        'ready_for_pickup', 'out_for_delivery'
      )
    ) or (
      p_actor_mode = 'request'
      and v_service_actor
      and v_order.status <> 'delivered'
      and v_order.status <> 'cancelled'
    );
  elsif p_actor_mode = 'request'
      and v_service_actor
      and v_order.status = 'payment_pending'
      and p_new_status = 'placed' then
    v_allowed := v_order.payment_status in ('paid', 'not_required');
  elsif v_operator_id is not null or v_telegram_staff_id is not null then
    v_allowed := (
      (v_order.status = 'placed' and p_new_status in ('accepted', 'needs_attention'))
      or
      (v_order.status = 'needs_attention' and p_new_status = 'accepted')
      or
      (
        v_order.status = 'accepted'
        and v_order.fulfillment_type = 'delivery'
        and p_new_status = 'out_for_delivery'
      )
      or
      (
        v_order.status = 'accepted'
        and v_order.fulfillment_type = 'pickup'
        and p_new_status = 'ready_for_pickup'
      )
      or
      (
        v_order.status = 'out_for_delivery'
        and v_order.fulfillment_type = 'delivery'
        and p_new_status = 'delivered'
      )
      or
      (
        v_order.status = 'ready_for_pickup'
        and v_order.fulfillment_type = 'pickup'
        and p_new_status = 'delivered'
      )
    );
  end if;

  if p_new_status in (
    'accepted', 'needs_attention', 'ready_for_pickup',
    'out_for_delivery', 'delivered'
  ) and not (
    v_order.payment_status = 'paid'
    or (v_order.payment_method = 'cash' and v_order.payment_status = 'pending')
  ) then
    v_allowed := false;
  end if;

  if not v_allowed then
    raise exception using errcode = '22023', message = 'invalid order transition';
  end if;

  update ordering.orders
  set status = p_new_status,
      placed_at = case
        when p_new_status = 'placed' then coalesce(placed_at, v_now)
        else placed_at
      end,
      accepted_at = case
        when p_new_status = 'accepted' then coalesce(accepted_at, v_now)
        else accepted_at
      end,
      out_for_delivery_at = case
        when p_new_status = 'out_for_delivery'
          then coalesce(out_for_delivery_at, v_now)
        else out_for_delivery_at
      end,
      delivered_at = case
        when p_new_status = 'delivered' then coalesce(delivered_at, v_now)
        else delivered_at
      end,
      cancelled_at = case
        when p_new_status = 'cancelled' then coalesce(cancelled_at, v_now)
        else cancelled_at
      end,
      cancel_reason = case
        when p_new_status = 'cancelled' then btrim(p_cancel_reason)
        else cancel_reason
      end
  where id = p_order_id
    and status = p_expected_status;

  if not found then
    raise exception using errcode = '40001', message = 'order transition lost a race';
  end if;

  v_event_type := case p_new_status
    when 'placed' then 'order_placed'
    when 'accepted' then 'order_accepted'
    when 'needs_attention' then 'order_needs_attention'
    when 'ready_for_pickup' then 'order_ready_for_pickup'
    when 'out_for_delivery' then 'order_out_for_delivery'
    when 'delivered' then 'order_delivered'
    when 'cancelled' then 'order_cancelled'
  end;

  if v_telegram_staff_id is not null then
    v_actor_type := 'telegram';
    v_actor_id := v_telegram_staff_id;
  elsif v_operator_id is not null then
    v_actor_type := 'admin';
    v_actor_id := v_operator_id;
  elsif v_customer_actor and not v_service_actor then
    v_actor_type := 'customer';
    v_actor_id := v_order.customer_id;
  else
    v_actor_type := 'system';
    v_actor_id := null;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_order.business_id,
    v_event_type,
    v_order.status,
    p_new_status,
    v_actor_type,
    v_actor_id,
    case
      when p_new_status = 'cancelled' then
        jsonb_build_object(
          'schema_version', 1,
          'reason', btrim(p_cancel_reason),
          'paid_amount', case
            when v_order.payment_status in (
              'paid', 'partially_refunded', 'refunded'
            ) then v_order.grand_total
            else 0
          end,
          'manual_refund_required', v_order.payment_status in (
            'paid', 'partially_refunded'
          )
        )
      else jsonb_build_object('schema_version', 1)
    end
  );

  if p_new_status = 'delivered' then
    update core.customer_businesses
    set first_order_at = coalesce(first_order_at, v_now),
        last_order_at = greatest(coalesce(last_order_at, v_now), v_now),
        order_count = order_count + 1,
        lifetime_order_value = lifetime_order_value + v_order.grand_total
    where id = v_order.customer_business_id
      and business_id = v_order.business_id
      and customer_id = v_order.customer_id;
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

grant execute on function "private"."transition_order_internal"(uuid, text, text, text, text, bigint) to "postgres";

revoke all on function "private"."transition_order_internal"(uuid, text, text, text, text, bigint) from public;
