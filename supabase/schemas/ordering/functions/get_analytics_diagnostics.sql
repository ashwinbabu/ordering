create or replace function ordering.get_analytics_diagnostics (
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

  return jsonb_build_object(
    'business_id', p_business_id,
    'from', p_from,
    'to', p_to,
    'events', coalesce((
      select jsonb_object_agg(
        event.event_name,
        jsonb_build_object(
          'events', event.event_count,
          'sessions', event.session_count
        )
      )
      from (
        select analytics.event_name,
               count(*) as event_count,
               count(distinct analytics.session_id) as session_count
        from ordering.analytics_events as analytics
        where analytics.business_id = p_business_id
          and analytics.occurred_at >= p_from
          and analytics.occurred_at < p_to
          and analytics.event_name in (
            'payment_failed', 'otp_failed', 'delivery_unserviceable',
            'location_permission_denied'
          )
        group by analytics.event_name
      ) as event
    ), '{}'::jsonb)
  );
end;
$function$;

grant execute on function "ordering"."get_analytics_diagnostics"(uuid, timestamp with time zone, timestamp with time zone) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_analytics_diagnostics"(uuid, timestamp with time zone, timestamp with time zone) from public;
