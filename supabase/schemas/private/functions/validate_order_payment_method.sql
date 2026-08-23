create or replace function private.validate_order_payment_method()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_cash_enabled boolean;
  v_online_enabled boolean;
begin
  select settings.cash_on_delivery_enabled, settings.online_payments_enabled
  into v_cash_enabled, v_online_enabled
  from ordering.restaurant_settings as settings
  where settings.location_id = new.location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant payment settings are unavailable';
  end if;

  if new.payment_method = 'cash' then
    if not v_cash_enabled then
      raise exception using errcode = '22023', message = 'cash on delivery is unavailable for this outlet';
    end if;
  elsif new.payment_method = 'online' then
    if not v_online_enabled then
      raise exception using errcode = '22023', message = 'online payment is unavailable for this outlet';
    end if;

    if not exists (
      select 1
      from ordering.location_payment_providers as provider
      where provider.location_id = new.location_id
        and provider.is_active
        and provider.configuration_status = 'ready'
    ) then
      raise exception using errcode = '22023', message = 'online payment provider is not configured for this outlet';
    end if;
  else
    raise exception using errcode = '22023', message = 'unsupported payment method';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_order_payment_method"() to "postgres";
