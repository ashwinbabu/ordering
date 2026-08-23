create or replace function ordering.ingest_analytics_events (
  p_events jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_events jsonb;
  v_business_id uuid;
  v_session_id uuid;
  v_input_count integer;
  v_new_count integer;
  v_recent_count integer;
  v_inserted_count integer;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'analytics ingestion requires the trusted backend';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'analytics events must be a JSON array';
  end if;

  v_input_count := jsonb_array_length(p_events);
  if v_input_count < 1 or v_input_count > 25 then
    raise exception using errcode = '22023', message = 'analytics event batch size must be between 1 and 25';
  end if;

  -- Supply a UUID only when an internal caller omitted one. Browser retries
  -- should always reuse their generated event UUID for deterministic dedupe.
  select jsonb_agg(
    case
      when entry.value ? 'id' and nullif(entry.value ->> 'id', '') is not null
        then entry.value
      else entry.value || jsonb_build_object('id', gen_random_uuid()::text)
    end
  )
  into v_events
  from jsonb_array_elements(p_events) as entry;

  select event.business_id, event.session_id
  into v_business_id, v_session_id
  from jsonb_to_recordset(v_events) as event(
    id uuid,
    business_id uuid,
    session_id uuid
  )
  limit 1;

  if v_business_id is null or v_session_id is null then
    raise exception using errcode = '22023', message = 'each analytics event requires business_id and session_id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_events) as event(
      id uuid,
      business_id uuid,
      session_id uuid
    )
    where event.business_id is distinct from v_business_id
       or event.session_id is distinct from v_session_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'every analytics batch must belong to one business and session';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_events) as event(event_name text)
    where event.event_name = 'order_placed'
  ) then
    raise exception using
      errcode = '42501',
      message = 'order_placed must use the trusted order-placement analytics function';
  end if;

  -- A transaction advisory lock makes the database-side session limit safe
  -- across concurrent Edge invocations. The public Edge endpoint must also
  -- rate-limit by client/IP because a malicious caller could mint sessions.
  perform pg_advisory_xact_lock(
    hashtextextended(v_business_id::text || ':' || v_session_id::text, 0)
  );

  select count(distinct input.id)
  into v_new_count
  from jsonb_to_recordset(v_events) as input(id uuid)
  left join ordering.analytics_events as existing
    on existing.id = input.id
  where existing.id is null;

  select count(*)
  into v_recent_count
  from ordering.analytics_events as event
  where event.business_id = v_business_id
    and event.session_id = v_session_id
    and event.occurred_at >= now() - interval '1 minute';

  if v_recent_count + v_new_count > 60 then
    raise exception using
      errcode = '54000',
      message = 'analytics session rate limit exceeded';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(v_events) as event(
      id uuid,
      business_id uuid,
      location_id uuid,
      session_id uuid,
      customer_id uuid,
      cart_id uuid,
      order_id uuid,
      acquisition_source_id uuid,
      event_name text,
      metadata jsonb,
      occurred_at timestamptz
    )
  ), inserted as (
    insert into ordering.analytics_events (
      id,
      business_id,
      location_id,
      session_id,
      customer_id,
      cart_id,
      order_id,
      acquisition_source_id,
      event_name,
      metadata,
      occurred_at
    )
    select input.id,
           input.business_id,
           input.location_id,
           input.session_id,
           input.customer_id,
           input.cart_id,
           input.order_id,
           input.acquisition_source_id,
           input.event_name,
           coalesce(input.metadata, '{}'::jsonb),
           greatest(
             now() - interval '5 minutes',
             least(coalesce(input.occurred_at, now()), now() + interval '1 minute')
           )
    from input
    on conflict (id) do nothing
    returning id
  )
  select count(*) into v_inserted_count from inserted;

  return jsonb_build_object(
    'received', v_input_count,
    'inserted', v_inserted_count,
    'ignored_duplicate', v_input_count - v_inserted_count
  );
end;
$function$;

grant execute on function "ordering"."ingest_analytics_events"(jsonb) to "postgres", "service_role";

comment on function "ordering"."ingest_analytics_events"(jsonb) is 'Service-only batch funnel ingestion with UUID dedupe and a per-session database rate limit.';

revoke all on function "ordering"."ingest_analytics_events"(jsonb) from public;
