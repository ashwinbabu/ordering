create or replace function ordering.get_location_payment_configuration (
  p_business_id uuid,
  p_location_id uuid
)
  returns jsonb
  language plpgsql
  stable
  set search_path to ''
  AS $function$
declare
  v_settings ordering.restaurant_settings%rowtype;
  v_provider ordering.location_payment_providers%rowtype;
begin
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
    raise exception using errcode = '42501', message = 'payment configuration access denied';
  end if;

  select settings.* into v_settings
  from ordering.restaurant_settings as settings
  where settings.location_id = p_location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = p_location_id
    and provider.is_active
  limit 1;

  return jsonb_build_object(
    'cashOnDeliveryEnabled', v_settings.cash_on_delivery_enabled,
    'onlinePaymentsEnabled', v_settings.online_payments_enabled,
    'defaultPaymentMethod', v_settings.default_payment_method,
    'activeProvider', case when v_provider.id is null then null else jsonb_build_object(
      'id', v_provider.id,
      'provider', v_provider.provider,
      'configurationStatus', v_provider.configuration_status,
      'providerAccountId', v_provider.provider_account_id,
      'publicConfig', v_provider.public_config
    ) end,
    'onlineProviderReady', coalesce(v_provider.configuration_status = 'ready', false)
  );
end;
$function$;

grant execute on function "ordering"."get_location_payment_configuration"(uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_location_payment_configuration"(uuid, uuid) from public;
