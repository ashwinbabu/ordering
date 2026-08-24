create or replace function public.notifications_consume_telegram_pairing (
  p_token_hash          text,
  p_telegram_chat_id    text,
  p_telegram_chat_type  text,
  p_telegram_chat_title text default null::text,
  p_telegram_user_id    text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_token notifications.telegram_pairing_tokens%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  update notifications.telegram_pairing_tokens
  set consumed_at = now()
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  returning * into v_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired_or_used');
  end if;

  if v_token.destination_type = 'staff_group' and p_telegram_chat_type not in ('group', 'supergroup') then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'staff_group');
  end if;
  if v_token.destination_type = 'business_user' and p_telegram_chat_type <> 'private' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'business_user');
  end if;

  if v_token.destination_type = 'staff_group' then
    update notifications.telegram_destinations
    set is_active = false
    where business_id = v_token.business_id
      and location_id = v_token.location_id
      and destination_type = 'staff_group'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, telegram_chat_id, telegram_chat_type, telegram_chat_title
    ) values (
      v_token.business_id, v_token.location_id, 'staff_group', p_telegram_chat_id, p_telegram_chat_type, p_telegram_chat_title
    );
  else
    update notifications.telegram_destinations
    set is_active = false
    where business_user_id = v_token.business_user_id
      and destination_type = 'business_user'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, business_user_id, telegram_chat_id, telegram_user_id, telegram_chat_type
    ) values (
      v_token.business_id, null, 'business_user', v_token.business_user_id, p_telegram_chat_id, p_telegram_user_id, p_telegram_chat_type
    );
  end if;

  select b.* into v_business from core.businesses b where b.id = v_token.business_id;
  if v_token.location_id is not null then
    select l.* into v_location from core.business_locations l where l.id = v_token.location_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'destinationType', v_token.destination_type,
    'businessName', v_business.name,
    'locationName', v_location.name
  );
end;
$function$;

grant execute on function "public"."notifications_consume_telegram_pairing"(text, text, text, text, text) to "postgres", "service_role";

revoke all on function "public"."notifications_consume_telegram_pairing"(text, text, text, text, text) from public;
