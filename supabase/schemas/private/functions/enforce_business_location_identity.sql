create or replace function private.enforce_business_location_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '23514',
      message = 'business-location identity and business scope are immutable';
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_business_location_identity"() to "postgres";
