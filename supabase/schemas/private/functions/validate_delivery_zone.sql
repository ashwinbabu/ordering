create or replace function private.validate_delivery_zone()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform 1
  from core.business_locations as location
  where location.id = new.location_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'location does not exist';
  end if;

  if new.is_active and exists (
    select 1
    from ordering.delivery_zones as sibling
    where sibling.location_id = new.location_id
      and sibling.is_active
      and sibling.id <> new.id
      and new.min_distance_km < sibling.max_distance_km
      and sibling.min_distance_km < new.max_distance_km
  ) then
    raise exception using
      errcode = '23P01',
      message = 'active delivery zones cannot overlap';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_delivery_zone"() to "postgres";

revoke all on function "private"."validate_delivery_zone"() from public;
