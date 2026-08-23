create or replace function private.validate_payment_provider_route()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_provider text;
begin
  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = new.order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_method <> 'online' then
    raise exception using errcode = '22023', message = 'payment attempts are only valid for online-payment orders';
  end if;

  select provider.provider into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = v_order.location_id
    and provider.is_active
    and provider.configuration_status = 'ready'
  limit 1;

  if v_provider is null then
    raise exception using errcode = '55000', message = 'no ready online payment provider is configured for this outlet';
  end if;

  if lower(btrim(new.provider)) <> v_provider then
    raise exception using errcode = '22023', message = 'payment provider does not match the configured outlet provider';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."validate_payment_provider_route"() to "postgres";
