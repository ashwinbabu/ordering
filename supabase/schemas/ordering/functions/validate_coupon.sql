create or replace function ordering.validate_coupon (
  p_business_id            uuid,
  p_location_id            uuid,
  p_code                   text,
  p_eligible_food_subtotal numeric,
  p_at                     timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_coupon_id uuid;
  v_code text;
  v_discount_type text;
  v_discount_value numeric(14, 4);
  v_max_discount_amount numeric(14, 2);
  v_discount_amount numeric(14, 2);
begin
  if p_business_id is null
     or p_location_id is null
     or p_code is null
     or btrim(p_code) = ''
     or p_eligible_food_subtotal is null
     or p_eligible_food_subtotal < 0 then
    return jsonb_build_object('valid', false, 'reason', 'invalid_request');
  end if;

  select
    coupon.id,
    coupon.code,
    coupon.discount_type,
    coupon.discount_value,
    coupon.max_discount_amount
  into
    v_coupon_id,
    v_code,
    v_discount_type,
    v_discount_value,
    v_max_discount_amount
  from ordering.coupons as coupon
  join core.business_locations as location
    on location.business_id = coupon.business_id
   and location.id = p_location_id
   and location.is_active
  join core.businesses as business
    on business.id = coupon.business_id
   and business.status = 'active'
  where coupon.business_id = p_business_id
    and coupon.code = upper(btrim(p_code))
    and coupon.is_active
    and (coupon.starts_at is null or coupon.starts_at <= p_at)
    and (coupon.ends_at is null or p_at < coupon.ends_at)
    and p_eligible_food_subtotal >= coupon.minimum_order_value
    and (
      not exists (
        select 1
        from ordering.coupon_locations as any_mapping
        where any_mapping.coupon_id = coupon.id
      )
      or exists (
        select 1
        from ordering.coupon_locations as allowed_location
        where allowed_location.coupon_id = coupon.id
          and allowed_location.location_id = p_location_id
      )
    )
  limit 1;

  if v_coupon_id is null then
    return jsonb_build_object('valid', false, 'reason', 'unavailable');
  end if;

  v_discount_amount := case
    when v_discount_type = 'fixed' then
      round(least(v_discount_value, p_eligible_food_subtotal), 2)
    else
      round(
        least(
          p_eligible_food_subtotal,
          p_eligible_food_subtotal * v_discount_value / 100,
          coalesce(v_max_discount_amount, p_eligible_food_subtotal)
        ),
        2
      )
  end;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon_id,
    'code', v_code,
    'discount_amount', v_discount_amount
  );
end;
$function$;

grant execute on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) to "anon", "authenticated", "postgres", "service_role";

comment on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) is 'Validates one business/location coupon and returns only checkout-safe facts.';

revoke all on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) from public;
