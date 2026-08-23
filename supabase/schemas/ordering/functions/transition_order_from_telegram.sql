create or replace function ordering.transition_order_from_telegram (
  p_order_id         uuid,
  p_expected_status  text,
  p_new_status       text,
  p_telegram_user_id bigint,
  p_cancel_reason    text   default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram transitions require the trusted backend';
  end if;

  return private.transition_order_internal(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason,
    'telegram',
    p_telegram_user_id
  );
end;
$function$;

grant execute on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) to "postgres", "service_role";

comment on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) is 'Service-only Telegram bridge that authorizes a live Telegram sender and records actor_type=telegram.';

revoke all on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) from public;
