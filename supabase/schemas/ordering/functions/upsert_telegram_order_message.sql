create or replace function ordering.upsert_telegram_order_message (
  p_order_id             uuid,
  p_telegram_chat_id     bigint,
  p_telegram_message_id  bigint,
  p_last_rendered_status text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order_status text;
  v_message ordering.telegram_order_messages%rowtype;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram message writes require the trusted backend';
  end if;

  select order_row.status
  into v_order_status
  from ordering.orders as order_row
  where order_row.id = p_order_id;

  if v_order_status is null then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if p_last_rendered_status <> v_order_status then
    raise exception using
      errcode = '40001',
      message = 'rendered status is stale; fetch the current order and retry';
  end if;

  insert into ordering.telegram_order_messages (
    order_id,
    telegram_chat_id,
    telegram_message_id,
    last_rendered_status
  ) values (
    p_order_id,
    p_telegram_chat_id,
    p_telegram_message_id,
    p_last_rendered_status
  )
  on conflict (order_id, telegram_chat_id) do update
  set telegram_message_id = excluded.telegram_message_id,
      last_rendered_status = excluded.last_rendered_status
  returning * into v_message;

  return jsonb_build_object(
    'id', v_message.id,
    'order_id', v_message.order_id,
    'telegram_chat_id', v_message.telegram_chat_id,
    'telegram_message_id', v_message.telegram_message_id,
    'last_rendered_status', v_message.last_rendered_status,
    'updated_at', v_message.updated_at
  );
end;
$function$;

grant execute on function "ordering"."upsert_telegram_order_message"(uuid, bigint, bigint, text) to "postgres", "service_role";

revoke all on function "ordering"."upsert_telegram_order_message"(uuid, bigint, bigint, text) from public;
