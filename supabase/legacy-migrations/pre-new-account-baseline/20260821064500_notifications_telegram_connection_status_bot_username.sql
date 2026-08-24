-- Expose the (non-secret) bot username in the connection-status RPC so the
-- admin UI can tell staff which bot to add to their group, without a second
-- round trip and without touching the bot token itself.

create or replace function public.notifications_get_telegram_connection_status(
  p_business_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_staff_group notifications.telegram_destinations%rowtype;
  v_my_business_user_id uuid;
  v_my_connection notifications.telegram_destinations%rowtype;
  v_bot_username text;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to view this business';
  end if;

  select s.telegram_bot_username into v_bot_username from notifications.settings s where s.id = true;

  if p_location_id is not null then
    select * into v_staff_group
    from notifications.telegram_destinations d
    where d.business_id = p_business_id
      and d.location_id = p_location_id
      and d.destination_type = 'staff_group'
      and d.is_active
    limit 1;
  end if;

  select bu.id into v_my_business_user_id
  from core.business_users bu
  join core.users u on u.id = bu.user_id
  where bu.business_id = p_business_id
    and bu.is_active
    and u.auth_user_id = (select auth.uid())
  limit 1;

  if v_my_business_user_id is not null then
    select * into v_my_connection
    from notifications.telegram_destinations d
    where d.business_user_id = v_my_business_user_id
      and d.destination_type = 'business_user'
      and d.is_active
    limit 1;
  end if;

  return jsonb_build_object(
    'botUsername', v_bot_username,
    'staffGroup', case when v_staff_group.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'chatTitle', v_staff_group.telegram_chat_title, 'connectedAt', v_staff_group.connected_at) end,
    'myConnection', case when v_my_connection.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'connectedAt', v_my_connection.connected_at) end
  );
end;
$function$;
