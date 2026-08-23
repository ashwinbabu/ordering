create or replace function private.analytics_metadata_has_forbidden_key (
  p_value jsonb
)
  returns boolean
  language plpgsql
  immutable
  set search_path to ''
  AS $function$
declare
  v_key text;
  v_child jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in
      select entry.key, entry.value
      from jsonb_each(p_value) as entry
    loop
      -- Hashes and raw identifiers are deliberately excluded too. Analytics
      -- needs funnel counts, not customer identity or payment payloads.
      if lower(v_key) ~ '(email|phone|address|payment|gateway|card|token|secret|otp|customer_name|customer_id)' then
        return true;
      end if;

      if private.analytics_metadata_has_forbidden_key(v_child) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in
      select value
      from jsonb_array_elements(p_value)
    loop
      if private.analytics_metadata_has_forbidden_key(v_child) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$function$;

grant execute on function "private"."analytics_metadata_has_forbidden_key"(jsonb) to "postgres";

revoke all on function "private"."analytics_metadata_has_forbidden_key"(jsonb) from public;
