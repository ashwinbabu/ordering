-- Migrates customer authentication from the MSG91-widget bridge to native
-- Supabase phone auth (signInWithOtp / verifyOtp, delivered via the Send SMS
-- Auth Hook). Supabase now owns OTP generation and verification end to end;
-- the replay guard that existed only to protect the old MSG91 access-token
-- exchange is no longer meaningful.
drop table if exists core.customer_auth_verifications;

-- Supabase creates/updates auth.users rows itself as part of signInWithOtp /
-- verifyOtp - it has no knowledge of core.customers. This trigger is the
-- missing link: whenever an auth.users row gets a phone number (new sign-up,
-- or later confirmation), it finds-or-creates the matching core.customers
-- row by phone_e164 and links auth_user_id.
--
-- Safety: the ON CONFLICT ... WHERE guard never reassigns a customer that is
-- already linked to a *different* auth_user_id - it only links rows that are
-- unlinked or already linked to this same user. Structurally this can only
-- ever conflict with a stale link, since core.customers.phone_e164 and
-- auth.users.phone are both unique.
create or replace function private.sync_customer_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone_e164 text;
begin
  if new.phone is null or new.phone = '' then
    return new;
  end if;

  v_phone_e164 := '+' || regexp_replace(new.phone, '[^0-9]', '', 'g');

  insert into core.customers (phone_e164, auth_user_id, phone_verified_at)
  values (v_phone_e164, new.id, new.phone_confirmed_at)
  on conflict (phone_e164) do update
    set auth_user_id = excluded.auth_user_id,
        phone_verified_at = coalesce(excluded.phone_verified_at, core.customers.phone_verified_at)
    where core.customers.auth_user_id is null
       or core.customers.auth_user_id = excluded.auth_user_id;

  return new;
end;
$$;

drop trigger if exists auth_users_10_sync_customer on auth.users;
create trigger auth_users_10_sync_customer
after insert or update of phone, phone_confirmed_at on auth.users
for each row
execute function private.sync_customer_from_auth_user();

comment on function private.sync_customer_from_auth_user() is
  'Links a Supabase Auth user to its core.customers row by phone_e164 whenever auth.users gains or confirms a phone number. The durable identity is auth.users.id -> core.customers.auth_user_id.';
