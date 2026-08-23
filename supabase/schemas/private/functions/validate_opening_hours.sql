create or replace function private.validate_opening_hours()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_new_start numeric;
  v_new_end numeric;
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

  if new.is_closed then
    if exists (
      select 1
      from ordering.opening_hours as sibling
      where sibling.location_id = new.location_id
        and sibling.day_of_week = new.day_of_week
        and sibling.id <> new.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'a closed marker cannot coexist with an opening interval';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from ordering.opening_hours as sibling
    where sibling.location_id = new.location_id
      and sibling.day_of_week = new.day_of_week
      and sibling.is_closed
      and sibling.id <> new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'an opening interval cannot coexist with a closed marker';
  end if;

  v_new_start := ((new.day_of_week - 1) * 86400)
    + extract(epoch from new.opens_at);

  v_new_end := case
    when new.closes_at > new.opens_at then
      ((new.day_of_week - 1) * 86400) + extract(epoch from new.closes_at)
    else
      (new.day_of_week * 86400) + extract(epoch from new.closes_at)
  end;

  if exists (
    select 1
    from ordering.opening_hours as sibling
    cross join lateral (
      select
        ((sibling.day_of_week - 1) * 86400)
          + extract(epoch from sibling.opens_at) as interval_start,
        case
          when sibling.closes_at > sibling.opens_at then
            ((sibling.day_of_week - 1) * 86400)
              + extract(epoch from sibling.closes_at)
          else
            (sibling.day_of_week * 86400)
              + extract(epoch from sibling.closes_at)
        end as interval_end
    ) as sibling_bounds
    cross join (
      values (-604800::numeric), (0::numeric), (604800::numeric)
    ) as week_shift(seconds)
    where sibling.location_id = new.location_id
      and not sibling.is_closed
      and sibling.id <> new.id
      and v_new_start < sibling_bounds.interval_end + week_shift.seconds
      and sibling_bounds.interval_start + week_shift.seconds < v_new_end
  ) then
    raise exception using
      errcode = '23P01',
      message = 'opening intervals cannot overlap';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_opening_hours"() to "postgres";

revoke all on function "private"."validate_opening_hours"() from public;
