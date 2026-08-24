-- Task 1: expose authMode/environment from get_payment_provider_for_order,
-- without ever returning the webhook secret from this RPC.
create or replace function ordering.get_payment_provider_for_order(p_order_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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

-- Task 2: service-role-only webhook-config lookup. Returns the decrypted
-- webhook secret (never the API credentials) for a specific location
-- provider configuration, resolved by its own id (a routing identifier, not
-- an auth token).
create or replace function ordering.get_payment_provider_webhook_config(p_provider_configuration_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_provider ordering.location_payment_providers%rowtype;
  v_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_provider_configuration_id is null then
    raise exception using errcode = '22023', message = 'provider configuration id is required';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.id = p_provider_configuration_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment provider configuration was not found';
  end if;

  if not v_provider.is_active then
    raise exception using errcode = '55000', message = 'payment provider configuration is not active';
  end if;

  select secret.decrypted_secret into v_secret
  from vault.decrypted_secrets as secret
  where secret.id = v_provider.webhook_secret_id;

  if v_secret is null then
    raise exception using errcode = '55000', message = 'webhook secret is unavailable for this provider';
  end if;

  return jsonb_build_object(
    'providerConfigurationId', v_provider.id,
    'locationId', v_provider.location_id,
    'provider', v_provider.provider,
    'environment', v_provider.environment,
    'authMode', v_provider.auth_mode,
    'providerAccountId', v_provider.provider_account_id,
    'webhookSecret', v_secret
  );
end;
$function$;

revoke all on function ordering.get_payment_provider_webhook_config(uuid) from public;
revoke all on function ordering.get_payment_provider_webhook_config(uuid) from anon;
revoke all on function ordering.get_payment_provider_webhook_config(uuid) from authenticated;
grant execute on function ordering.get_payment_provider_webhook_config(uuid) to service_role;
