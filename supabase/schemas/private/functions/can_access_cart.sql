create or replace function private.can_access_cart (
  p_cart_id              uuid,
  p_anonymous_session_id uuid default null::uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from ordering.carts as cart
    left join core.customers as customer
      on customer.id = cart.customer_id
    where cart.id = p_cart_id
      and (
        (
          cart.customer_id is not null
          and customer.auth_user_id = (select auth.uid())
        )
        or
        (
          (select private.request_is_service_role())
          and (
            cart.customer_id is not null
            or cart.anonymous_session_id = p_anonymous_session_id
          )
        )
        or
        (
          cart.customer_id is null
          and cart.anonymous_session_id is not null
          and p_anonymous_session_id is not null
          and cart.anonymous_session_id = p_anonymous_session_id
        )
      )
  );
$function$;

grant execute on function "private"."can_access_cart"(uuid, uuid) to "postgres";

revoke all on function "private"."can_access_cart"(uuid, uuid) from public;
