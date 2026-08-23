create or replace function ordering.maintain_cart_lifecycle (
  p_abandon_before timestamp with time zone default (now() - '7 days'::interval),
  p_expire_before  timestamp with time zone default now(),
  p_batch_size     integer                  default 500
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_expired_count integer := 0;
  v_abandoned_count integer := 0;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'invalid batch size';
  end if;

  with candidates as (
    select cart.id
    from ordering.carts as cart
    where cart.status in ('active', 'abandoned')
      and cart.expires_at <= p_expire_before
    order by cart.expires_at, cart.id
    for update skip locked
    limit p_batch_size
  )
  update ordering.carts as cart
  set status = 'expired'
  from candidates
  where cart.id = candidates.id;

  get diagnostics v_expired_count = row_count;

  with candidates as (
    select cart.id
    from ordering.carts as cart
    where cart.status = 'active'
      and cart.updated_at < p_abandon_before
      and cart.expires_at > p_expire_before
    order by cart.updated_at, cart.id
    for update skip locked
    limit p_batch_size
  )
  update ordering.carts as cart
  set status = 'abandoned'
  from candidates
  where cart.id = candidates.id;

  get diagnostics v_abandoned_count = row_count;

  return jsonb_build_object(
    'expired', v_expired_count,
    'abandoned', v_abandoned_count
  );
end;
$function$;

grant execute on function "ordering"."maintain_cart_lifecycle"(timestamp with time zone, timestamp with time zone, integer) to "postgres", "service_role";

revoke all on function "ordering"."maintain_cart_lifecycle"(timestamp with time zone, timestamp with time zone, integer) from public;
