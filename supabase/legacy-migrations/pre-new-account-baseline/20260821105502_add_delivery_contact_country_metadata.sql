-- Mirror of the migration already applied to ordering dev.
-- E.164 remains authoritative; ISO2 preserves the customer's selected country
-- metadata for deterministic display and editing.

alter table core.customer_business_addresses
  add column if not exists recipient_phone_country_iso2 text;

alter table core.customer_business_addresses
  drop constraint if exists customer_business_addresses_recipient_phone_country_iso2_check;

alter table core.customer_business_addresses
  add constraint customer_business_addresses_recipient_phone_country_iso2_check
  check (recipient_phone_country_iso2 ~ '^[A-Z]{2}$');

create or replace function core.create_customer_business_address_v2(
  p_customer_business_id uuid,
  p_label text,
  p_recipient_name text,
  p_recipient_phone_e164 text,
  p_recipient_phone_country_iso2 text,
  p_preferred_contact_method text,
  p_telegram_username text,
  p_address_line_1 text,
  p_locality text,
  p_city text,
  p_state text,
  p_latitude numeric,
  p_longitude numeric,
  p_address_line_2 text default null,
  p_landmark text default null,
  p_postal_code text default null,
  p_delivery_instructions text default null,
  p_is_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
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
  if v_auth_user_id is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if v_phone is null then raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception using errcode = '22023', message = 'a valid recipient phone country is required'; end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then raise exception using errcode = '22023', message = 'unsupported contact method'; end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then raise exception using errcode = '22023', message = 'a valid Telegram username is required'; end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select relationship.business_id, relationship.customer_id into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id and customer.auth_user_id = v_auth_user_id
  for update of relationship;
  if not found then raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned'; end if;

  if p_is_default then
    update core.customer_business_addresses set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, recipient_phone_country_iso2,
    preferred_contact_method, telegram_username, address_line_1, address_line_2,
    landmark, locality, city, state, postal_code, latitude, longitude,
    delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    v_phone, v_phone, v_country, v_method, v_telegram, p_address_line_1,
    p_address_line_2, p_landmark, p_locality, p_city, p_state, p_postal_code,
    p_latitude, p_longitude, p_delivery_instructions, p_is_default
  ) returning id into v_address_id;
  return v_address_id;
end;
$$;

create or replace function core.update_customer_business_address_v2(
  p_address_id uuid,
  p_label text,
  p_recipient_name text,
  p_recipient_phone_e164 text,
  p_recipient_phone_country_iso2 text,
  p_preferred_contact_method text,
  p_telegram_username text,
  p_address_line_1 text,
  p_locality text,
  p_city text,
  p_state text,
  p_latitude numeric,
  p_longitude numeric,
  p_is_default boolean,
  p_address_line_2 text default null,
  p_landmark text default null,
  p_postal_code text default null,
  p_delivery_instructions text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_country text := upper(btrim(coalesce(p_recipient_phone_country_iso2, '')));
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then raise exception using errcode = '42501', message = 'authentication is required'; end if;
  if v_phone is null then raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception using errcode = '22023', message = 'a valid recipient phone country is required'; end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then raise exception using errcode = '22023', message = 'unsupported contact method'; end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then raise exception using errcode = '22023', message = 'a valid Telegram username is required'; end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select address.customer_business_id into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship on relationship.id = address.customer_business_id
    and relationship.business_id = address.business_id and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id and customer.auth_user_id = v_auth_user_id
  for update of relationship;
  if not found then raise exception using errcode = '42501', message = 'saved address was not found or is not owned'; end if;

  if p_is_default then
    update core.customer_business_addresses set is_default = false
    where customer_business_id = v_customer_business_id and id <> p_address_id and is_default;
  end if;

  update core.customer_business_addresses set
    label = p_label, recipient_name = p_recipient_name, recipient_phone = v_phone,
    recipient_phone_e164 = v_phone, recipient_phone_country_iso2 = v_country,
    preferred_contact_method = v_method, telegram_username = v_telegram,
    address_line_1 = p_address_line_1, address_line_2 = p_address_line_2,
    landmark = p_landmark, locality = p_locality, city = p_city, state = p_state,
    postal_code = p_postal_code, latitude = p_latitude, longitude = p_longitude,
    delivery_instructions = p_delivery_instructions, is_default = p_is_default
  where id = p_address_id;
  return p_address_id;
end;
$$;

revoke all on function core.create_customer_business_address_v2(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean) from public;
grant execute on function core.create_customer_business_address_v2(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean) to authenticated;
revoke all on function core.update_customer_business_address_v2(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text) from public;
grant execute on function core.update_customer_business_address_v2(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text) to authenticated;
