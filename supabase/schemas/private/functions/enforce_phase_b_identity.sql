create or replace function private.enforce_phase_b_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id then
    raise exception using
      errcode = '23514',
      message = 'row identifiers are immutable';
  end if;

  if tg_table_schema = 'ordering' and tg_table_name = 'campaigns' then
    if new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'campaign business_id is immutable';
    end if;

    if new.code is distinct from old.code and exists (
      select 1
      from core.customer_businesses as relationship
      join ordering.acquisition_sources as source
        on source.business_id = relationship.business_id
       and source.id = relationship.original_acquisition_source_id
      where source.business_id = old.business_id
        and source.campaign_id = old.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'campaign code is immutable after attribution use';
    end if;

  elsif tg_table_schema = 'ordering'
      and tg_table_name = 'acquisition_sources' then
    if new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'acquisition source business_id is immutable';
    end if;

    if old.code = 'DIRECT' and new.code is distinct from old.code then
      raise exception using
        errcode = '23514',
        message = 'the reserved DIRECT source code is immutable';
    end if;

    if (
      new.code is distinct from old.code
      or new.campaign_id is distinct from old.campaign_id
    ) and exists (
      select 1
      from core.customer_businesses as relationship
      where relationship.business_id = old.business_id
        and relationship.original_acquisition_source_id = old.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'source code and campaign are immutable after attribution use';
    end if;

  elsif tg_table_schema = 'core'
      and tg_table_name = 'customer_businesses' then
    if new.business_id is distinct from old.business_id
       or new.customer_id is distinct from old.customer_id
       or new.original_acquisition_source_id
          is distinct from old.original_acquisition_source_id then
      raise exception using
        errcode = '23514',
        message = 'customer relationship identity and first-touch source are immutable';
    end if;

  elsif tg_table_schema = 'core'
      and tg_table_name = 'customer_business_addresses' then
    if new.customer_business_id is distinct from old.customer_business_id
       or new.business_id is distinct from old.business_id
       or new.customer_id is distinct from old.customer_id then
      raise exception using
        errcode = '23514',
        message = 'saved address ownership is immutable';
    end if;
  end if;

  return new;
end;
$function$;

grant execute on function "private"."enforce_phase_b_identity"() to "postgres";

revoke all on function "private"."enforce_phase_b_identity"() from public;
