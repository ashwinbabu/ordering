create table "core"."customer_businesses" (
  "id"                             uuid                     not null default gen_random_uuid(),
  "business_id"                    uuid                     not null,
  "customer_id"                    uuid                     not null,
  "first_seen_at"                  timestamp with time zone not null,
  "last_seen_at"                   timestamp with time zone not null,
  "first_order_at"                 timestamp with time zone,
  "last_order_at"                  timestamp with time zone,
  "order_count"                    integer                  not null default 0,
  "lifetime_order_value"           numeric(14,2)            not null default 0,
  "status"                         text                     not null,
  "original_acquisition_source_id" uuid,
  "created_at"                     timestamp with time zone not null default now(),
  constraint "customer_businesses_business_customer_id_id_key" unique (business_id, customer_id, id),
  constraint "customer_businesses_business_id_customer_id_key" unique (business_id, customer_id),
  constraint "customer_businesses_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "customer_businesses_lifetime_value_check" check ((lifetime_order_value >= (0)::numeric)),
  constraint "customer_businesses_order_count_check" check ((order_count >= 0)),
  constraint "customer_businesses_order_window_check" check (((first_order_at IS NULL) OR (last_order_at IS NULL) OR (first_order_at <= last_order_at))),
  constraint "customer_businesses_pkey" primary key (id),
  constraint "customer_businesses_seen_window_check" check ((first_seen_at <= last_seen_at)),
  constraint "customer_businesses_status_check" check ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'blocked'::text]))),
  constraint "customer_businesses_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict,
  constraint "customer_businesses_business_id_source_id_fkey" foreign key (business_id, original_acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict
);

alter table "core"."customer_businesses"
  enable row level security;

create index customer_businesses_business_last_seen_idx on core.customer_businesses using btree (business_id, last_seen_at desc, id);

create index customer_businesses_business_source_idx on core.customer_businesses using btree (business_id, original_acquisition_source_id)
  where (original_acquisition_source_id is not null);

create index customer_businesses_customer_business_idx on core.customer_businesses using btree (customer_id, business_id);

create trigger customer_businesses_20_enforce_identity
  before update on core.customer_businesses
  for each row
  execute function private.enforce_phase_b_identity();

create policy "customer_businesses_select_customer_or_member" on "core"."customer_businesses"
  for select
  to "authenticated"
  using
    ((( select private.is_customer_owner(customer_businesses.customer_id) as is_customer_owner) or ( select private.is_active_business_member(customer_businesses.business_id) as
    is_active_business_member)));

grant select on table "core"."customer_businesses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_businesses" to "postgres", "service_role";

comment on table "core"."customer_businesses" is 'Tenant-scoped customer relationship with immutable first-touch source.';
