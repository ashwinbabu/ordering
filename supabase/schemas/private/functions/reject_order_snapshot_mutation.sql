create or replace function private.reject_order_snapshot_mutation()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  raise exception using
    errcode = '23514',
    message = 'order line and event snapshots are append-only';
end;
$function$;

grant execute on function "private"."reject_order_snapshot_mutation"() to "postgres";

revoke all on function "private"."reject_order_snapshot_mutation"() from public;
