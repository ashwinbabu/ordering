create or replace function ordering.broadcast_ordering_status()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform realtime.send(
    jsonb_build_object(
      'locationId', new.location_id,
      'orderingEnabled', new.ordering_enabled
    ),
    'ordering-status',
    'ordering-status:' || new.location_id::text,
    false
  );
  return null;
end;
$function$;

grant execute on function "ordering"."broadcast_ordering_status"() to "postgres";

comment on function "ordering"."broadcast_ordering_status"() is 'Broadcasts only the accepting-orders flag for a location. Does not expose any other restaurant_settings column.';
