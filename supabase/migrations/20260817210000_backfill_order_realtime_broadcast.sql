-- Backfill: this migration was never captured locally even though the
-- objects it creates have been live on the linked dev project since
-- 2026-08-17 (applied ad hoc as realtime_customer_orders_channel_policy,
-- orders_broadcast_customer_change, fix_customer_orders_channel_policy and
-- add_location_order_broadcast). Written here, matching the database's
-- current definitions exactly, so a fresh environment (or `supabase db
-- reset`) reproduces the order-status realtime broadcast that
-- apps/storefront/features/orders/use-customer-orders-channel.ts and
-- apps/admin/features/orders/use-location-orders-channel.ts already depend
-- on. Every statement is written to be safe to (re)run against a database
-- that already has these objects.

-- Authorization helpers for the two private realtime topics below.
create or replace function private.customer_can_access_location(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.customers as customer
      join core.customer_businesses as link
        on link.customer_id = customer.id
      join core.business_locations as location
        on location.business_id = link.business_id
      where customer.auth_user_id = (select auth.uid())
        and location.id = p_location_id
    );
$$;

create or replace function private.is_active_location_member(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_locations as location
      join core.business_users as membership
        on membership.business_id = location.business_id
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where location.id = p_location_id
        and membership.is_active
        and operator_user.auth_user_id = (select auth.uid())
    );
$$;

-- Private-channel authorization: who may join each realtime topic.
drop policy if exists "customer can join own order-change channel" on realtime.messages;
create policy "customer can join own order-change channel"
on realtime.messages for select
to authenticated
using (
  realtime.topic() like 'customer-orders:%'
  and split_part(realtime.topic(), ':', 2) = (select auth.uid())::text
  and private.customer_can_access_location((split_part(realtime.topic(), ':', 3))::uuid)
);

drop policy if exists "active operator can join location order channel" on realtime.messages;
create policy "active operator can join location order channel"
on realtime.messages for select
to authenticated
using (
  case
    when realtime.topic() ~ '^location-orders:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then private.is_active_location_member((split_part(realtime.topic(), ':', 2))::uuid)
    else false
  end
);

-- Broadcasts an order-changed hint (order id only, no order data) to the
-- customer's own tracking channel and to the outlet's queue channel.
-- Consumed by use-customer-orders-channel.ts and use-location-orders-channel.ts,
-- which invalidate their respective queries on receipt and re-read the order
-- through get_order / list_orders_for_location, both RLS-gated. Nothing about
-- the order is ever put on the wire here.
create or replace function ordering.broadcast_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid;
begin
  select customer.auth_user_id
  into v_auth_user_id
  from core.customers as customer
  where customer.id = new.customer_id;

  if v_auth_user_id is not null then
    perform realtime.send(
      jsonb_build_object('order_id', new.id),
      'order-changed',
      'customer-orders:' || v_auth_user_id::text || ':' || new.location_id::text,
      true
    );
  end if;

  perform realtime.send(
    jsonb_build_object('order_id', new.id),
    'order-changed',
    'location-orders:' || new.location_id::text,
    true
  );

  return null;
end;
$$;

drop trigger if exists orders_95_broadcast_change_insert on ordering.orders;
create trigger orders_95_broadcast_change_insert
after insert on ordering.orders
for each row execute function ordering.broadcast_order_change();

drop trigger if exists orders_95_broadcast_change_update on ordering.orders;
create trigger orders_95_broadcast_change_update
after update of status, payment_status on ordering.orders
for each row
when (old.status is distinct from new.status or old.payment_status is distinct from new.payment_status)
execute function ordering.broadcast_order_change();
