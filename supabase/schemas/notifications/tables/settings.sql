create table "notifications"."settings" (
  "id"                           boolean                  not null default true,
  "email_provider"               text                     not null default 'resend'::text,
  "email_from_address"           text                     not null default 'onboarding@resend.dev'::text,
  "email_from_name_fallback"     text                     not null default 'A2 Food and Beverages'::text,
  "email_reply_to"               text,
  "notifications_email_mode"     text                     not null default 'redirect'::text,
  "notifications_dev_recipient"  text,
  "notifications_environment"    text                     not null default 'development'::text,
  "dev_default_storefront_url"   text                     default 'https://ordering-storefront-dev.vercel.app'::text,
  "resend_api_key_secret_id"     uuid,
  "dispatcher_auth_secret_id"    uuid,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  "telegram_bot_token_secret_id" uuid,
  "telegram_webhook_secret_id"   uuid,
  "telegram_bot_username"        text,
  "notifications_telegram_mode"  text                     not null default 'log'::text,
  constraint "notifications_settings_singleton_check" check (id),
  constraint "settings_dispatcher_auth_secret_id_fkey" foreign key (dispatcher_auth_secret_id) references vault.secrets(id),
  constraint "settings_notifications_email_mode_check" check ((notifications_email_mode = ANY (ARRAY['off'::text, 'log'::text, 'redirect'::text, 'live'::text]))),
  constraint "settings_notifications_environment_check" check ((notifications_environment = ANY (ARRAY['development'::text, 'production'::text]))),
  constraint "settings_notifications_telegram_mode_check" check ((notifications_telegram_mode = ANY (ARRAY['off'::text, 'log'::text, 'live'::text]))),
  constraint "settings_pkey" primary key (id),
  constraint "settings_resend_api_key_secret_id_fkey" foreign key (resend_api_key_secret_id) references vault.secrets(id),
  constraint "settings_telegram_bot_token_secret_id_fkey" foreign key (telegram_bot_token_secret_id) references vault.secrets(id),
  constraint "settings_telegram_webhook_secret_id_fkey" foreign key (telegram_webhook_secret_id) references vault.secrets(id)
);

alter table "notifications"."settings"
  enable row level security;

create trigger notifications_settings_set_updated_at
  before update on notifications.settings
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."settings" to "postgres";

comment on table "notifications"."settings" is 'Singleton server-side notification configuration. Secret material is referenced via vault.secrets (resend_api_key_secret_id, dispatcher_auth_secret_id) and never stored in plaintext on this row.';
