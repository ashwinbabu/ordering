create or replace function ordering.remove_cart_item (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_cart_item_id         uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  perform 1
  from ordering.carts as cart
  where cart.id = p_cart_id
    and cart.status = 'active'
    and cart.expires_at > v_now
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  delete from ordering.cart_items
  where id = p_cart_item_id
    and cart_id = p_cart_id;

  update ordering.carts
  set expires_at = v_now + interval '30 days'
  where id = p_cart_id;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

grant execute on function "ordering"."remove_cart_item"(uuid, uuid, uuid) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."remove_cart_item"(uuid, uuid, uuid) from public;
