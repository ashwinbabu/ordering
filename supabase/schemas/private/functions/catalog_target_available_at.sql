create or replace function private.catalog_target_available_at (
  p_location_id uuid,
  p_category_id uuid,
  p_product_id  uuid,
  p_at          timestamp with time zone
)
  returns boolean
  language plpgsql
  stable
  set search_path to ''
  AS $function$
declare
  v_local_timestamp timestamp;
  v_has_windows boolean;
  v_current_day smallint;
  v_previous_day smallint;
  v_current_time time;
begin
  if (p_category_id is null) = (p_product_id is null) then
    return false;
  end if;

  select p_at at time zone business.timezone
  into v_local_timestamp
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  where location.id = p_location_id;

  if not found then
    return false;
  end if;

  select exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.location_id = p_location_id
      and (
        (p_category_id is not null
         and availability.category_id = p_category_id)
        or
        (p_product_id is not null
         and availability.product_id = p_product_id)
      )
  ) into v_has_windows;

  if not v_has_windows then
    return true;
  end if;

  v_current_day := extract(isodow from v_local_timestamp)::smallint;
  v_previous_day := case
    when v_current_day = 1 then 7
    else v_current_day - 1
  end;
  v_current_time := v_local_timestamp::time;

  return exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.location_id = p_location_id
      and (
        (p_category_id is not null
         and availability.category_id = p_category_id)
        or
        (p_product_id is not null
         and availability.product_id = p_product_id)
      )
      and (
        (
          availability.starts_at < availability.ends_at
          and availability.day_of_week = v_current_day
          and v_current_time >= availability.starts_at
          and v_current_time < availability.ends_at
        )
        or
        (
          availability.starts_at > availability.ends_at
          and (
            (
              availability.day_of_week = v_current_day
              and v_current_time >= availability.starts_at
            )
            or
            (
              availability.day_of_week = v_previous_day
              and v_current_time < availability.ends_at
            )
          )
        )
      )
  );
end;
$function$;

grant execute on function "private"."catalog_target_available_at"(uuid, uuid, uuid, timestamp with time zone) to "postgres";

revoke all on function "private"."catalog_target_available_at"(uuid, uuid, uuid, timestamp with time zone) from public;
