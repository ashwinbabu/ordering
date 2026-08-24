-- Transactional notification system (v1): schema, capture trigger, and the
-- claim/plan/send RPCs used by the notification-dispatcher Edge Function.
--
-- Flow: ordering.order_events (authoritative domain log, immutable)
--         -> notifications.events (AFTER INSERT capture trigger, no network I/O)
--         -> notification policy (TypeScript, supabase/functions/_shared/notifications)
--         -> notifications.deliveries (one row per recipient/channel)
--         -> email channel -> Resend
--
-- notifications.* is server-only: RLS is enabled with zero policies and all
-- grants to public/anon/authenticated are revoked. The only way in is through
-- the SECURITY DEFINER RPCs below (declared in public. so they are reachable
-- through Supabase's Data API -- the "notifications" schema itself is not on
-- the project's exposed-schema list and adding a schema there requires
-- Dashboard access this migration doesn't have).

create schema if not exists notifications;

revoke all on schema notifications from public;

-- ---------------------------------------------------------------------------
-- notifications.events -- "what happened"
-- ---------------------------------------------------------------------------

create table notifications.events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('order.placed', 'order.cancelled')),
  entity_type text not null check (entity_type in ('order')),
  entity_id uuid not null,

  business_id uuid not null,
  location_id uuid,

  source_event_id uuid,
  dedupe_key text not null,

  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'pending'
    check (status in ('pending', 'planning', 'planned', 'failed', 'dead')),
  attempt_count int not null default 0,

  planning_started_at timestamptz,
  planning_lease_expires_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  planned_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_events_dedupe_key_key unique (dedupe_key),
  constraint notifications_events_source_event_id_key unique (source_event_id)
);

comment on table notifications.events is
  'Durable outbox of domain notification events captured from ordering.order_events. '
  'Idempotent on dedupe_key (e.g. order:{orderId}:placed). Server-only.';

create index notifications_events_claim_idx on notifications.events (status, next_attempt_at);
create index notifications_events_entity_idx on notifications.events (entity_type, entity_id);
create index notifications_events_business_idx on notifications.events (business_id);

alter table notifications.events enable row level security;
revoke all on notifications.events from public, anon, authenticated;

create trigger notifications_events_set_updated_at
before update on notifications.events
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications.deliveries -- "who we attempted to contact, over which channel"
-- ---------------------------------------------------------------------------

create table notifications.deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references notifications.events(id),

  business_id uuid not null,
  location_id uuid,

  channel text not null check (channel in ('email')),
  template_key text not null,

  recipient_type text not null
    check (recipient_type in ('customer', 'business_user', 'location_admins', 'email')),
  recipient_id uuid,
  recipient_address text,

  locale text not null default 'en-IN',
  payload jsonb not null default '{}'::jsonb,

  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'dead')),
  skip_reason text,

  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  sending_started_at timestamptz,
  sending_lease_expires_at timestamptz,
  last_error text,

  provider text,
  provider_message_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,

  dedupe_key text generated always as (
    event_id::text || ':' || channel || ':' || recipient_type || ':' ||
    coalesce(recipient_id::text, '-') || ':' || coalesce(lower(recipient_address), '-')
  ) stored,

  constraint notifications_deliveries_dedupe_key_key unique (dedupe_key),
  constraint notifications_deliveries_address_required_check check (
    status = 'skipped' or recipient_address is not null
  ),
  constraint notifications_deliveries_skip_reason_check check (
    (status = 'skipped') = (skip_reason is not null)
  )
);

comment on table notifications.deliveries is
  'Per-recipient, per-channel delivery attempts fanned out from notifications.events. '
  'recipient_address is nullable only when status=skipped (e.g. no usable email). Server-only.';

create index notifications_deliveries_event_idx on notifications.deliveries (event_id);
create index notifications_deliveries_claim_idx on notifications.deliveries (status, next_attempt_at);
create index notifications_deliveries_business_idx on notifications.deliveries (business_id);

alter table notifications.deliveries enable row level security;
revoke all on notifications.deliveries from public, anon, authenticated;

create trigger notifications_deliveries_set_updated_at
before update on notifications.deliveries
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications.settings -- singleton server-side configuration
-- ---------------------------------------------------------------------------

