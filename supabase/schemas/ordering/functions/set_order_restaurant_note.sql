create or replace function ordering.set_order_restaurant_note (
  p_order_id        uuid,
  p_restaurant_note text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_business_id uuid;
begin
  select placed_order.business_id
  into v_business_id
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if v_business_id is null
     or not private.can_operate_orders(v_business_id) then
    raise exception using errcode = '42501', message = 'order note access denied';
  end if;

  update ordering.orders
  set restaurant_note = nullif(btrim(p_restaurant_note), '')
  where id = p_order_id;

  return ordering.get_order(p_order_id);
end;
$function$;

grant execute on function "ordering"."set_order_restaurant_note"(uuid, text) to "authenticated", "postgres";

revoke all on function "ordering"."set_order_restaurant_note"(uuid, text) from public;
