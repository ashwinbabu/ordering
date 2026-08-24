create or replace function core.record_customer_business_visit (
  p_business_id           uuid,
  p_customer_id           uuid,
  p_acquisition_source_id uuid                     default null::uuid,
  p_seen_at               timestamp with time zone default now()
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_seen_at timestamptz := coalesce(p_seen_at, now());
  v_source_id uuid;
  v_relationship_id uuid;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  if not exists (
    select 1
    from core.customers as customer
    where customer.id = p_customer_id
      and customer.auth_user_id = v_auth_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'customer does not belong to the authenticated user';
  end if;

  select source.id
  into v_source_id
  from ordering.acquisition_sources as source
  left join ordering.campaigns as campaign
    on campaign.business_id = source.business_id
   and campaign.id = source.campaign_id
  where source.business_id = p_business_id
    and source.is_active
    and (
      (p_acquisition_source_id is not null
       and source.id = p_acquisition_source_id)
      or
      (p_acquisition_source_id is null and source.code = 'DIRECT')
    )
    and (
      source.campaign_id is null
      or (
        campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= v_seen_at)
        and (campaign.ends_at is null or v_seen_at < campaign.ends_at)
      )
    );

  if v_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'acquisition source is unavailable for this business and time';
  end if;

  insert into core.customer_businesses as existing_relationship (
    business_id,
    customer_id,
    first_seen_at,
    last_seen_at,
    status,
    original_acquisition_source_id
  )
  values (
    p_business_id,
    p_customer_id,
    v_seen_at,
    v_seen_at,
    'active',
    v_source_id
  )
  on conflict (business_id, customer_id)
  do update
    set last_seen_at = greatest(
      existing_relationship.last_seen_at,
      excluded.last_seen_at
    )
  returning existing_relationship.id into v_relationship_id;

  return v_relationship_id;
end;
$function$;

grant execute on function "core"."record_customer_business_visit"(uuid, uuid, uuid, timestamp with time zone) to "authenticated", "postgres";

revoke all on function "core"."record_customer_business_visit"(uuid, uuid, uuid, timestamp with time zone) from public;
