create or replace function private.enforce_coupon_identity_and_history()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '23514',
      message = 'coupon identity and business are immutable';
  end if;

  if (
    new.code is distinct from old.code
    or new.campaign_id is distinct from old.campaign_id
  ) and (
    exists (
      select 1
      from ordering.carts as cart
      where cart.business_id = old.business_id
        and cart.coupon_id = old.id
    )
    or exists (
      select 1
      from ordering.orders as placed_order
      where placed_order.business_id = old.business_id
        and placed_order.coupon_id = old.id
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'coupon code and campaign are immutable after cart or order use';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_coupon_identity_and_history"() to "postgres";

revoke all on function "private"."enforce_coupon_identity_and_history"() from public;
