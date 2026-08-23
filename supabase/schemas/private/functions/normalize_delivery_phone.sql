create or replace function private.normalize_delivery_phone (
  p_phone text
)
  returns text
  language sql
  immutable
  set search_path to ''
  AS $function$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    when btrim(p_phone) ~ '^[+][1-9][0-9]{7,14}$' then btrim(p_phone)
    when regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      then '+91' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    else null
  end;
$function$;

grant execute on function "private"."normalize_delivery_phone"(text) to "postgres";

revoke all on function "private"."normalize_delivery_phone"(text) from public;
