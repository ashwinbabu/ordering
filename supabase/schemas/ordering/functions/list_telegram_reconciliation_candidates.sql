create or replace function ordering.list_telegram_reconciliation_candidates (
  p_limit integer default 50
)
  returns table (
    order_id             uuid,
    business_id          uuid,
    telegram_user_id     bigint,
    telegram_chat_id     bigint,
    telegram_message_id  bigint,
    last_rendered_status text,
    current_status       text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram reconciliation requires the trusted backend';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'Telegram reconciliation limit must be between 1 and 100';
  end if;

  return query
  select order_row.id,
         order_row.business_id,
         staff.telegram_user_id,
         coalesce(message.telegram_chat_id, staff.telegram_user_id),
         message.telegram_message_id,
         message.last_rendered_status,
         order_row.status
  from ordering.orders as order_row
  join ordering.telegram_staff as staff
    on staff.business_id = order_row.business_id
   and staff.is_authorized
  left join ordering.telegram_order_messages as message
    on message.order_id = order_row.id
   and message.telegram_chat_id = staff.telegram_user_id
  where order_row.payment_status in ('paid', 'not_required')
    and order_row.status <> 'payment_pending'
    and (
      message.id is null
      or message.last_rendered_status is distinct from order_row.status
    )
  order by order_row.created_at, order_row.id, staff.id
  limit p_limit;
end;
$function$;

grant execute on function "ordering"."list_telegram_reconciliation_candidates"(integer) to "postgres", "service_role";

revoke all on function "ordering"."list_telegram_reconciliation_candidates"(integer) from public;
