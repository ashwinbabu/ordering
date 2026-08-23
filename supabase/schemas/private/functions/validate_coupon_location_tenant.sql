create or replace function private.validate_coupon_location_tenant()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_coupon_business_id uuid;
  v_location_business_id uuid;
begin
  select coupon.business_id
  into v_coupon_business_id
  from ordering.coupons as coupon
  where coupon.id = new.coupon_id;

  select location.business_id
  into v_location_business_id
  from core.business_locations as location
  where location.id = new.location_id;

  if v_coupon_business_id is null
     or v_location_business_id is null
     or v_coupon_business_id <> v_location_business_id then
    raise exception using
      errcode = '23514',
      message = 'coupon and location must belong to the same business';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_coupon_location_tenant"() to "postgres";

revoke all on function "private"."validate_coupon_location_tenant"() from public;
