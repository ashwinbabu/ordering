-- Telegram as a second notification channel, extending the existing
-- notifications.events / notifications.deliveries outbox rather than adding
-- a parallel queue. One platform-level Telegram bot; per-business/location
-- destinations are data, not code. See the project's Telegram architecture
-- notes for the full design rationale.

-- ---------------------------------------------------------------------------
-- 1. Widen the existing deliveries CHECK constraints to admit the new
--    channel/recipient-type values. Email behaviour is untouched: these are
--    pure additions to the allowed sets.
-- ---------------------------------------------------------------------------

alter table notifications.deliveries drop constraint deliveries_channel_check;
alter table notifications.deliveries add constraint deliveries_channel_check
  check (channel in ('email', 'telegram'));

alter table notifications.deliveries drop constraint deliveries_recipient_type_check;
alter table notifications.deliveries add constraint deliveries_recipient_type_check
  check (recipient_type in ('customer', 'business_user', 'location_admins', 'email', 'staff_group'));

-- ---------------------------------------------------------------------------
-- 2. notifications.telegram_destinations -- durable chat_id mappings.
--    Tenant isolation is structural: every row is scoped to a business (and,
--    for staff groups, a location), and every resolver query below filters by
--    those columns taken from the trusted event row -- never from anything a
--    client sends.
-- ---------------------------------------------------------------------------

create table notifications.telegram_destinations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references core.businesses(id),
  location_id uuid references core.business_locations(id),
  destination_type text not null check (destination_type in ('staff_group', 'business_user')),
  business_user_id uuid references core.business_users(id),
  telegram_chat_id text not null,
  telegram_user_id text,
  telegram_chat_type text not null check (telegram_chat_type in ('private', 'group', 'supergroup')),
  telegram_chat_title text,
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint telegram_destinations_shape_check check (
    (destination_type = 'staff_group'
      and location_id is not null
      and business_user_id is null
      and telegram_chat_type in ('group', 'supergroup'))
    or
    (destination_type = 'business_user'
      and business_user_id is not null
      and telegram_chat_type = 'private')
  )
);

-- One active staff group per location, one active private chat per business
-- user -- enforced by the database, not just application code.
create unique index telegram_destinations_active_staff_group_idx
  on notifications.telegram_destinations (business_id, location_id)
  where destination_type = 'staff_group' and is_active;

create unique index telegram_destinations_active_business_user_idx
  on notifications.telegram_destinations (business_user_id)
  where destination_type = 'business_user' and is_active;

create index telegram_destinations_business_id_idx on notifications.telegram_destinations (business_id);

alter table notifications.telegram_destinations enable row level security;
revoke all on notifications.telegram_destinations from public;
revoke all on notifications.telegram_destinations from anon;
revoke all on notifications.telegram_destinations from authenticated;

create trigger telegram_destinations_set_updated_at
  before update on notifications.telegram_destinations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. notifications.telegram_pairing_tokens -- short-lived, single-use,
--    hashed. The raw token is returned once by
--    notifications_create_telegram_pairing_token and never stored.
-- ---------------------------------------------------------------------------

create table notifications.telegram_pairing_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  business_id uuid not null references core.businesses(id),
  location_id uuid references core.business_locations(id),
  destination_type text not null check (destination_type in ('staff_group', 'business_user')),
  business_user_id uuid references core.business_users(id),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint telegram_pairing_tokens_shape_check check (
    (destination_type = 'staff_group' and location_id is not null and business_user_id is null)
    or
    (destination_type = 'business_user' and business_user_id is not null)
  )
);

create index telegram_pairing_tokens_lookup_idx
  on notifications.telegram_pairing_tokens (token_hash) where consumed_at is null;

alter table notifications.telegram_pairing_tokens enable row level security;
revoke all on notifications.telegram_pairing_tokens from public;
revoke all on notifications.telegram_pairing_tokens from anon;
revoke all on notifications.telegram_pairing_tokens from authenticated;

-- ---------------------------------------------------------------------------
-- 4. notifications.settings -- Telegram config alongside the existing email
--    config. Same convention: plain fields + vault secret references, no
--    Edge Function env vars.
-- ---------------------------------------------------------------------------

alter table notifications.settings
  add column telegram_bot_token_secret_id uuid references vault.secrets(id),
  add column telegram_webhook_secret_id uuid references vault.secrets(id),
  add column telegram_bot_username text,
  add column notifications_telegram_mode text not null default 'log'
    check (notifications_telegram_mode in ('off', 'log', 'live'));

