create or replace function private.capture_daily_sales_summary_notification_events()
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'sales.daily_summary', 'location', l.id, l.business_id, l.id,
    'location:' || l.id::text || ':summary:' || to_char((now() at time zone b.timezone)::date, 'YYYY-MM-DD'),
    now(),
    jsonb_build_object('summaryDate', to_char((now() at time zone b.timezone)::date, 'YYYY-MM-DD'))
  from core.business_locations l
  join core.businesses b on b.id = l.business_id
  where l.is_active
    and extract(hour from (now() at time zone b.timezone))::int = 23
  on conflict (dedupe_key) do nothing;
end;
$function$;

grant execute on function "private"."capture_daily_sales_summary_notification_events"() to "postgres";

revoke all on function "private"."capture_daily_sales_summary_notification_events"() from public;
