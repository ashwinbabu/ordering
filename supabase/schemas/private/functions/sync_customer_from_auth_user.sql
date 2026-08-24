create or replace function private.sync_customer_from_auth_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_phone_e164 text;
  v_customer_email text;
  v_customer_email_verified_at timestamptz;
begin
  v_phone_e164 := case
    when new.phone is null or btrim(new.phone) = '' then null
    else '+' || regexp_replace(new.phone, '[^0-9]', '', 'g')
  end;

  -- customer-auth-msg91 creates this address only because Supabase's
  -- email magic-link exchange needs one. Keep that technical identifier in
  -- auth.users while treating it as absent from the customer profile.
  v_customer_email := case
    when new.email ~* '^msg91_[0-9]+@auth[.]invalid$' then null
    else nullif(btrim(new.email), '')
  end;
  v_customer_email_verified_at := case
    when v_customer_email is null then null
    else new.email_confirmed_at
  end;

  -- If this Auth user is already linked, keep the identity fields in sync.
  update core.customers
  set phone_e164 = v_phone_e164,
      phone_verified_at = new.phone_confirmed_at,
      preferred_contact_phone_e164 = coalesce(core.customers.preferred_contact_phone_e164, v_phone_e164),
      preferred_contact_method = case
        when core.customers.preferred_contact_method is null and v_phone_e164 is not null then 'phone'
        else core.customers.preferred_contact_method
      end,
      email = coalesce(core.customers.email, v_customer_email),
      email_verified_at = case
        when core.customers.email is not null then core.customers.email_verified_at
        else v_customer_email_verified_at
      end,
      updated_at = now()
  where core.customers.auth_user_id = new.id;

  if found then
    return new;
  end if;

  -- Preserve the existing phone-first behavior: an unlinked pre-existing
  -- customer with the same verified phone is adopted by this Auth user.
  if v_phone_e164 is not null then
    insert into core.customers (
      phone_e164,
      auth_user_id,
      preferred_contact_phone_e164,
      preferred_contact_method,
      email,
      phone_verified_at,
      email_verified_at
    )
    values (
      v_phone_e164,
      new.id,
      v_phone_e164,
      'phone',
      v_customer_email,
      new.phone_confirmed_at,
      v_customer_email_verified_at
    )
    on conflict (phone_e164) do update
      set auth_user_id = excluded.auth_user_id,
          phone_verified_at = coalesce(excluded.phone_verified_at, core.customers.phone_verified_at),
          email = coalesce(core.customers.email, excluded.email),
          email_verified_at = case
            when core.customers.email is not null then core.customers.email_verified_at
            else excluded.email_verified_at
          end,
          preferred_contact_phone_e164 = coalesce(core.customers.preferred_contact_phone_e164, excluded.phone_e164),
          preferred_contact_method = coalesce(core.customers.preferred_contact_method, 'phone'),
          updated_at = now()
      where core.customers.auth_user_id is null
         or core.customers.auth_user_id = excluded.auth_user_id;

    return new;
  end if;

  -- OAuth-only users have a valid Supabase Auth identity even without a phone.
  insert into core.customers (
    auth_user_id,
    phone_e164,
    email,
    email_verified_at
  )
  values (
    new.id,
    null,
    v_customer_email,
    v_customer_email_verified_at
  )
  on conflict (auth_user_id) where auth_user_id is not null do update
    set email = coalesce(core.customers.email, excluded.email),
        email_verified_at = case
          when core.customers.email is not null then core.customers.email_verified_at
          else excluded.email_verified_at
        end,
        updated_at = now();

  return new;
end;
$function$;

grant execute on function "private"."sync_customer_from_auth_user"() to "postgres";

comment on function "private"."sync_customer_from_auth_user"() is 'Links a Supabase Auth user to its core.customers row by phone_e164 whenever auth.users gains or confirms a phone number. The durable identity is auth.users.id -> core.customers.auth_user_id.';
