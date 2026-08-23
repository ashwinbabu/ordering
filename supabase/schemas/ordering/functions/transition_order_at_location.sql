create or replace function ordering.transition_order_at_location (
  p_business_id     uuid,
  p_location_id     uuid,
  p_order_id        uuid,
  p_expected_status text,
  p_new_status      text,
  p_cancel_reason   text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.can_operate_orders(p_business_id)) then
    raise exception 'Order update access denied.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from ordering.orders as placed_order
    join core.business_locations as location
      on location.id = placed_order.location_id
     and location.business_id = placed_order.business_id
    where placed_order.id = p_order_id
      and placed_order.business_id = p_business_id
      and placed_order.location_id = p_location_id
      and location.is_active
  ) then
    raise exception 'The order does not belong to the selected outlet.' using errcode = '22023';
  end if;

  return ordering.transition_order(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason
  );
end;
$function$;

grant execute on function "ordering"."transition_order_at_location"(uuid, uuid, uuid, text, text, text) to "authenticated", "postgres";

revoke all on function "ordering"."transition_order_at_location"(uuid, uuid, uuid, text, text, text) from public;
