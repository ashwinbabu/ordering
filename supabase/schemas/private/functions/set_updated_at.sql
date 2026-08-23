create or replace function private.set_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

grant execute on function "private"."set_updated_at"() to "postgres";

revoke all on function "private"."set_updated_at"() from public;
