create or replace function core.update_customer_contact (
  p_contact_phone_e164       text,
  p_preferred_contact_method text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_phone text := nullif(btrim(coalesce(p_contact_phone_e164, '')), '');
  v_method text := lower(nullif(btrim(coalesce(p_preferred_contact_method, '')), ''));
  v_row core.customers;
begin
  if v_auth_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_phone is null or v_phone !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'a valid E.164 contact phone is required' using errcode = '22023';
  end if;

  if v_method is null or v_method not in ('phone', 'whatsapp') then
    raise exception 'preferred contact method must be phone or whatsapp' using errcode = '22023';
  end if;

  update core.customers
  set preferred_contact_phone_e164 = v_phone,
      preferred_contact_method = v_method,
      updated_at = now()
  where core.customers.auth_user_id = v_auth_user_id
  returning * into v_row;

  if not found then
    raise exception 'no customer profile exists for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone_e164', v_row.phone_e164,
    'preferred_contact_phone_e164', v_row.preferred_contact_phone_e164,
    'preferred_contact_method', v_row.preferred_contact_method
  );
end;
$function$;

grant execute on function "core"."update_customer_contact"(text, text) to "authenticated", "postgres";

revoke all on function "core"."update_customer_contact"(text, text) from public;
