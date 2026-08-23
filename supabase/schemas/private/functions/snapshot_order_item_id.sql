create or replace function private.snapshot_order_item_id (
  p_order_id     uuid,
  p_cart_item_id uuid
)
  returns uuid
  language sql
  immutable
  parallel safe
  strict
  set search_path to ''
  AS $function$
  with digest as (
    select md5(p_order_id::text || ':' || p_cart_item_id::text) as value
  )
  select (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-' ||
    substr(value, 13, 4) || '-' ||
    substr(value, 17, 4) || '-' ||
    substr(value, 21, 12)
  )::uuid
  from digest;
$function$;

grant execute on function "private"."snapshot_order_item_id"(uuid, uuid) to "postgres";

revoke all on function "private"."snapshot_order_item_id"(uuid, uuid) from public;
