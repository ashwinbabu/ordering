create or replace function private.can_manage_coupon_mapping (
  p_coupon_id   uuid,
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from ordering.coupons as coupon
    join core.business_locations as location
      on location.business_id = coupon.business_id
    where coupon.id = p_coupon_id
      and location.id = p_location_id
      and (select private.can_manage_coupons(coupon.business_id))
  );
$function$;

grant execute on function "private"."can_manage_coupon_mapping"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_coupon_mapping"(uuid, uuid) from public;
