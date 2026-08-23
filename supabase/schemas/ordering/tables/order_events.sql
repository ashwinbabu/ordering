create table "ordering"."order_events" (
  "id"          uuid                     not null default gen_random_uuid(),
  "order_id"    uuid                     not null,
  "business_id" uuid                     not null,
  "event_type"  text                     not null,
  "from_status" text,
  "to_status"   text,
  "actor_type"  text                     not null,
  "actor_id"    uuid,
  "metadata"    jsonb                    not null default '{}'::jsonb,
  "created_at"  timestamp with time zone not null default now(),
  constraint "order_events_actor_type_check" check ((actor_type = ANY (ARRAY['customer'::text, 'admin'::text, 'telegram'::text, 'system'::text]))),
  constraint "order_events_event_type_check"
    check
    ((event_type = ANY (ARRAY['order_created'::text, 'order_placed'::text, 'order_accepted'::text, 'order_needs_attention'::text, 'order_ready_for_pickup'::text,
    'order_out_for_delivery'::text, 'order_delivered'::text, 'order_cancelled'::text, 'payment_status_changed'::text, 'refund_recorded'::text]))),
  constraint "order_events_metadata_check" check (((jsonb_typeof(metadata) = 'object'::text) AND (octet_length((metadata)::text) <= 65536))),
  constraint "order_events_pkey" primary key (id),
  constraint "order_events_status_values_check"
    check
    ((((from_status IS NULL) OR (from_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text,
    'delivered'::text,
    'needs_attention'::text,
    'cancelled'::text]))) AND
    ((to_status IS NULL) OR (to_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text,
    'delivered'::text, 'needs_attention'::text, 'cancelled'::text]))))),
  constraint "order_events_business_id_order_id_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete restrict
);

alter table "ordering"."order_events"
  enable row level security;

create index order_events_business_order_idx on ordering.order_events using btree (business_id, order_id);

create index order_events_business_type_created_idx on ordering.order_events using btree (business_id, event_type, created_at desc, id);

create index order_events_order_created_idx on ordering.order_events using btree (order_id, created_at, id);

create unique index order_events_provider_event_key on ordering.order_events using btree (((metadata ->> 'provider'::text)), ((metadata ->> 'provider_event_id'::text)))
  where ((event_type = 'payment_status_changed'::text) AND (metadata ? 'provider'::text) AND (metadata ? 'provider_event_id'::text));

create trigger order_events_capture_notification
  after insert on ordering.order_events
  for each row
  execute function private.capture_notification_event_from_order_event();

create trigger order_events_reject_update
  before delete or update on ordering.order_events
  for each row
  execute function private.reject_order_snapshot_mutation();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_events" to "postgres", "service_role";
