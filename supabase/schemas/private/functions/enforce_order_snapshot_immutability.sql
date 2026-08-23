create or replace function private.enforce_order_snapshot_immutability()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.order_number is distinct from old.order_number
     or new.business_id is distinct from old.business_id
     or new.location_id is distinct from old.location_id
     or new.customer_id is distinct from old.customer_id
     or new.customer_business_id is distinct from old.customer_business_id
     or new.acquisition_source_id is distinct from old.acquisition_source_id
     or new.fulfillment_type is distinct from old.fulfillment_type
     or new.payment_method is distinct from old.payment_method
     or new.currency is distinct from old.currency
     or new.food_subtotal is distinct from old.food_subtotal
     or new.discount_total is distinct from old.discount_total
     or new.tax_total is distinct from old.tax_total
     or new.delivery_fee is distinct from old.delivery_fee
     or new.loyalty_redeemed is distinct from old.loyalty_redeemed
     or new.grand_total is distinct from old.grand_total
     or new.customer_name_snapshot is distinct from old.customer_name_snapshot
     or new.customer_phone_snapshot is distinct from old.customer_phone_snapshot
     or new.delivery_address_snapshot is distinct from old.delivery_address_snapshot
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.delivery_zone_id is distinct from old.delivery_zone_id
     or new.delivery_distance_km is distinct from old.delivery_distance_km
     or new.normal_delivery_fee is distinct from old.normal_delivery_fee
     or new.estimated_delivery_cost is distinct from old.estimated_delivery_cost
     or new.aggregator_benchmark_rate_snapshot
        is distinct from old.aggregator_benchmark_rate_snapshot
     or new.skrowia_commission_rate_snapshot
        is distinct from old.skrowia_commission_rate_snapshot
     or new.skrowia_commissionable_amount
        is distinct from old.skrowia_commissionable_amount
     or new.estimated_delivery_minutes
        is distinct from old.estimated_delivery_minutes
     or new.coupon_id is distinct from old.coupon_id
     or new.coupon_code_snapshot is distinct from old.coupon_code_snapshot
     or new.coupon_discount_amount is distinct from old.coupon_discount_amount
     or new.customer_note is distinct from old.customer_note
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'order identity and customer/catalog/financial snapshots are immutable';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_order_snapshot_immutability"() to "postgres";

revoke all on function "private"."enforce_order_snapshot_immutability"() from public;
