create or replace function core.delete_customer_business_address (
  p_address_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer
    on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'saved address was not found or is not owned';
  end if;

  delete from core.customer_business_addresses
  where id = p_address_id
    and customer_business_id = v_customer_business_id;
end;
$function$;

grant execute on function "core"."delete_customer_business_address"(uuid) to "authenticated", "postgres";

revoke all on function "core"."delete_customer_business_address"(uuid) from public;
