create or replace function ordering.set_new_order_alert_duration (
  p_business_id         uuid,
  p_location_id         uuid,
  p_expected_updated_at timestamp with time zone,
  p_duration_seconds    smallint
)
  returns timestamp with time zone
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to change the new-order alert.' using errcode = '42501';
  end if;

  if p_duration_seconds is null or p_duration_seconds not between 1 and 60 then
    raise exception 'The new-order alert duration must be between 1 and 60 seconds.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception 'You do not have permission to change this outlet setting.' using errcode = '42501';
  end if;

  update ordering.restaurant_settings
  set new_order_alert_duration_seconds = p_duration_seconds
  where location_id = p_location_id
    and updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception 'Business settings changed in another session. Reload and review the latest values.' using errcode = '40001';
  end if;

  return v_updated_at;
end;
$function$;

grant execute on function "ordering"."set_new_order_alert_duration"(uuid, uuid, timestamp with time zone, smallint) to "authenticated", "postgres";

revoke all on function "ordering"."set_new_order_alert_duration"(uuid, uuid, timestamp with time zone, smallint) from public;
