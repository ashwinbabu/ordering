create or replace function private.provision_direct_acquisition_source()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  insert into ordering.acquisition_sources (
    business_id,
    campaign_id,
    code,
    name,
    channel,
    is_active
  )
  values (new.id, null, 'DIRECT', 'Direct', 'direct', true)
  on conflict do nothing;

  return new;
end;
$function$;

grant execute on function "private"."provision_direct_acquisition_source"() to "postgres";

revoke all on function "private"."provision_direct_acquisition_source"() from public;
