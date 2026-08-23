create or replace function private.is_location_open_at (
  p_location_id uuid,
  p_at          timestamp with time zone
)
  returns boolean
  language sql
  stable
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    join ordering.opening_hours as hours
      on hours.location_id = location.id
    cross join lateral (
      select p_at at time zone business.timezone as local_timestamp
    ) as local_clock
    where location.id = p_location_id
      and not hours.is_closed
      and (
        (
          hours.opens_at < hours.closes_at
          and hours.day_of_week = extract(
            isodow from local_clock.local_timestamp
          )::smallint
          and local_clock.local_timestamp::time >= hours.opens_at
          and local_clock.local_timestamp::time < hours.closes_at
        )
        or
        (
          hours.opens_at > hours.closes_at
          and (
            (
              hours.day_of_week = extract(
                isodow from local_clock.local_timestamp
              )::smallint
              and local_clock.local_timestamp::time >= hours.opens_at
            )
            or
            (
              hours.day_of_week = case
                when extract(
                  isodow from local_clock.local_timestamp
                )::smallint = 1 then 7
                else extract(
                  isodow from local_clock.local_timestamp
                )::smallint - 1
              end
              and local_clock.local_timestamp::time < hours.closes_at
            )
          )
        )
      )
  );
$function$;

grant execute on function "private"."is_location_open_at"(uuid, timestamp with time zone) to "postgres";

revoke all on function "private"."is_location_open_at"(uuid, timestamp with time zone) from public;
