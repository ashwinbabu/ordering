create table "notifications"."deliveries" (
  "id"                       uuid                     not null default gen_random_uuid(),
  "event_id"                 uuid                     not null,
  "business_id"              uuid                     not null,
  "location_id"              uuid,
  "channel"                  text                     not null,
  "template_key"             text                     not null,
  "recipient_type"           text                     not null,
  "recipient_id"             uuid,
  "recipient_address"        text,
  "locale"                   text                     not null default 'en-IN'::text,
  "payload"                  jsonb                    not null default '{}'::jsonb,
  "status"                   text                     not null default 'pending'::text,
  "skip_reason"              text,
  "attempt_count"            integer                  not null default 0,
  "next_attempt_at"          timestamp with time zone not null default now(),
  "sending_started_at"       timestamp with time zone,
  "sending_lease_expires_at" timestamp with time zone,
  "last_error"               text,
  "provider"                 text,
  "provider_message_id"      text,
  "created_at"               timestamp with time zone not null default now(),
  "updated_at"               timestamp with time zone not null default now(),
  "sent_at"                  timestamp with time zone,
  constraint "deliveries_channel_check" check ((channel = ANY (ARRAY['email'::text, 'telegram'::text]))),
  constraint "deliveries_pkey" primary key (id),
  constraint "deliveries_recipient_type_check"
    check ((recipient_type = ANY (ARRAY['customer'::text, 'business_user'::text, 'location_admins'::text, 'email'::text, 'staff_group'::text, 'business_owner'::text]))),
  constraint "deliveries_status_check" check ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'dead'::text]))),
  constraint "notifications_deliveries_address_required_check" check (((status = 'skipped'::text) OR (recipient_address IS NOT NULL))),
  constraint "notifications_deliveries_skip_reason_check" check (((status = 'skipped'::text) = (skip_reason IS NOT NULL))),
  constraint "deliveries_event_id_fkey" foreign key (event_id) references notifications.events(id)
);

alter table "notifications"."deliveries"
  enable row level security;

alter table "notifications"."deliveries"
  add column "dedupe_key" text generated always as
    ((((((((((event_id)::text || ':'::text) || channel) || ':'::text) || recipient_type) || ':'::text) || COALESCE((recipient_id)::text, '-'::text)) || ':'::text) ||
    COALESCE(lower(recipient_address), '-'::text))) stored;

alter table "notifications"."deliveries"
  add constraint "notifications_deliveries_dedupe_key_key" unique (dedupe_key);

create index notifications_deliveries_business_idx on notifications.deliveries using btree (business_id);

create index notifications_deliveries_claim_idx on notifications.deliveries using btree (status, next_attempt_at);

create index notifications_deliveries_event_idx on notifications.deliveries using btree (event_id);

create trigger notifications_deliveries_set_updated_at
  before update on notifications.deliveries
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."deliveries" to "postgres";

comment on table "notifications"."deliveries" is 'Per-recipient, per-channel delivery attempts fanned out from notifications.events. recipient_address is nullable only when status=skipped (e.g. no usable email). Server-only.';
