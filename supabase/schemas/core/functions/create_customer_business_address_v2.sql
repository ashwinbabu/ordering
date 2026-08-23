create or replace function core.create_customer_business_address_v2 (
  p_customer_business_id     uuid,
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
  p_address_line_2           text    default null::text,
  p_landmark                 text    default null::text,
  p_postal_code              text    default null::text,
  p_delivery_instructions    text    default null::text,
  p_is_default               boolean default false
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
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

  select relationship.business_id, relationship.customer_id
  into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, preferred_contact_method, telegram_username,
    address_line_1, address_line_2, landmark, locality, city, state, postal_code,
    latitude, longitude, delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    v_phone, v_phone, v_method, v_telegram,
    p_address_line_1, p_address_line_2, p_landmark, p_locality, p_city, p_state, p_postal_code,
    p_latitude, p_longitude, p_delivery_instructions, p_is_default
  ) returning id into v_address_id;

  return v_address_id;
end;
$function$;

create or replace function core.create_customer_business_address_v2 (
  p_customer_business_id         uuid,
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
  p_address_line_2               text    default null::text,
  p_landmark                     text    default null::text,
  p_postal_code                  text    default null::text,
  p_delivery_instructions        text    default null::text,
  p_is_default                   boolean default false
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
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

  select relationship.business_id, relationship.customer_id
  into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, recipient_phone_country_iso2,
    preferred_contact_method, telegram_username,
    address_line_1, address_line_2, landmark, locality, city, state, postal_code,
    latitude, longitude, delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    v_phone, v_phone, v_country, v_method, v_telegram,
    p_address_line_1, p_address_line_2, p_landmark, p_locality, p_city, p_state,
    p_postal_code, p_latitude, p_longitude, p_delivery_instructions, p_is_default
  )
  returning id into v_address_id;

  return v_address_id;
end;
$function$;

grant execute
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  to "authenticated", "postgres";

grant execute
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  to "authenticated", "postgres";

revoke all
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  from public;

revoke all
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  from public;
