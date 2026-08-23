create or replace function core.update_customer_business_address_v2 (
  p_address_id               uuid,
  p_label                    text,
  p_recipient_name           text,
  p_recipient_phone_e164     text,
  p_preferred_contact_method text,
  p_telegram_username        text,
  p_address_line_1           text,
  p_locality                 text,
  p_city                     text,
  p_state                    text,
  p_latitude                 numeric,
  p_longitude                numeric,
  p_is_default               boolean,
  p_address_line_2           text    default null::text,
  p_landmark                 text    default null::text,
  p_postal_code              text    default null::text,
  p_delivery_instructions    text    default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'saved address was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = v_customer_business_id
      and id <> p_address_id
      and is_default;
  end if;

  update core.customer_business_addresses
  set label = p_label,
      recipient_name = p_recipient_name,
      recipient_phone = v_phone,
      recipient_phone_e164 = v_phone,
      preferred_contact_method = v_method,
      telegram_username = v_telegram,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      landmark = p_landmark,
      locality = p_locality,
      city = p_city,
      state = p_state,
      postal_code = p_postal_code,
      latitude = p_latitude,
      longitude = p_longitude,
      delivery_instructions = p_delivery_instructions,
      is_default = p_is_default
  where id = p_address_id;

  return p_address_id;
end;
$function$;

create or replace function core.update_customer_business_address_v2 (
  p_address_id                   uuid,
  p_label                        text,
  p_recipient_name               text,
  p_recipient_phone_e164         text,
  p_recipient_phone_country_iso2 text,
  p_preferred_contact_method     text,
  p_telegram_username            text,
  p_address_line_1               text,
  p_locality                     text,
  p_city                         text,
  p_state                        text,
  p_latitude                     numeric,
  p_longitude                    numeric,
  p_is_default                   boolean,
  p_address_line_2               text    default null::text,
  p_landmark                     text    default null::text,
  p_postal_code                  text    default null::text,
  p_delivery_instructions        text    default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_country text := upper(btrim(coalesce(p_recipient_phone_country_iso2, '')));
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'a valid recipient phone country is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'saved address was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = v_customer_business_id
      and id <> p_address_id
      and is_default;
  end if;

  update core.customer_business_addresses
  set label = p_label,
      recipient_name = p_recipient_name,
      recipient_phone = v_phone,
      recipient_phone_e164 = v_phone,
      recipient_phone_country_iso2 = v_country,
      preferred_contact_method = v_method,
      telegram_username = v_telegram,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      landmark = p_landmark,
      locality = p_locality,
      city = p_city,
      state = p_state,
      postal_code = p_postal_code,
      latitude = p_latitude,
      longitude = p_longitude,
      delivery_instructions = p_delivery_instructions,
      is_default = p_is_default
  where id = p_address_id;

  return p_address_id;
end;
$function$;

grant execute
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  to "authenticated", "postgres";

grant execute
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  to "authenticated", "postgres";

revoke all
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  from public;

revoke all
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  from public;
