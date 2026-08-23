create or replace function public.notifications_get_telegram_webhook_config()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_bot_token text;
  v_webhook_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select secret.decrypted_secret into v_bot_token
  from vault.decrypted_secrets secret
  join notifications.settings s on s.telegram_bot_token_secret_id = secret.id
  where s.id = true;

  select secret.decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets secret
  join notifications.settings s on s.telegram_webhook_secret_id = secret.id
  where s.id = true;

  return jsonb_build_object('botToken', v_bot_token, 'webhookSecret', v_webhook_secret);
end;
$function$;

grant execute on function "public"."notifications_get_telegram_webhook_config"() to "postgres", "service_role";

revoke all on function "public"."notifications_get_telegram_webhook_config"() from public;
