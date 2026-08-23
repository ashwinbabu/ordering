create or replace function public.notifications_create_telegram_pairing_token (
  p_destination_type text,
  p_business_id      uuid,
  p_location_id      uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_business_user_id uuid;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to manage this business';
  end if;

  if p_destination_type = 'staff_group' then
    if p_location_id is null then
      raise exception using errcode = '22023', message = 'location_id is required for a staff_group pairing token';
    end if;
    if not exists (
      select 1 from core.business_locations l
      where l.id = p_location_id and l.business_id = p_business_id
    ) then
      raise exception using errcode = 'P0002', message = 'location does not belong to this business';
    end if;
  elsif p_destination_type = 'business_user' then
    select bu.id into v_business_user_id
    from core.business_users bu
    join core.users u on u.id = bu.user_id
    where bu.business_id = p_business_id
      and bu.is_active
      and u.auth_user_id = (select auth.uid())
    limit 1;
    if v_business_user_id is null then
      raise exception using errcode = '42501', message = 'caller is not an active member of this business';
    end if;
    p_location_id := null;
  else
    raise exception using errcode = '22023', message = 'invalid destination_type';
  end if;

  v_token := encode(extensions.gen_random_bytes(20), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into notifications.telegram_pairing_tokens (
    token_hash, business_id, location_id, destination_type, business_user_id, expires_at, created_by
  ) values (
    v_token_hash, p_business_id, p_location_id, p_destination_type, v_business_user_id, v_expires_at, (select auth.uid())
  );

  return jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires_at,
    'destinationType', p_destination_type,
    'businessId', p_business_id,
    'locationId', p_location_id
  );
end;
$function$;

grant execute on function "public"."notifications_create_telegram_pairing_token"(text, uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_create_telegram_pairing_token"(text, uuid, uuid) from public;
