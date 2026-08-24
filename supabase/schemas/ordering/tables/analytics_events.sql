create table "ordering"."analytics_events" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "business_id"           uuid                     not null,
  "location_id"           uuid,
  "session_id"            uuid                     not null,
  "customer_id"           uuid,
  "cart_id"               uuid,
  "order_id"              uuid,
  "acquisition_source_id" uuid,
  "event_name"            text                     not null,
  "metadata"              jsonb                    not null default '{}'::jsonb,
  "occurred_at"           timestamp with time zone not null default now(),
  constraint "analytics_events_business_customer_fkey" foreign key (business_id, customer_id) references core.customer_businesses(business_id, customer_id) on delete
    set null (customer_id),
  constraint "analytics_events_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "analytics_events_business_location_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete set null (location_id),
  constraint "analytics_events_business_source_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id) on delete
    set null (acquisition_source_id),
  constraint "analytics_events_cart_requires_location_check" check (((cart_id IS NULL) OR (location_id IS NOT NULL))),
  constraint "analytics_events_event_name_check"
    check
    ((event_name = ANY (ARRAY['menu_viewed'::text, 'item_added_to_cart'::text, 'cart_viewed'::text, 'checkout_started'::text, 'payment_started'::text, 'order_placed'::text,
    'payment_failed'::text, 'otp_failed'::text, 'delivery_unserviceable'::text, 'location_permission_denied'::text]))),
  constraint "analytics_events_metadata_check"
    check
    (((jsonb_typeof(metadata) = 'object'::text) AND (octet_length((metadata)::text) <= 16384) AND ((metadata = '{}'::jsonb) OR ((metadata ? 'schema_version'::text) AND
    (jsonb_typeof((metadata -> 'schema_version'::text)) = 'number'::text) AND ((metadata ->> 'schema_version'::text) = '1'::text))))),
  constraint "analytics_events_order_placed_requires_order_check" check (((event_name <> 'order_placed'::text) OR (order_id IS NOT NULL))),
  constraint "analytics_events_pkey" primary key (id),
  constraint "analytics_events_business_location_cart_fkey" foreign key (business_id, location_id, cart_id) references ordering.carts(business_id, location_id, id) on delete
    set null (cart_id),
  constraint "analytics_events_business_order_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete set null (order_id)
);

alter table "ordering"."analytics_events"
  enable row level security;

create index analytics_events_business_event_occurred_idx on ordering.analytics_events using btree (business_id, event_name, occurred_at, id);

create index analytics_events_business_occurred_idx on ordering.analytics_events using btree (business_id, occurred_at, id);

create index analytics_events_business_session_occurred_idx on ordering.analytics_events using btree (business_id, session_id, occurred_at, id);

create trigger analytics_events_20_validate
  before insert or update on ordering.analytics_events
  for each row
  execute function private.validate_analytics_event();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."analytics_events" to "postgres", "service_role";

comment on table "ordering"."analytics_events" is 'Bounded funnel and diagnostic events. Raw events are backend-write-only; reporting uses aggregate RPCs.';