create table notifications.settings (
  id boolean primary key default true,

  email_provider text not null default 'resend',
  email_from_address text not null default 'onboarding@resend.dev',
  email_from_name_fallback text not null default 'A2 Food and Beverages',
  email_reply_to text,

  notifications_email_mode text not null default 'redirect'
    check (notifications_email_mode in ('off', 'log', 'redirect', 'live')),
  notifications_dev_recipient text,
  notifications_environment text not null default 'development'
    check (notifications_environment in ('development', 'production')),
  dev_default_storefront_url text default 'https://ordering-storefront-dev.vercel.app',

  resend_api_key_secret_id uuid references vault.secrets(id),
  dispatcher_auth_secret_id uuid references vault.secrets(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint notifications_settings_singleton_check check (id)
);

comment on table notifications.settings is
  'Singleton server-side notification configuration. Secret material is referenced via '
  'vault.secrets (resend_api_key_secret_id, dispatcher_auth_secret_id) and never stored '
  'in plaintext on this row.';

insert into notifications.settings (id) values (true);

alter table notifications.settings enable row level security;
revoke all on notifications.settings from public, anon, authenticated;

create trigger notifications_settings_set_updated_at
before update on notifications.settings
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Capture trigger: ordering.order_events -> notifications.events
-- ---------------------------------------------------------------------------
-- AFTER INSERT only, on the immutable event log (never on ordering.orders).
-- No network calls. Relies on dedupe_key for idempotency. Keeps the payload
-- limited to identifiers/status transitions -- no recipient addresses, no
-- rendered content.

create or replace function private.capture_notification_event_from_order_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_notification_event_type text;
  v_dedupe_key text;
  v_order ordering.orders%rowtype;
begin
  if new.event_type = 'order_placed'
     or (new.event_type = 'order_created' and new.to_status = 'placed') then
    v_notification_event_type := 'order.placed';
    v_dedupe_key := 'order:' || new.order_id::text || ':placed';
  elsif new.event_type = 'order_cancelled' then
    v_notification_event_type := 'order.cancelled';
    v_dedupe_key := 'order:' || new.order_id::text || ':cancelled';
  else
    return new;
  end if;

  select o.* into v_order from ordering.orders o where o.id = new.order_id;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'order not found while capturing notification event';
  end if;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id,
    source_event_id, dedupe_key, occurred_at, payload
  ) values (
    v_notification_event_type, 'order', new.order_id, new.business_id, v_order.location_id,
    new.id, v_dedupe_key, new.created_at,
    jsonb_build_object(
      'schemaVersion', 1,
      'orderId', new.order_id,
      'customerId', v_order.customer_id,
      'actorType', new.actor_type,
      'fromStatus', new.from_status,
      'toStatus', new.to_status
    )
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;

create trigger order_events_capture_notification
after insert on ordering.order_events
for each row execute function private.capture_notification_event_from_order_event();

-- ---------------------------------------------------------------------------
-- Retry backoff schedule shared by event planning and delivery sending.
-- ---------------------------------------------------------------------------

create or replace function notifications.retry_backoff(p_attempt_count int)
returns interval
language sql
immutable
set search_path to ''
as $function$
  select (array[
    interval '1 minute',
    interval '5 minutes',
    interval '15 minutes',
    interval '1 hour',
    interval '6 hours'
  ])[least(greatest(p_attempt_count, 1), 5)];
$function$;

-- ---------------------------------------------------------------------------
-- Event claim / planning lifecycle (public. so the Data API can reach it;
-- guarded by private.request_is_service_role() same as every other
-- privileged RPC in this project).
-- ---------------------------------------------------------------------------

create or replace function public.notifications_claim_events(
  p_limit int default 20,
  p_lease_seconds int default 120
)
returns setof notifications.events
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.events e
  set status = 'planning',
      planning_started_at = now(),
      planning_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = e.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.events
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'planning' and planning_lease_expires_at < now())
    order by occurred_at
    limit p_limit
    for update skip locked
  ) as claimed
  where e.id = claimed.id
  returning e.*;
end;
$function$;

