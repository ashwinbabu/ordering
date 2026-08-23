create or replace function public.notifications_claim_events (
  p_limit         integer default 20,
  p_lease_seconds integer default 120
)
  returns SETOF notifications.events
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.events e
  set status = 'planning',
      planning_started_at = now(),
      planning_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = e.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.events
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'planning' and planning_lease_expires_at < now())
    order by occurred_at
    limit p_limit
    for update skip locked
  ) as claimed
  where e.id = claimed.id
  returning e.*;
end;
$function$;

grant execute on function "public"."notifications_claim_events"(integer, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_claim_events"(integer, integer) from public;
