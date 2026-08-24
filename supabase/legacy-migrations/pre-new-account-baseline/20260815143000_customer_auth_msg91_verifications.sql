-- MSG91 OTP customer authentication: replay guard for the customer-auth-msg91
-- Edge Function. The function itself trusts only the identifier MSG91's own
-- verifyAccessToken response reports as verified; this table exists purely so
-- a given MSG91 access token can be accepted by our server exactly once.

create table core.customer_auth_verifications (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  identifier_e164 text not null,
  channel text not null default 'sms',
  customer_id uuid references core.customers(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_auth_verifications_token_hash_key unique (token_hash),
  constraint customer_auth_verifications_identifier_e164_check
    check (identifier_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  constraint customer_auth_verifications_channel_check
    check (channel in ('sms', 'email'))
);

create index customer_auth_verifications_identifier_created_idx
  on core.customer_auth_verifications (identifier_e164, created_at desc);

alter table core.customer_auth_verifications enable row level security;
-- No policies: service-role only, matching ordering.payments / ordering.order_events.
-- The customer-auth-msg91 Edge Function is the only caller and always runs
-- with the service-role key, which bypasses RLS entirely.

comment on table core.customer_auth_verifications is
  'Replay guard and audit trail for MSG91 access-token verification. A repeat token_hash is rejected by the unique constraint before a Supabase Auth session is minted. Service-role only.';