-- ---------------------------------------------------------------------------
-- 5. Pairing token creation -- called by a signed-in admin from the browser.
--    This is NOT service-role-only like the dispatcher RPCs: it uses the
--    project's existing "can this auth.uid() manage this business" guard.
--    For destination_type = 'business_user' the caller's own membership row
--    is resolved server-side -- there is no parameter for an arbitrary
--    business_user_id, so this RPC can never be used to mint a pairing link
--    for someone else.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_create_telegram_pairing_token(
  p_destination_type text,
  p_business_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_business_user_id uuid;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to manage this business';
  end if;

  if p_destination_type = 'staff_group' then
    if p_location_id is null then
      raise exception using errcode = '22023', message = 'location_id is required for a staff_group pairing token';
    end if;
    if not exists (
      select 1 from core.business_locations l
      where l.id = p_location_id and l.business_id = p_business_id
    ) then
      raise exception using errcode = 'P0002', message = 'location does not belong to this business';
    end if;
  elsif p_destination_type = 'business_user' then
    select bu.id into v_business_user_id
    from core.business_users bu
    join core.users u on u.id = bu.user_id
    where bu.business_id = p_business_id
      and bu.is_active
      and u.auth_user_id = (select auth.uid())
    limit 1;
    if v_business_user_id is null then
      raise exception using errcode = '42501', message = 'caller is not an active member of this business';
    end if;
    p_location_id := null;
  else
    raise exception using errcode = '22023', message = 'invalid destination_type';
  end if;

  v_token := encode(extensions.gen_random_bytes(20), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into notifications.telegram_pairing_tokens (
    token_hash, business_id, location_id, destination_type, business_user_id, expires_at, created_by
  ) values (
    v_token_hash, p_business_id, p_location_id, p_destination_type, v_business_user_id, v_expires_at, (select auth.uid())
  );

  return jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires_at,
    'destinationType', p_destination_type,
    'businessId', p_business_id,
    'locationId', p_location_id
  );
end;
$function$;

revoke all on function public.notifications_create_telegram_pairing_token(text, uuid, uuid) from public;
revoke all on function public.notifications_create_telegram_pairing_token(text, uuid, uuid) from anon;
grant execute on function public.notifications_create_telegram_pairing_token(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Connection status -- minimal read for the admin UI. Same auth guard.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_get_telegram_connection_status(
  p_business_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_staff_group notifications.telegram_destinations%rowtype;
  v_my_business_user_id uuid;
  v_my_connection notifications.telegram_destinations%rowtype;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to view this business';
  end if;

  if p_location_id is not null then
    select * into v_staff_group
    from notifications.telegram_destinations d
    where d.business_id = p_business_id
      and d.location_id = p_location_id
      and d.destination_type = 'staff_group'
      and d.is_active
    limit 1;
  end if;

  select bu.id into v_my_business_user_id
  from core.business_users bu
  join core.users u on u.id = bu.user_id
  where bu.business_id = p_business_id
    and bu.is_active
    and u.auth_user_id = (select auth.uid())
  limit 1;

  if v_my_business_user_id is not null then
    select * into v_my_connection
    from notifications.telegram_destinations d
    where d.business_user_id = v_my_business_user_id
      and d.destination_type = 'business_user'
      and d.is_active
    limit 1;
  end if;

  return jsonb_build_object(
    'staffGroup', case when v_staff_group.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'chatTitle', v_staff_group.telegram_chat_title, 'connectedAt', v_staff_group.connected_at) end,
    'myConnection', case when v_my_connection.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'connectedAt', v_my_connection.connected_at) end
  );
end;
$function$;

revoke all on function public.notifications_get_telegram_connection_status(uuid, uuid) from public;
revoke all on function public.notifications_get_telegram_connection_status(uuid, uuid) from anon;
grant execute on function public.notifications_get_telegram_connection_status(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Pairing consumption -- called only by the telegram-webhook Edge
--    Function (service-role). Atomic single-use consumption: the UPDATE's
--    WHERE clause is the only check-and-set, so a replayed Telegram update
--    racing itself cannot consume the same token twice. A token used in the
--    wrong chat context is still burned (matches "do not silently reinterpret
--    the token" -- the admin must issue a new one), and the destination
--    upsert deactivates any previous active row for the same target before
--    inserting, so re-pairing never leaves two active rows.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_consume_telegram_pairing(
  p_token_hash text,
  p_telegram_chat_id text,
  p_telegram_chat_type text,
  p_telegram_chat_title text default null,
  p_telegram_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token notifications.telegram_pairing_tokens%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  update notifications.telegram_pairing_tokens
  set consumed_at = now()
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  returning * into v_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired_or_used');
  end if;

  if v_token.destination_type = 'staff_group' and p_telegram_chat_type not in ('group', 'supergroup') then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'staff_group');
  end if;
  if v_token.destination_type = 'business_user' and p_telegram_chat_type <> 'private' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'business_user');
  end if;

  if v_token.destination_type = 'staff_group' then
    update notifications.telegram_destinations
    set is_active = false
    where business_id = v_token.business_id
      and location_id = v_token.location_id
      and destination_type = 'staff_group'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, telegram_chat_id, telegram_chat_type, telegram_chat_title
    ) values (
      v_token.business_id, v_token.location_id, 'staff_group', p_telegram_chat_id, p_telegram_chat_type, p_telegram_chat_title
    );
  else
    update notifications.telegram_destinations
    set is_active = false
    where business_user_id = v_token.business_user_id
      and destination_type = 'business_user'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, business_user_id, telegram_chat_id, telegram_user_id, telegram_chat_type
    ) values (
      v_token.business_id, null, 'business_user', v_token.business_user_id, p_telegram_chat_id, p_telegram_user_id, p_telegram_chat_type
    );
  end if;

  select b.* into v_business from core.businesses b where b.id = v_token.business_id;
  if v_token.location_id is not null then
    select l.* into v_location from core.business_locations l where l.id = v_token.location_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'destinationType', v_token.destination_type,
    'businessName', v_business.name,
    'locationName', v_location.name
  );
