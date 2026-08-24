create table "core"."customer_auth_verifications" (
  "id"              uuid                     not null default gen_random_uuid(),
  "token_hash"      text                     not null,
  "identifier_e164" text                     not null,
  "channel"         text                     not null default 'sms'::text,
  "customer_id"     uuid,
  "created_at"      timestamp with time zone not null default now(),
  constraint "customer_auth_verifications_channel_check" check ((channel = ANY (ARRAY['sms'::text, 'email'::text]))),
  constraint "customer_auth_verifications_identifier_e164_check" check ((identifier_e164 ~ '^[+][1-9][0-9]{7,14}$'::text)),
  constraint "customer_auth_verifications_pkey" primary key (id),
  constraint "customer_auth_verifications_token_hash_key" unique (token_hash),
  constraint "customer_auth_verifications_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete set null
);

alter table "core"."customer_auth_verifications"
  enable row level security;

create index customer_auth_verifications_identifier_created_idx on core.customer_auth_verifications using btree (identifier_e164, created_at desc);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_auth_verifications" to "postgres", "service_role";

comment on table "core"."customer_auth_verifications" is 'Replay guard and audit trail for MSG91 access-token verification. A repeat token_hash is rejected by the unique constraint before a Supabase Auth session is minted. Service-role only.';
