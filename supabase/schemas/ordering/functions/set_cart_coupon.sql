create or replace function ordering.set_cart_coupon (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_code                 text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_validation jsonb;
  v_subtotal numeric(14, 2);
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status <> 'active' or v_cart.expires_at <= now() then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if p_code is null or btrim(p_code) = '' then
    update ordering.carts
    set coupon_id = null,
        expires_at = now() + interval '30 days'
    where id = p_cart_id;
  else
    v_subtotal := private.current_cart_subtotal(p_cart_id);
    v_validation := ordering.validate_coupon(
      v_cart.business_id,
      v_cart.location_id,
      p_code,
      v_subtotal,
      now()
    );

    if not coalesce((v_validation ->> 'valid')::boolean, false) then
      raise exception using errcode = '22023', message = 'coupon is unavailable';
    end if;

    update ordering.carts
    set coupon_id = (v_validation ->> 'coupon_id')::uuid,
        expires_at = now() + interval '30 days'
    where id = p_cart_id;
  end if;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

grant execute on function "ordering"."set_cart_coupon"(uuid, uuid, text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."set_cart_coupon"(uuid, uuid, text) from public;
