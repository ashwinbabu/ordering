create or replace function private.normalize_attribution_code()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  new.code := upper(btrim(new.code));
  return new;
end;
$function$;

grant execute on function "private"."normalize_attribution_code"() to "postgres";

revoke all on function "private"."normalize_attribution_code"() from public;