end;
$function$;

revoke all on function public.notifications_consume_telegram_pairing(text, text, text, text, text) from public;
revoke all on function public.notifications_consume_telegram_pairing(text, text, text, text, text) from anon;
revoke all on function public.notifications_consume_telegram_pairing(text, text, text, text, text) from authenticated;
grant execute on function public.notifications_consume_telegram_pairing(text, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Webhook config -- service-role only, separate from the dispatcher's own
--    config RPC so the dispatcher never has reason to see the webhook secret.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_get_telegram_webhook_config()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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

revoke all on function public.notifications_get_telegram_webhook_config() from public;
revoke all on function public.notifications_get_telegram_webhook_config() from anon;
revoke all on function public.notifications_get_telegram_webhook_config() from authenticated;
grant execute on function public.notifications_get_telegram_webhook_config() to service_role;

-- ---------------------------------------------------------------------------
-- 9. Extend the dispatcher config RPC with Telegram fields.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_get_dispatcher_config()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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

-- (grants unchanged -- this function already existed and was already
-- service_role-only; create or replace keeps its prior grants.)

-- ---------------------------------------------------------------------------
-- 11. Extend notifications_record_delivery_result with a 'skipped' outcome,
--     for channels (Telegram in 'off' mode) that fully decided not to send
--     rather than failed to send. Dropped and recreated (not just replaced)
--     because adding a parameter changes the function's argument-type
--     identity -- replacing in place would leave two overloads behind.
-- ---------------------------------------------------------------------------

drop function if exists public.notifications_record_delivery_result(uuid, text, text, text, text, int);

create or replace function public.notifications_record_delivery_result(
  p_delivery_id uuid,
  p_outcome text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_max_attempts int default 5,
  p_skip_reason text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_attempt_count int;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_outcome not in ('sent', 'retry', 'permanent_failure', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid delivery outcome';
  end if;

  select attempt_count into v_attempt_count
  from notifications.deliveries where id = p_delivery_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'delivery not found';
  end if;

  if p_outcome = 'sent' then
    update notifications.deliveries
    set status = 'sent',
        sent_at = now(),
        provider = p_provider,
        provider_message_id = p_provider_message_id,
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'skipped' then
    update notifications.deliveries
    set status = 'skipped',
        skip_reason = coalesce(p_skip_reason, 'channel_disabled'),
        provider = coalesce(p_provider, provider),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'permanent_failure' then
    update notifications.deliveries
    set status = 'dead',
        last_error = left(p_error, 2000),
        provider = coalesce(p_provider, provider),
        updated_at = now()
    where id = p_delivery_id;
  else
    if v_attempt_count >= p_max_attempts then
      update notifications.deliveries
      set status = 'dead',
          last_error = left(p_error, 2000),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    else
      update notifications.deliveries
      set status = 'failed',
          last_error = left(p_error, 2000),
          next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    end if;
  end if;
end;
$function$;

revoke all on function public.notifications_record_delivery_result(uuid, text, text, text, text, int, text) from public;
revoke all on function public.notifications_record_delivery_result(uuid, text, text, text, text, int, text) from anon;
revoke all on function public.notifications_record_delivery_result(uuid, text, text, text, text, int, text) from authenticated;
grant execute on function public.notifications_record_delivery_result(uuid, text, text, text, text, int, text) to service_role;

-- ---------------------------------------------------------------------------
-- 10. Extend the order-context planning RPC with the resolved Telegram
--     staff-group destination for this order's business/location. This is
--     the "fetch the planning context once per event" extension point:
--     recipient resolution stays pure (no DB I/O of its own) by reading this
--     key instead of querying telegram_destinations itself.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_get_order_context(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_order ordering.orders%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
  v_customer core.customers%rowtype;
  v_items jsonb;
  v_payment jsonb;
  v_refund_total numeric;
  v_refund_status text;
  v_staff_group notifications.telegram_destinations%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select o.* into v_order from ordering.orders o where o.id = p_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'order not found';
  end if;

  select b.* into v_business from core.businesses b where b.id = v_order.business_id;
  select l.* into v_location from core.business_locations l where l.id = v_order.location_id;

  if v_order.customer_id is not null then
    select c.* into v_customer from core.customers c where c.id = v_order.customer_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', oi.product_name,
    'quantity', oi.quantity,
    'baseUnitPrice', oi.base_unit_price::text,
    'modifierUnitTotal', oi.modifier_unit_total::text,
    'finalUnitPrice', oi.final_unit_price::text,
    'lineTotal', oi.line_total::text,
    'customerNote', oi.customer_note,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'optionGroupName', oio.option_group_name,
        'optionName', oio.option_name,
        'priceDelta', oio.price_delta::text,
        'quantity', oio.quantity
      ) order by oio.option_group_name, oio.option_name), '[]'::jsonb)
      from ordering.order_item_options oio
      where oio.order_item_id = oi.id
    )
  ) order by oi.created_at), '[]'::jsonb)
  into v_items
  from ordering.order_items oi
  where oi.order_id = v_order.id;

  select jsonb_build_object(
    'status', p.status,
    'method', p.method,
    'amount', p.amount::text,
    'paidAt', p.paid_at
  )
  into v_payment
  from ordering.payments p
  where p.order_id = v_order.id
  order by p.created_at desc
  limit 1;

  select coalesce(sum(r.amount) filter (where r.status = 'completed'), 0)
  into v_refund_total
  from ordering.refunds r
  where r.order_id = v_order.id;

  select r.status into v_refund_status
  from ordering.refunds r
  where r.order_id = v_order.id
  order by r.created_at desc
  limit 1;

  select * into v_staff_group
  from notifications.telegram_destinations d
  where d.business_id = v_order.business_id
    and d.location_id = v_order.location_id
    and d.destination_type = 'staff_group'
    and d.is_active
  limit 1;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'businessId', v_order.business_id,
      'locationId', v_order.location_id,
      'customerId', v_order.customer_id,
      'fulfillmentType', v_order.fulfillment_type,
      'status', v_order.status,
      'paymentStatus', v_order.payment_status,
      'paymentMethod', v_order.payment_method,
      'currency', v_order.currency,
      'foodSubtotal', v_order.food_subtotal::text,
      'discountTotal', v_order.discount_total::text,
      'taxTotal', v_order.tax_total::text,
      'deliveryFee', v_order.delivery_fee::text,
      'grandTotal', v_order.grand_total::text,
      'customerNameSnapshot', v_order.customer_name_snapshot,
      'customerPhoneSnapshot', v_order.customer_phone_snapshot,
      'deliveryAddressSnapshot', v_order.delivery_address_snapshot,
      'customerNote', v_order.customer_note,
      'placedAt', v_order.placed_at,
      'acceptedAt', v_order.accepted_at,
      'outForDeliveryAt', v_order.out_for_delivery_at,
      'deliveredAt', v_order.delivered_at,
      'cancelledAt', v_order.cancelled_at,
      'cancelReason', v_order.cancel_reason,
      'estimatedDeliveryMinutes', v_order.estimated_delivery_minutes,
      'couponCodeSnapshot', v_order.coupon_code_snapshot,
      'couponDiscountAmount', v_order.coupon_discount_amount::text
    ),
    'items', v_items,
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'logoUrl', v_business.logo_url,
      'timezone', v_business.timezone,
      'currency', v_business.currency
    ),
    'location', jsonb_build_object(
      'id', v_location.id,
      'name', v_location.name,
      'phone', v_location.phone,
      'addressLine', nullif(trim(both ', ' from
        coalesce(v_location.address_line_1, '') ||
        case when v_location.address_line_2 is not null and v_location.address_line_2 <> ''
          then ', ' || v_location.address_line_2 else '' end ||
        ', ' || coalesce(v_location.city, '')
      ), ''),
      'storefrontDomain', v_location.storefront_domain
    ),
    'customer', case when v_customer.id is null then null else jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'displayName', v_customer.display_name
    ) end,
    'payment', v_payment,
    'refundFacts', jsonb_build_object(
      'paymentTaken', (v_payment is not null and (v_payment->>'status') = 'paid'),
      'refundedAmount', v_refund_total::text,
      'latestRefundStatus', v_refund_status
    ),
    'telegram', jsonb_build_object(
      'staffGroup', case when v_staff_group.id is null then null else jsonb_build_object(
        'chatId', v_staff_group.telegram_chat_id,
        'chatTitle', v_staff_group.telegram_chat_title
      ) end
    )
  );
end;
$function$;
