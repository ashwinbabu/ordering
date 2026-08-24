create or replace function ordering.list_telegram_staff (
  p_business_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'Telegram staff administration denied';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', staff.id,
        'telegram_user_id', staff.telegram_user_id,
        'display_name', staff.display_name,
        'is_authorized', staff.is_authorized,
        'created_at', staff.created_at
      ) order by staff.display_name, staff.id
    )
    from ordering.telegram_staff as staff
    where staff.business_id = p_business_id
  ), '[]'::jsonb);
end;
$function$;

grant execute on function "ordering"."list_telegram_staff"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."list_telegram_staff"(uuid) from public;
