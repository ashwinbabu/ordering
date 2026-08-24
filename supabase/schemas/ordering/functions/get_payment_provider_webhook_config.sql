create or replace function ordering.get_payment_provider_webhook_config (
  p_provider_configuration_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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

grant execute on function "ordering"."get_payment_provider_webhook_config"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."get_payment_provider_webhook_config"(uuid) from public;
