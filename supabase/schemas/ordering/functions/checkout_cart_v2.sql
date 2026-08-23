create or replace function ordering.checkout_cart_v2 (
  p_order_id                     uuid,
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_customer_note                text     default null::text,
  p_trusted_delivery_minutes     smallint default null::smallint,
  p_payment_method               text     default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
  v_phone text;
  v_method text;
  v_telegram text;
  v_address_snapshot jsonb;
begin
  v_result := ordering.checkout_cart(
    p_order_id,
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_customer_note,
    p_trusted_delivery_minutes,
    p_payment_method
  );

  if p_fulfillment_type = 'delivery' then
    select
      address.recipient_phone_e164,
      coalesce(address.preferred_contact_method, 'phone'),
      address.telegram_username
    into v_phone, v_method, v_telegram
    from core.customer_business_addresses as address
    join ordering.orders as placed_order
      on placed_order.id = p_order_id
     and placed_order.business_id = address.business_id
     and placed_order.customer_id = address.customer_id
     and placed_order.customer_business_id = address.customer_business_id
    where address.id = p_customer_business_address_id;

    if v_phone is null then
      raise exception using errcode = '22023', message = 'delivery contact phone is unavailable';
    end if;
    if v_method = 'telegram' and v_telegram is null then
      raise exception using errcode = '22023', message = 'Telegram contact requires a username';
    end if;

    -- Only fill snapshots once. Retrying the same stable order id must not mutate history.
    update ordering.orders as placed_order
    set delivery_contact_phone_snapshot = v_phone,
        delivery_contact_method_snapshot = v_method,
        delivery_contact_telegram_username_snapshot = case when v_method = 'telegram' then v_telegram else null end,
        delivery_address_snapshot = coalesce(placed_order.delivery_address_snapshot, '{}'::jsonb)
          || jsonb_build_object(
            'schema_version', 2,
            'recipient_phone_e164', v_phone,
            'preferred_contact_method', v_method,
            'telegram_username', case when v_method = 'telegram' then v_telegram else null end
          )
    where placed_order.id = p_order_id
      and placed_order.delivery_contact_method_snapshot is null;
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

grant execute on function "ordering"."checkout_cart_v2"(uuid, uuid, text, uuid, text, smallint, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."checkout_cart_v2"(uuid, uuid, text, uuid, text, smallint, text) from public;
