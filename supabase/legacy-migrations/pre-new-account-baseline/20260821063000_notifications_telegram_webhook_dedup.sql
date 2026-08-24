-- Telegram redelivers webhook updates it never got a fast 2xx for. The
-- pairing-token consumption RPC is already safe against that (single-use,
-- atomic), but a naive webhook would still send a second, misleading
-- "invalid code" reply for what was actually a duplicate delivery of an
-- already-succeeded pairing. This tiny table lets the webhook recognize
-- "I've already fully handled this update_id" before doing anything else.

create table notifications.telegram_webhook_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

alter table notifications.telegram_webhook_updates enable row level security;
revoke all on notifications.telegram_webhook_updates from public;
revoke all on notifications.telegram_webhook_updates from anon;
revoke all on notifications.telegram_webhook_updates from authenticated;

create or replace function public.notifications_claim_telegram_webhook_update(p_update_id bigint)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  insert into notifications.telegram_webhook_updates (update_id)
  values (p_update_id)
  on conflict (update_id) do nothing;

  return found;
end;
$function$;

revoke all on function public.notifications_claim_telegram_webhook_update(bigint) from public;
revoke all on function public.notifications_claim_telegram_webhook_update(bigint) from anon;
revoke all on function public.notifications_claim_telegram_webhook_update(bigint) from authenticated;
grant execute on function public.notifications_claim_telegram_webhook_update(bigint) to service_role;
