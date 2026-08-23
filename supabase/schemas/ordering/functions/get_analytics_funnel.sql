create or replace function ordering.get_analytics_funnel (
  p_business_id uuid,
  p_from        timestamp with time zone default (now() - '30 days'::interval),
  p_to          timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'analytics reporting denied';
  end if;

  if p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '366 days' then
    raise exception using
      errcode = '22023',
      message = 'analytics window must be positive and no longer than 366 days';
  end if;

  with per_session as (
    select event.session_id,
           min(event.occurred_at) filter (where event.event_name = 'menu_viewed') as menu_viewed_at,
           min(event.occurred_at) filter (where event.event_name = 'item_added_to_cart') as item_added_at,
           min(event.occurred_at) filter (where event.event_name = 'cart_viewed') as cart_viewed_at,
           min(event.occurred_at) filter (where event.event_name = 'checkout_started') as checkout_started_at,
           min(event.occurred_at) filter (where event.event_name = 'payment_started') as payment_started_at,
           min(event.occurred_at) filter (where event.event_name = 'order_placed') as order_placed_at
    from ordering.analytics_events as event
    where event.business_id = p_business_id
      and event.occurred_at >= p_from
      and event.occurred_at < p_to
    group by event.session_id
  ), stage_counts as (
    select count(*) filter (where menu_viewed_at is not null) as menu_viewed_sessions,
           count(*) filter (
             where item_added_at is not null
               and menu_viewed_at is not null
               and menu_viewed_at <= item_added_at
           ) as item_added_to_cart_sessions,
           count(*) filter (
             where cart_viewed_at is not null
               and item_added_at is not null
               and item_added_at <= cart_viewed_at
           ) as cart_viewed_sessions,
           count(*) filter (
             where checkout_started_at is not null
               and cart_viewed_at is not null
               and cart_viewed_at <= checkout_started_at
           ) as checkout_started_sessions,
           count(*) filter (
             where payment_started_at is not null
               and checkout_started_at is not null
               and checkout_started_at <= payment_started_at
           ) as payment_started_sessions,
           count(*) filter (
             where order_placed_at is not null
               and payment_started_at is not null
               and payment_started_at <= order_placed_at
           ) as order_placed_sessions
    from per_session
  ), event_counts as (
    select event.event_name,
           count(*) as event_count,
           count(distinct event.session_id) as session_count
    from ordering.analytics_events as event
    where event.business_id = p_business_id
      and event.occurred_at >= p_from
      and event.occurred_at < p_to
      and event.event_name in (
        'menu_viewed', 'item_added_to_cart', 'cart_viewed',
        'checkout_started', 'payment_started', 'order_placed'
      )
    group by event.event_name
  )
  select jsonb_build_object(
    'business_id', p_business_id,
    'from', p_from,
    'to', p_to,
    'definition', 'A session advances only when each listed funnel event occurred in order within the selected window.',
    'stages', jsonb_build_object(
      'menu_viewed', coalesce(stage_counts.menu_viewed_sessions, 0),
      'item_added_to_cart', coalesce(stage_counts.item_added_to_cart_sessions, 0),
      'cart_viewed', coalesce(stage_counts.cart_viewed_sessions, 0),
      'checkout_started', coalesce(stage_counts.checkout_started_sessions, 0),
      'payment_started', coalesce(stage_counts.payment_started_sessions, 0),
      'order_placed', coalesce(stage_counts.order_placed_sessions, 0)
    ),
    'events', coalesce((
      select jsonb_object_agg(
        event_counts.event_name,
        jsonb_build_object(
          'events', event_counts.event_count,
          'sessions', event_counts.session_count
        )
      )
      from event_counts
    ), '{}'::jsonb)
  )
  into v_result
  from stage_counts;

  return v_result;
end;
$function$;

grant execute on function "ordering"."get_analytics_funnel"(uuid, timestamp with time zone, timestamp with time zone) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_analytics_funnel"(uuid, timestamp with time zone, timestamp with time zone) from public;
