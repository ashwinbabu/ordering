-- Storefront customer account boundary.
--
-- Two gaps blocked the storefront account page:
--   1. core.customers has a SELECT-only RLS policy (customers_select_own) and
--      no update RPC, so a signed-in customer had no way to persist their own
--      name/email. Profile edits were necessarily local-only.
--   2. ordering.orders is only readable by business staff
--      (orders_select_settings_managers). list_orders/get_order are
--      business-scoped admin RPCs, so a customer had no way to read their own
--      order history.
--
-- Both are closed here with security-definer RPCs keyed off auth.uid(),
-- granted to `authenticated` only. Anonymous callers are rejected: order
-- history and profile data are PII and must never be reachable with the anon
-- key the way the anonymous cart is.

-- ---------------------------------------------------------------------------
-- 1. Customer profile self-service update
-- ---------------------------------------------------------------------------
create or replace function core.update_customer_profile(
  p_display_name text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_display_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_row core.customers;
begin
  if v_auth_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'a display name is required' using errcode = '22023';
  end if;

  -- Deliberately narrow: phone_e164 and phone_verified_at are owned by the
  -- auth trigger (private.sync_customer_from_auth_user) and must not be
  -- writable here, or a customer could claim another customer's phone.
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = '22023';
  end if;

  update core.customers
  set display_name = v_display_name,
      email = v_email,
      -- Changing the address invalidates any prior verification of it.
      email_verified_at = case
        when v_email is distinct from core.customers.email then null
        else core.customers.email_verified_at
      end,
      updated_at = now()
  where core.customers.auth_user_id = v_auth_user_id
  returning * into v_row;

  if not found then
    raise exception 'no customer profile exists for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone_e164', v_row.phone_e164,
    'display_name', v_row.display_name,
    'email', v_row.email,
    'phone_verified_at', v_row.phone_verified_at
  );
end;
$$;

revoke all on function core.update_customer_profile(text, text) from public;
grant execute on function core.update_customer_profile(text, text) to authenticated;

comment on function core.update_customer_profile(text, text) is
  'Updates the signed-in customer''s own display name and email. Phone fields are owned by the auth sync trigger and are intentionally not writable here.';

-- ---------------------------------------------------------------------------
-- 2. Customer-facing order history, scoped to one business
-- ---------------------------------------------------------------------------
create or replace function ordering.list_customer_orders(
  p_business_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_customer_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  select customer.id into v_customer_id
  from core.customers as customer
  where customer.auth_user_id = (select auth.uid());

  -- No signed-in customer means no order history, not an error: the account
  -- screen renders its empty state rather than a failure.
  if v_customer_id is null then
    return jsonb_build_object('schemaVersion', 1, 'orders', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'orders', coalesce((
      select jsonb_agg(entry order by entry ->> 'placedAt' desc nulls last)
      from (
        select jsonb_build_object(
          'id', o.id,
          'orderNumber', o.order_number,
          'status', o.status,
          'paymentStatus', o.payment_status,
          'fulfillmentType', o.fulfillment_type,
          'currency', o.currency,
          'foodSubtotal', o.food_subtotal,
          'discountTotal', o.discount_total,
          'taxTotal', o.tax_total,
          'deliveryFee', o.delivery_fee,
          'grandTotal', o.grand_total,
          'couponCode', o.coupon_code_snapshot,
          'customerNote', o.customer_note,
          'cancelReason', o.cancel_reason,
          'deliveryAddress', o.delivery_address_snapshot,
          'estimatedDeliveryMinutes', o.estimated_delivery_minutes,
          'placedAt', o.placed_at,
          'acceptedAt', o.accepted_at,
          'outForDeliveryAt', o.out_for_delivery_at,
          'deliveredAt', o.delivered_at,
          'cancelledAt', o.cancelled_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', item.id,
              'productId', item.product_id,
              'productName', item.product_name,
              'quantity', item.quantity,
              'finalUnitPrice', item.final_unit_price,
              'lineTotal', item.line_total,
              'customerNote', item.customer_note,
              'options', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'optionName', opt.option_name,
                  'optionGroupName', opt.option_group_name,
                  'priceDelta', opt.price_delta
                ) order by opt.option_group_name, opt.option_name)
                from ordering.order_item_options as opt
                where opt.order_item_id = item.id
              ), '[]'::jsonb)
            ) order by item.created_at, item.id)
            from ordering.order_items as item
            where item.order_id = o.id
          ), '[]'::jsonb)
        ) as entry
        from ordering.orders as o
        where o.customer_id = v_customer_id
          and o.business_id = p_business_id
          -- A payment_pending row is an abandoned checkout, not an order the
          -- customer placed; showing it as order history would be misleading.
          and o.status <> 'payment_pending'
        order by o.placed_at desc nulls last
        limit v_limit
      ) as ordered_entries
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function ordering.list_customer_orders(uuid, integer) from public;
grant execute on function ordering.list_customer_orders(uuid, integer) to authenticated;

comment on function ordering.list_customer_orders(uuid, integer) is
  'Returns the signed-in customer''s own orders for one business, newest first, with items and selected options. Abandoned payment_pending checkouts are excluded.';
