create or replace function private.validate_order_financial_snapshot()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_tax_mode text;
  v_tax_rate numeric(7, 4);
  v_currency text;
  v_aggregator_rate numeric(7, 4);
  v_skrowia_rate numeric(7, 4);
  v_net_food numeric(14, 2);
  v_expected_tax numeric(14, 2);
  v_expected_grand_total numeric(14, 2);
  v_expected_commissionable numeric(14, 2);
begin
  select
    settings.tax_mode,
    settings.tax_rate,
    settings.currency,
    settings.aggregator_benchmark_rate,
    settings.skrowia_commission_rate
  into
    v_tax_mode,
    v_tax_rate,
    v_currency,
    v_aggregator_rate,
    v_skrowia_rate
  from ordering.restaurant_settings as settings
  where settings.location_id = new.location_id;

  if not found then
    raise exception using errcode = '23514', message = 'restaurant settings are required';
  end if;

  if v_aggregator_rate is null then
    raise exception using
      errcode = '23514',
      message = 'aggregator benchmark rate must be configured before checkout';
  end if;

  if new.currency <> v_currency
     or new.aggregator_benchmark_rate_snapshot <> v_aggregator_rate
     or new.skrowia_commission_rate_snapshot <> v_skrowia_rate then
    raise exception using
      errcode = '23514',
      message = 'order currency and rate snapshots must match location settings';
  end if;

  v_net_food := round(
    new.food_subtotal - new.discount_total - new.loyalty_redeemed,
    2
  );
  v_expected_commissionable := greatest(v_net_food, 0);

  -- Batch-1 review default: delivery charges are excluded from the taxable
  -- base. Inclusive tax is extracted from discounted food and is not added a
  -- second time. This rule is centralized here and in the quote function.
  v_expected_tax := case
    when v_tax_mode = 'none' then 0
    when v_tax_mode = 'inclusive' then
      round(v_net_food * v_tax_rate / (100 + v_tax_rate), 2)
    else
      round(v_net_food * v_tax_rate / 100, 2)
  end;

  v_expected_grand_total := case
    when v_tax_mode = 'exclusive' then
      round(v_net_food + v_expected_tax + new.delivery_fee, 2)
    else
      round(v_net_food + new.delivery_fee, 2)
  end;

  if new.tax_total <> v_expected_tax
     or new.grand_total <> v_expected_grand_total
     or new.skrowia_commissionable_amount <> v_expected_commissionable then
    raise exception using
      errcode = '23514',
      message = 'order financial snapshot does not match authoritative pricing';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_order_financial_snapshot"() to "postgres";

revoke all on function "private"."validate_order_financial_snapshot"() from public;
