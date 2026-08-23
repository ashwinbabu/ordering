create table "ordering"."carts" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "business_id"           uuid                     not null,
  "location_id"           uuid                     not null,
  "customer_id"           uuid,
  "customer_business_id"  uuid,
  "anonymous_session_id"  uuid,
  "status"                text                     not null default 'active'::text,
  "acquisition_source_id" uuid,
  "coupon_id"             uuid,
  "created_at"            timestamp with time zone not null default now(),
  "updated_at"            timestamp with time zone not null default now(),
  "expires_at"            timestamp with time zone not null,
  "converted_order_id"    uuid,
  constraint "carts_business_id_acquisition_source_id_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict,
  constraint "carts_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "carts_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict,
  constraint "carts_business_id_location_id_id_key" unique (business_id, location_id, id),
  constraint "carts_conversion_check" check ((((status = 'converted'::text) AND (converted_order_id IS
    NOT NULL)) OR ((status <> 'converted'::text) AND (converted_order_id IS NULL)))),
  constraint "carts_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict,
  constraint "carts_customer_relationship_fkey" foreign key (business_id, customer_id, customer_business_id) references core.customer_businesses(business_id, customer_id, id)
    on delete restrict,
  constraint "carts_expiry_check" check ((expires_at > created_at)),
  constraint "carts_identity_check" check ((((anonymous_session_id IS NOT NULL) OR (customer_id IS NOT NULL)) AND ((customer_id IS NULL) = (customer_business_id IS NULL)))),
  constraint "carts_pkey" primary key (id),
  constraint "carts_status_check" check ((status = ANY (ARRAY['active'::text, 'converted'::text, 'abandoned'::text, 'expired'::text]))),
  constraint "carts_updated_at_check" check ((updated_at >= created_at)),
  constraint "carts_business_id_coupon_id_fkey" foreign key (business_id, coupon_id) references ordering.coupons(business_id, id) on delete restrict,
  constraint "carts_business_location_converted_order_fkey" foreign key (business_id, location_id, converted_order_id) references ordering.orders(business_id, location_id, id)
    on delete restrict deferrable initially deferred
);

alter table "ordering"."carts"
  enable row level security;

create index carts_anonymous_status_updated_idx on ordering.carts using btree (anonymous_session_id, status, updated_at desc, id)
  where (anonymous_session_id is not null);

create index carts_business_coupon_idx on ordering.carts using btree (business_id, coupon_id)
  where (coupon_id is not null);

create index carts_business_location_status_updated_idx on ordering.carts using btree (business_id, location_id, status, updated_at desc, id);

create index carts_business_source_idx on ordering.carts using btree (business_id, acquisition_source_id)
  where (acquisition_source_id is not null);

create unique index carts_converted_order_key on ordering.carts using btree (business_id, location_id, converted_order_id)
  where (converted_order_id is not null);

create index carts_customer_relationship_idx on ordering.carts using btree (business_id, customer_id, customer_business_id)
  where (customer_id is not null);

create index carts_customer_status_updated_idx on ordering.carts using btree (customer_id, status, updated_at desc, id)
  where (customer_id is not null);

create index carts_expiry_housekeeping_idx on ordering.carts using btree (expires_at, id)
  where (status = ANY (ARRAY['active'::text, 'abandoned'::text]));

create unique index carts_one_active_anonymous_key on ordering.carts using btree (business_id, location_id, anonymous_session_id)
  where ((status = 'active'::text) AND (anonymous_session_id is not null));

create unique index carts_one_active_customer_key on ordering.carts using btree (business_id, location_id, customer_id)
  where ((status = 'active'::text) AND (customer_id is not null));

create trigger carts_20_enforce_identity
  before update on ordering.carts
  for each row
  execute function private.enforce_cart_identity();

create trigger carts_90_set_updated_at
  before update on ordering.carts
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."carts" to "postgres", "service_role";

comment on table "ordering"."carts" is 'Persistent tenant/location cart owned by an anonymous bearer session or customer.';
