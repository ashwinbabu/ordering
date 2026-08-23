create table "ordering"."location_payment_providers" (
  "id"                     uuid                     not null default gen_random_uuid(),
  "location_id"            uuid                     not null,
  "provider"               text                     not null,
  "configuration_status"   text                     not null default 'pending'::text,
  "is_active"              boolean                  not null default false,
  "provider_account_id"    text,
  "public_config"          jsonb                    not null default '{}'::jsonb,
  "credentials_secret_id"  uuid,
  "created_at"             timestamp with time zone not null default now(),
  "updated_at"             timestamp with time zone not null default now(),
  "auth_mode"              text                     not null default 'api_key'::text,
  "environment"            text                     not null default 'test'::text,
  "webhook_secret_id"      uuid,
  "credentials_expires_at" timestamp with time zone,
  constraint "location_payment_providers_account_check"
    check
    (((provider_account_id IS NULL) OR ((provider_account_id = btrim(provider_account_id)) AND ((char_length(provider_account_id) >= 1) AND (char_length(provider_account_id) <=
    255))))),
  constraint "location_payment_providers_api_key_expiry_check" check (((auth_mode <> 'api_key'::text) OR (credentials_expires_at IS NULL))),
  constraint "location_payment_providers_auth_mode_check" check ((auth_mode = ANY (ARRAY['api_key'::text, 'oauth'::text]))),
  constraint "location_payment_providers_credentials_secret_id_fkey" foreign key (credentials_secret_id) references vault.secrets(id) on delete set null,
  constraint "location_payment_providers_environment_check" check ((environment = ANY (ARRAY['test'::text, 'live'::text]))),
  constraint "location_payment_providers_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "location_payment_providers_location_id_provider_key" unique (location_id, provider),
  constraint "location_payment_providers_pkey" primary key (id),
  constraint "location_payment_providers_provider_check"
    check (((provider = lower(btrim(provider))) AND ((char_length(provider) >= 2) AND (char_length(provider) <= 50)) AND (provider ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "location_payment_providers_public_config_check" check (((jsonb_typeof(public_config) = 'object'::text) AND (octet_length((public_config)::text) <= 16384))),
  constraint "location_payment_providers_ready_credentials_check" check (((configuration_status <> 'ready'::text) OR ((credentials_secret_id IS NOT NULL) AND (webhook_secret_id IS
    NOT NULL) AND ((auth_mode <> 'oauth'::text) OR (credentials_expires_at IS NOT NULL))))),
  constraint "location_payment_providers_ready_secret_check" check (((configuration_status <> 'ready'::text) OR (credentials_secret_id IS NOT NULL))),
  constraint "location_payment_providers_status_check" check ((configuration_status = ANY (ARRAY['pending'::text, 'ready'::text, 'error'::text, 'disabled'::text]))),
  constraint "location_payment_providers_updated_at_check" check ((updated_at >= created_at)),
  constraint "location_payment_providers_webhook_secret_id_fkey" foreign key (webhook_secret_id) references vault.secrets(id) on delete set null
);

alter table "ordering"."location_payment_providers"
  enable row level security;

create unique index location_payment_providers_one_active_per_location_idx on ordering.location_payment_providers using btree (location_id)
  where is_active;

create trigger location_payment_providers_90_set_updated_at
  before update on ordering.location_payment_providers
  for each row
  execute function private.set_updated_at();

create policy "location_payment_providers_select_managers" on "ordering"."location_payment_providers"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(location_payment_providers.location_id) as can_manage_sensitive_location_configuration));

grant select on table "ordering"."location_payment_providers" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."location_payment_providers" to "postgres", "service_role";

comment on column "ordering"."location_payment_providers"."auth_mode" is 'How this location authenticates with the provider: api_key for direct merchant credentials, oauth for partner-connected credentials.';

comment on column "ordering"."location_payment_providers"."credentials_expires_at" is 'Expiry of provider credentials when applicable, primarily OAuth access credentials. NULL for api_key auth.';

comment on column "ordering"."location_payment_providers"."environment" is 'Provider environment for this location: test or live.';

comment on column "ordering"."location_payment_providers"."webhook_secret_id" is 'Vault secret used only to verify incoming provider webhooks. Kept separate from API credentials.';
