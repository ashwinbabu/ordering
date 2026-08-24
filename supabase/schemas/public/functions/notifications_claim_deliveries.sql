create or replace function public.notifications_claim_deliveries (
  p_limit         integer default 20,
  p_lease_seconds integer default 120
)
  returns SETOF notifications.deliveries
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.deliveries d
  set status = 'sending',
      sending_started_at = now(),
      sending_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = d.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.deliveries
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'sending' and sending_lease_expires_at < now())
    order by created_at
    limit p_limit
    for update skip locked
  ) as claimed
  where d.id = claimed.id
  returning d.*;
end;
$function$;

grant execute on function "public"."notifications_claim_deliveries"(integer, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_claim_deliveries"(integer, integer) from public;
