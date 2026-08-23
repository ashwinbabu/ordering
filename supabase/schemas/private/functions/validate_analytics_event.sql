create or replace function private.validate_analytics_event()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
begin
  -- Metadata is intentionally a small, flat, event-specific envelope. A
  -- key-name blocklist alone cannot prove that a free-text value has no PII.
  -- The allowlist below removes arbitrary notes, URLs, payloads, and IDs from
  -- this analytics surface entirely.
  if exists (
    select 1
    from jsonb_object_keys(new.metadata) as metadata_key(key)
    where metadata_key.key not in (
      'schema_version',
      'surface',
      'product_id',
      'quantity',
      'fulfillment_type',
      'provider',
      'reason_code',
      'permission_state'
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'analytics metadata includes an unsupported key';
  end if;

  if private.analytics_metadata_has_forbidden_key(new.metadata) then
    raise exception using
      errcode = '22023',
      message = 'analytics metadata contains a forbidden PII or payment key';
  end if;

  if new.metadata ? 'surface'
     and (
       new.event_name <> 'menu_viewed'
       or coalesce(new.metadata ->> 'surface', '') !~ '^[a-z][a-z0-9_-]{0,31}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics surface metadata is invalid';
  end if;

  if (new.metadata ? 'product_id') or (new.metadata ? 'quantity') then
    if new.event_name <> 'item_added_to_cart'
       or not (new.metadata ? 'product_id' and new.metadata ? 'quantity')
       or coalesce(new.metadata ->> 'product_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(new.metadata ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$'
       or (new.metadata ->> 'quantity')::integer > 100
       or not exists (
         select 1
         from ordering.products as product
         where product.id = (new.metadata ->> 'product_id')::uuid
           and product.business_id = new.business_id
       ) then
      raise exception using errcode = '22023', message = 'analytics item metadata is invalid';
    end if;
  elsif new.event_name = 'item_added_to_cart' then
    raise exception using
      errcode = '22023',
      message = 'item_added_to_cart requires product_id and quantity metadata';
  end if;

  if new.metadata ? 'fulfillment_type'
     and (
       new.event_name <> 'checkout_started'
       or new.metadata ->> 'fulfillment_type' not in ('delivery', 'pickup')
     ) then
    raise exception using errcode = '22023', message = 'analytics fulfillment metadata is invalid';
  end if;

  if new.metadata ? 'provider'
     and (
       new.event_name not in ('payment_started', 'payment_failed')
       or coalesce(new.metadata ->> 'provider', '') !~ '^[a-z][a-z0-9_-]{0,49}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics provider metadata is invalid';
  end if;

  if new.metadata ? 'reason_code'
     and (
       new.event_name not in (
         'payment_failed', 'otp_failed', 'delivery_unserviceable'
       )
       or coalesce(new.metadata ->> 'reason_code', '') !~ '^[a-z][a-z0-9_-]{0,63}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics reason metadata is invalid';
  end if;

  if new.metadata ? 'permission_state'
     and (
       new.event_name <> 'location_permission_denied'
       or new.metadata ->> 'permission_state' <> 'denied'
     ) then
    raise exception using errcode = '22023', message = 'analytics permission metadata is invalid';
  end if;

  if new.event_name = 'order_placed' then
    select order_row.*
    into v_order
    from ordering.orders as order_row
    where order_row.id = new.order_id
      and order_row.business_id = new.business_id;

    if not found
       or v_order.payment_status not in ('paid', 'not_required')
       or v_order.status = 'payment_pending' then
      raise exception using
        errcode = '22023',
        message = 'order_placed analytics requires a paid or no-payment placed order';
    end if;

    if new.location_id is not null and new.location_id <> v_order.location_id then
      raise exception using
        errcode = '23514',
        message = 'analytics order location must match the order location';
    end if;
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_analytics_event"() to "postgres";

revoke all on function "private"."validate_analytics_event"() from public;