create or replace function public.notifications_plan_event(
  p_event_id uuid,
  p_deliveries jsonb
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_event notifications.events%rowtype;
  v_item jsonb;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select e.* into v_event from notifications.events e where e.id = p_event_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_event.status <> 'planning' then
    raise exception using errcode = '55000',
      message = format('event %s is not in planning status (found %s)', p_event_id, v_event.status);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
  loop
    insert into notifications.deliveries (
      event_id, business_id, location_id, channel, template_key,
      recipient_type, recipient_id, recipient_address, locale, payload,
      status, skip_reason
    ) values (
      p_event_id,
      v_event.business_id,
      v_event.location_id,
      v_item->>'channel',
      v_item->>'templateKey',
      v_item->>'recipientType',
      nullif(v_item->>'recipientId', '')::uuid,
      nullif(v_item->>'recipientAddress', ''),
      coalesce(v_item->>'locale', 'en-IN'),
      coalesce(v_item->'payload', '{}'::jsonb),
      coalesce(v_item->>'status', 'pending'),
      nullif(v_item->>'skipReason', '')
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  update notifications.events
  set status = 'planned', planned_at = now(), last_error = null, updated_at = now()
  where id = p_event_id;
end;
$function$;

create or replace function public.notifications_mark_event_failed(
  p_event_id uuid,
  p_error text,
  p_max_attempts int default 8
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

  select attempt_count into v_attempt_count
  from notifications.events where id = p_event_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_attempt_count >= p_max_attempts then
    update notifications.events
    set status = 'dead', last_error = left(p_error, 2000), updated_at = now()
    where id = p_event_id;
  else
    update notifications.events
    set status = 'failed',
        last_error = left(p_error, 2000),
        next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
        updated_at = now()
    where id = p_event_id;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Delivery claim / send lifecycle.
-- ---------------------------------------------------------------------------

create or replace function public.notifications_claim_deliveries(
  p_limit int default 20,
  p_lease_seconds int default 120
)
returns setof notifications.deliveries
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.deliveries d
  set status = 'sending',
      sending_started_at = now(),
      sending_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = d.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.deliveries
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'sending' and sending_lease_expires_at < now())
    order by created_at
    limit p_limit
    for update skip locked
  ) as claimed
  where d.id = claimed.id
  returning d.*;
end;
$function$;

create or replace function public.notifications_record_delivery_result(
  p_delivery_id uuid,
  p_outcome text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null,
  p_max_attempts int default 5
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

  if p_outcome not in ('sent', 'retry', 'permanent_failure') then
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

-- ---------------------------------------------------------------------------
-- Server-side template-data assembler. Templates never query the database --
-- this is the one place that reads order/business/location/customer/payment
-- state and hands back a single typed jsonb snapshot.
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
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Dispatcher configuration lookup (includes decrypted secrets -- service
-- role only, never logged by the caller).
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
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select * into v_settings from notifications.settings where id = true;
  if not found then
    raise exception using errcode = 'P0002', message = 'notification settings row is missing';
  end if;

  if v_settings.resend_api_key_secret_id is not null then
    select secret.decrypted_secret into v_resend_key
    from vault.decrypted_secrets as secret
    where secret.id = v_settings.resend_api_key_secret_id;
  end if;

  if v_settings.dispatcher_auth_secret_id is not null then
    select secret.decrypted_secret into v_dispatcher_secret
    from vault.decrypted_secrets as secret
    where secret.id = v_settings.dispatcher_auth_secret_id;
  end if;

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
    'dispatcherAuthSecret', v_dispatcher_secret
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Grants: revoke from PUBLIC/anon/authenticated, grant execute to
-- service_role only. Matches the project's existing privileged-function
-- convention (see ordering.get_payment_provider_for_order).
-- ---------------------------------------------------------------------------

revoke all on function public.notifications_claim_events(int, int) from public, anon, authenticated;
grant execute on function public.notifications_claim_events(int, int) to service_role;

revoke all on function public.notifications_plan_event(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.notifications_plan_event(uuid, jsonb) to service_role;

revoke all on function public.notifications_mark_event_failed(uuid, text, int) from public, anon, authenticated;
grant execute on function public.notifications_mark_event_failed(uuid, text, int) to service_role;

revoke all on function public.notifications_claim_deliveries(int, int) from public, anon, authenticated;
grant execute on function public.notifications_claim_deliveries(int, int) to service_role;

revoke all on function public.notifications_record_delivery_result(uuid, text, text, text, text, int) from public, anon, authenticated;
grant execute on function public.notifications_record_delivery_result(uuid, text, text, text, text, int) to service_role;

revoke all on function public.notifications_get_order_context(uuid) from public, anon, authenticated;
grant execute on function public.notifications_get_order_context(uuid) to service_role;

revoke all on function public.notifications_get_dispatcher_config() from public, anon, authenticated;
grant execute on function public.notifications_get_dispatcher_config() to service_role;
