create or replace function private.haversine_distance_km (
  p_origin_latitude       numeric,
  p_origin_longitude      numeric,
  p_destination_latitude  numeric,
  p_destination_longitude numeric
)
  returns double precision
  language sql
  immutable
  parallel safe
  strict
  set search_path to ''
  AS $function$
  select 6371.0088::double precision * 2::double precision * asin(
    sqrt(
      least(
        1::double precision,
        greatest(
          0::double precision,
          power(
            sin(
              radians(
                (p_destination_latitude - p_origin_latitude)::double precision
              ) / 2::double precision
            ),
            2::double precision
          )
          + cos(radians(p_origin_latitude::double precision))
          * cos(radians(p_destination_latitude::double precision))
          * power(
            sin(
              radians(
                (p_destination_longitude - p_origin_longitude)::double precision
              ) / 2::double precision
            ),
            2::double precision
          )
        )
      )
    )
  );
$function$;

grant execute on function "private"."haversine_distance_km"(numeric, numeric, numeric, numeric) to "postgres";

revoke all on function "private"."haversine_distance_km"(numeric, numeric, numeric, numeric) from public;
