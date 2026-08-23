create or replace function ordering.upsert_telegram_staff (
  p_business_id      uuid,
  p_telegram_user_id bigint,
  p_display_name     text,
  p_is_authorized    boolean default true
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_staff ordering.telegram_staff%rowtype;
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'Telegram staff administration denied';
  end if;

  insert into ordering.telegram_staff (
    business_id,
    telegram_user_id,
    display_name,
    is_authorized
  ) values (
    p_business_id,
    p_telegram_user_id,
    btrim(p_display_name),
    p_is_authorized
  )
  on conflict (business_id, telegram_user_id) do update
  set display_name = excluded.display_name,
      is_authorized = excluded.is_authorized
  returning * into v_staff;

  return jsonb_build_object(
    'id', v_staff.id,
    'business_id', v_staff.business_id,
    'telegram_user_id', v_staff.telegram_user_id,
    'display_name', v_staff.display_name,
    'is_authorized', v_staff.is_authorized,
    'created_at', v_staff.created_at
  );
end;
$function$;

grant execute on function "ordering"."upsert_telegram_staff"(uuid, bigint, text, boolean) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."upsert_telegram_staff"(uuid, bigint, text, boolean) from public;
