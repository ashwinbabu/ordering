create or replace function notifications.retry_backoff (
  p_attempt_count integer
)
  returns interval
  language sql
  immutable
  set search_path to ''
  AS $function$
  select (array[
    interval '1 minute',
    interval '5 minutes',
    interval '15 minutes',
    interval '1 hour',
    interval '6 hours'
  ])[least(greatest(p_attempt_count, 1), 5)];
$function$;

grant execute on function "notifications"."retry_backoff"(integer) to "postgres";
