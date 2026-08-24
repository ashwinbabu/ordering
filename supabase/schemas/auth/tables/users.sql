create trigger auth_users_10_sync_customer
  after insert or update of phone, phone_confirmed_at on auth.users
  for each row
  execute function private.sync_customer_from_auth_user();
