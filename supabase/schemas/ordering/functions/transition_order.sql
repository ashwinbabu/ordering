create or replace function ordering.transition_order (
  p_order_id        uuid,
  p_expected_status text,
  p_new_status      text,
  p_cancel_reason   text default null::text
)
  returns jsonb
  language sql
  security definer
  set search_path to ''
  AS $function$
  select private.transition_order_internal(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason,
    'request',
    null
  );
$function$;

grant execute on function "ordering"."transition_order"(uuid, text, text, text) to "authenticated", "postgres", "service_role";

comment on function "ordering"."transition_order"(uuid, text, text, text) is 'Expected-state order transition with customer/operator authorization, milestones, and one immutable event.';

revoke all on function "ordering"."transition_order"(uuid, text, text, text) from public;
