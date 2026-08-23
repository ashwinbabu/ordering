create or replace function ordering.save_location_payment_methods (
  p_business_id              uuid,
  p_location_id              uuid,
  p_cash_on_delivery_enabled boolean,
  p_online_payments_enabled  boolean
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_current_default text;
  v_default text;
begin
  select settings.default_payment_method
  into v_current_default
  from ordering.restaurant_settings as settings
  where settings.location_id = p_location_id;

  if v_current_default is not null
     and ((v_current_default = 'cash' and p_cash_on_delivery_enabled)
       or (v_current_default = 'online' and p_online_payments_enabled)) then
    v_default := v_current_default;
  elsif p_cash_on_delivery_enabled then
    v_default := 'cash';
  else
    v_default := 'online';
  end if;

  return ordering.save_location_payment_methods(
    p_business_id,
    p_location_id,
    p_cash_on_delivery_enabled,
    p_online_payments_enabled,
    v_default
  );
end;
$function$;

create or replace function ordering.save_location_payment_methods (
  p_business_id              uuid,
  p_location_id              uuid,
  p_cash_on_delivery_enabled boolean,
  p_online_payments_enabled  boolean,
  p_default_payment_method   text
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_default text := lower(btrim(coalesce(p_default_payment_method, '')));
begin
  if p_cash_on_delivery_enabled is null or p_online_payments_enabled is null then
    raise exception using errcode = '22023', message = 'payment method settings are required';
  end if;

  if not p_cash_on_delivery_enabled and not p_online_payments_enabled then
    raise exception using errcode = '22023', message = 'at least one payment method must remain enabled';
  end if;

  if v_default not in ('cash','online') then
    raise exception using errcode = '22023', message = 'default payment method is invalid';
  end if;

  if (v_default = 'cash' and not p_cash_on_delivery_enabled)
     or (v_default = 'online' and not p_online_payments_enabled) then
    raise exception using errcode = '22023', message = 'default payment method must be enabled';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception using errcode = '22023', message = 'selected outlet is unavailable';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception using errcode = '42501', message = 'payment configuration update denied';
  end if;

  if p_online_payments_enabled and not exists (
    select 1
    from ordering.location_payment_providers as provider
    where provider.location_id = p_location_id
      and provider.is_active
      and provider.configuration_status = 'ready'
  ) then
    raise exception using errcode = '22023', message = 'online payments require a ready payment provider for this outlet';
  end if;

  update ordering.restaurant_settings
  set cash_on_delivery_enabled = p_cash_on_delivery_enabled,
      online_payments_enabled = p_online_payments_enabled,
      default_payment_method = v_default
  where location_id = p_location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  return ordering.get_location_payment_configuration(p_business_id, p_location_id);
end;
$function$;

grant execute on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean) to "authenticated", "postgres", "service_role";

grant execute on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean) from public;

revoke all on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean, text) from public;
