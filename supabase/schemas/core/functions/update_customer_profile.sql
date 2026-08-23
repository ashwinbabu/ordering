create or replace function core.update_customer_profile (
  p_display_name text,
  p_email        text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_display_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_row core.customers;
begin
  if v_auth_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'a display name is required' using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = '22023';
  end if;

  update core.customers
  set display_name = v_display_name,
      email = v_email,
      email_verified_at = case
        when v_email is distinct from core.customers.email then null
        else core.customers.email_verified_at
      end,
      updated_at = now()
  where core.customers.auth_user_id = v_auth_user_id
  returning * into v_row;

  if not found then
    raise exception 'no customer profile exists for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone_e164', v_row.phone_e164,
    'display_name', v_row.display_name,
    'email', v_row.email,
    'phone_verified_at', v_row.phone_verified_at
  );
end;
$function$;

grant execute on function "core"."update_customer_profile"(text, text) to "authenticated", "postgres";

comment on function "core"."update_customer_profile"(text, text) is 'Updates the signed-in customer''s own display name and email. Phone fields are owned by the auth sync trigger and are intentionally not writable here.';

revoke all on function "core"."update_customer_profile"(text, text) from public;
