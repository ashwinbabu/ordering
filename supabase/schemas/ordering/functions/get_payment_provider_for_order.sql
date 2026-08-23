create or replace function ordering.get_payment_provider_for_order (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_provider ordering.location_payment_providers%rowtype;
  v_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_method <> 'online' or v_order.status <> 'payment_pending' then
    raise exception using errcode = '55000', message = 'order is not awaiting online payment';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = v_order.location_id
    and provider.is_active
    and provider.configuration_status = 'ready'
  limit 1;

  if v_provider.id is null then
    raise exception using errcode = '55000', message = 'no ready online payment provider is configured for this outlet';
  end if;

  select secret.decrypted_secret into v_secret
  from vault.decrypted_secrets as secret
  where secret.id = v_provider.credentials_secret_id;

  if v_secret is null then
    raise exception using errcode = '55000', message = 'payment provider credentials are unavailable';
  end if;

  return jsonb_build_object(
    'orderId', v_order.id,
    'locationId', v_order.location_id,
    'provider', v_provider.provider,
    'authMode', v_provider.auth_mode,
    'environment', v_provider.environment,
    'providerAccountId', v_provider.provider_account_id,
    'publicConfig', v_provider.public_config,
    'credentialsSecret', v_secret
  );
end;
$function$;

grant execute on function "ordering"."get_payment_provider_for_order"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."get_payment_provider_for_order"(uuid) from public;
