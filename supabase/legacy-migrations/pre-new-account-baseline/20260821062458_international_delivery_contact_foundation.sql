-- Repository mirror of the migration already applied to ordering dev.
-- Delivery-contact persistence is additive and keeps recipient_phone for
-- compatibility while recipient_phone_e164 is the canonical value.

alter table core.customer_business_addresses
  add column if not exists recipient_phone_e164 text,
  add column if not exists preferred_contact_method text,
  add column if not exists telegram_username text;

alter table ordering.orders
  add column if not exists delivery_contact_phone_snapshot text,
  add column if not exists delivery_contact_method_snapshot text,
  add column if not exists delivery_contact_telegram_username_snapshot text;

create or replace function private.normalize_delivery_phone(p_phone text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    when btrim(p_phone) ~ '^[+][1-9][0-9]{7,14}$' then btrim(p_phone)
    when regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      then '+91' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    else null
  end;
$$;

-- The live migration also introduced the customer-owned V2 address write
-- contracts. The country-aware overloads are recorded in the follow-up
-- migration immediately after this one.
