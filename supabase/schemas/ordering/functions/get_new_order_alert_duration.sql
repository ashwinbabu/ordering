create or replace function ordering.get_new_order_alert_duration (
  p_location_id uuid
)
  returns smallint
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_duration_seconds smallint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read the new-order alert.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to read this outlet setting.' using errcode = '42501';
  end if;

  select settings.new_order_alert_duration_seconds
  into v_duration_seconds
  from ordering.restaurant_settings as settings
  join core.business_locations as location
    on location.id = settings.location_id
  where settings.location_id = p_location_id
    and location.is_active;

  if v_duration_seconds is null then
    raise exception 'The new-order alert is not configured for this outlet.' using errcode = '22023';
  end if;

  return v_duration_seconds;
end;
$function$;

grant execute on function "ordering"."get_new_order_alert_duration"(uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_new_order_alert_duration"(uuid) from public;
