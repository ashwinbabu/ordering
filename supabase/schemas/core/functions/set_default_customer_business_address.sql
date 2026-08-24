create or replace function core.set_default_customer_business_address (
  p_customer_business_id uuid,
  p_address_id           uuid
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_updated_rows integer;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  perform 1
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'customer relationship was not found or is not owned';
  end if;

  update core.customer_business_addresses
  set is_default = false
  where customer_business_id = p_customer_business_id
    and id <> p_address_id
    and is_default;

  update core.customer_business_addresses
  set is_default = true
  where id = p_address_id
    and customer_business_id = p_customer_business_id;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> 1 then
    raise exception using
      errcode = '42501',
      message = 'saved address was not found or is not owned';
  end if;
end;
$function$;

grant execute on function "core"."set_default_customer_business_address"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "core"."set_default_customer_business_address"(uuid, uuid) from public;
