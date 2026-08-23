create or replace function public.notifications_get_dispatcher_config()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_settings notifications.settings%rowtype;
  v_resend_key text;
  v_dispatcher_secret text;
  v_telegram_bot_token text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select * into v_settings from notifications.settings where id = true;

  select secret.decrypted_secret into v_resend_key
  from vault.decrypted_secrets secret where secret.id = v_settings.resend_api_key_secret_id;

  select secret.decrypted_secret into v_dispatcher_secret
  from vault.decrypted_secrets secret where secret.id = v_settings.dispatcher_auth_secret_id;

  select secret.decrypted_secret into v_telegram_bot_token
  from vault.decrypted_secrets secret where secret.id = v_settings.telegram_bot_token_secret_id;

  return jsonb_build_object(
    'emailProvider', v_settings.email_provider,
    'emailFromAddress', v_settings.email_from_address,
    'emailFromNameFallback', v_settings.email_from_name_fallback,
    'emailReplyTo', v_settings.email_reply_to,
    'notificationsEmailMode', v_settings.notifications_email_mode,
    'notificationsDevRecipient', v_settings.notifications_dev_recipient,
    'notificationsEnvironment', v_settings.notifications_environment,
    'devDefaultStorefrontUrl', v_settings.dev_default_storefront_url,
    'resendApiKey', v_resend_key,
    'dispatcherAuthSecret', v_dispatcher_secret,
    'telegramBotToken', v_telegram_bot_token,
    'notificationsTelegramMode', v_settings.notifications_telegram_mode
  );
end;
$function$;

grant execute on function "public"."notifications_get_dispatcher_config"() to "postgres", "service_role";

revoke all on function "public"."notifications_get_dispatcher_config"() from public;
