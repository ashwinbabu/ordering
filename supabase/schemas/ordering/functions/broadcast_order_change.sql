create or replace function ordering.broadcast_order_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "ordering"."broadcast_order_change"() to "postgres";
