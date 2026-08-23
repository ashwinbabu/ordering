create or replace function public.notifications_get_location_context (
  p_location_id  uuid,
  p_summary_date date default null::date
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_location core.business_locations%rowtype;
  v_business core.businesses%rowtype;
  v_staff_group notifications.telegram_destinations%rowtype;
  v_owners jsonb;
  v_sales jsonb;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select l.* into v_location from core.business_locations l where l.id = p_location_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'location not found';
  end if;
  select b.* into v_business from core.businesses b where b.id = v_location.business_id;

  select * into v_staff_group
  from notifications.telegram_destinations d
  where d.business_id = v_business.id
    and d.location_id = p_location_id
    and d.destination_type = 'staff_group'
    and d.is_active
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('chatId', d.telegram_chat_id)), '[]'::jsonb)
  into v_owners
  from notifications.telegram_destinations d
  join core.business_users bu on bu.id = d.business_user_id
  where d.destination_type = 'business_user'
    and d.is_active
    and bu.business_id = v_business.id
    and bu.is_active
    and bu.role in ('owner', 'admin');

  if p_summary_date is not null then
    select jsonb_build_object(
      'date', p_summary_date,
      'orderCount', count(*) filter (where o.status <> 'cancelled'),
      'cancelledCount', count(*) filter (where o.status = 'cancelled'),
      'totalRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled'), 0)::text,
      'cashRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled' and o.payment_method = 'cash'), 0)::text,
      'onlineRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled' and o.payment_method = 'online'), 0)::text
    )
    into v_sales
    from ordering.orders o
    where o.location_id = p_location_id
      and (o.placed_at at time zone v_business.timezone)::date = p_summary_date;
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id, 'name', v_business.name, 'timezone', v_business.timezone, 'currency', v_business.currency
    ),
    'location', jsonb_build_object('id', v_location.id, 'name', v_location.name),
    'telegram', jsonb_build_object(
      'staffGroup', case when v_staff_group.id is null then null else jsonb_build_object(
        'chatId', v_staff_group.telegram_chat_id,
        'chatTitle', v_staff_group.telegram_chat_title
      ) end,
      'businessOwners', v_owners
    ),
    'salesSummary', v_sales
  );
end;
$function$;

grant execute on function "public"."notifications_get_location_context"(uuid, date) to "postgres", "service_role";

revoke all on function "public"."notifications_get_location_context"(uuid, date) from public;
