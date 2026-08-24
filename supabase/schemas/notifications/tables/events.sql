create table "notifications"."events" (
  "id"                        uuid                     not null default gen_random_uuid(),
  "event_type"                text                     not null,
  "entity_type"               text                     not null,
  "entity_id"                 uuid                     not null,
  "business_id"               uuid                     not null,
  "location_id"               uuid,
  "source_event_id"           uuid,
  "dedupe_key"                text                     not null,
  "occurred_at"               timestamp with time zone not null,
  "payload"                   jsonb                    not null default '{}'::jsonb,
  "status"                    text                     not null default 'pending'::text,
  "attempt_count"             integer                  not null default 0,
  "planning_started_at"       timestamp with time zone,
  "planning_lease_expires_at" timestamp with time zone,
  "next_attempt_at"           timestamp with time zone not null default now(),
  "last_error"                text,
  "planned_at"                timestamp with time zone,
  "created_at"                timestamp with time zone not null default now(),
  "updated_at"                timestamp with time zone not null default now(),
  constraint "events_entity_type_check" check ((entity_type = ANY (ARRAY['order'::text, 'location'::text]))),
  constraint "events_event_type_check"
    check
    ((event_type = ANY (ARRAY['order.placed'::text, 'order.cancelled'::text, 'order.waiting_3m'::text, 'order.waiting_8m'::text, 'store.paused'::text, 'store.resumed'::text,
    'sales.daily_summary'::text]))),
  constraint "events_pkey" primary key (id),
  constraint "events_status_check" check ((status = ANY (ARRAY['pending'::text, 'planning'::text, 'planned'::text, 'failed'::text, 'dead'::text]))),
  constraint "notifications_events_dedupe_key_key" unique (dedupe_key),
  constraint "notifications_events_source_event_id_key" unique (source_event_id)
);

alter table "notifications"."events"
  enable row level security;

create index notifications_events_business_idx on notifications.events using btree (business_id);

create index notifications_events_claim_idx on notifications.events using btree (status, next_attempt_at);

create index notifications_events_entity_idx on notifications.events using btree (entity_type, entity_id);

create trigger notifications_events_set_updated_at
  before update on notifications.events
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."events" to "postgres";

comment on table "notifications"."events" is 'Durable outbox of domain notification events captured from ordering.order_events. Idempotent on dedupe_key (e.g. order:{orderId}:placed). Server-only.';
