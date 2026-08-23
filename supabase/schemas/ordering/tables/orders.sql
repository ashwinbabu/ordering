create table "ordering"."orders" (
  "id"                                          uuid                     not null default gen_random_uuid(),
  "order_number"                                text                     not null,
  "business_id"                                 uuid                     not null,
  "location_id"                                 uuid                     not null,
  "customer_id"                                 uuid                     not null,
  "customer_business_id"                        uuid                     not null,
  "acquisition_source_id"                       uuid,
  "fulfillment_type"                            text                     not null,
  "status"                                      text                     not null,
  "payment_status"                              text                     not null,
  "currency"                                    text                     not null,
  "food_subtotal"                               numeric(14,2)            not null,
  "discount_total"                              numeric(14,2)            not null,
  "tax_total"                                   numeric(14,2)            not null,
  "delivery_fee"                                numeric(14,2)            not null,
  "loyalty_redeemed"                            numeric(14,2)            not null default 0,
  "grand_total"                                 numeric(14,2)            not null,
  "customer_name_snapshot"                      text                     not null,
  "customer_phone_snapshot"                     text                     not null,
  "delivery_address_snapshot"                   jsonb,
  "latitude"                                    numeric(9,6),
  "longitude"                                   numeric(10,6),
  "customer_note"                               text,
  "restaurant_note"                             text,
  "placed_at"                                   timestamp with time zone,
  "accepted_at"                                 timestamp with time zone,
  "out_for_delivery_at"                         timestamp with time zone,
  "delivered_at"                                timestamp with time zone,
  "cancelled_at"                                timestamp with time zone,
  "cancel_reason"                               text,
  "delivery_zone_id"                            uuid,
  "delivery_distance_km"                        numeric(8,3),
  "normal_delivery_fee"                         numeric(14,2)            not null,
  "estimated_delivery_cost"                     numeric(14,2)            not null,
  "aggregator_benchmark_rate_snapshot"          numeric(7,4)             not null,
  "skrowia_commission_rate_snapshot"            numeric(7,4)             not null,
  "skrowia_commissionable_amount"               numeric(14,2)            not null,
  "estimated_delivery_minutes"                  smallint                 not null,
  "coupon_id"                                   uuid,
  "coupon_code_snapshot"                        text,
  "coupon_discount_amount"                      numeric(14,2)            not null default 0,
  "created_at"                                  timestamp with time zone not null default now(),
  "updated_at"                                  timestamp with time zone not null default now(),
  "payment_method"                              text                     not null,
  "delivery_contact_phone_snapshot"             text,
  "delivery_contact_method_snapshot"            text,
  "delivery_contact_telegram_username_snapshot" text,
  constraint "orders_amounts_check"
    check
    (((food_subtotal >= (0)::numeric) AND (discount_total >= (0)::numeric) AND (discount_total <= food_subtotal) AND (tax_total >= (0)::numeric) AND (delivery_fee >= (0)::numeric)
    AND (loyalty_redeemed >= (0)::numeric) AND (loyalty_redeemed <= (food_subtotal - discount_total)) AND (grand_total >= (0)::numeric) AND (normal_delivery_fee >= (0)::numeric)
    AND (estimated_delivery_cost >= (0)::numeric) AND (coupon_discount_amount >= (0)::numeric) AND (coupon_discount_amount = discount_total) AND
    (skrowia_commissionable_amount >= (0)::numeric))),
  constraint "orders_business_id_acquisition_source_id_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict,
  constraint "orders_business_id_coupon_id_fkey" foreign key (business_id, coupon_id) references ordering.coupons(business_id, id) on delete restrict,
  constraint "orders_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "orders_business_id_id_key" unique (business_id, id),
  constraint "orders_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict,
  constraint "orders_business_id_location_id_id_key" unique (business_id, location_id, id),
  constraint "orders_business_order_number_key" unique (business_id, order_number),
  constraint "orders_cancel_reason_check"
    check (((cancel_reason IS NULL) OR ((cancel_reason = btrim(cancel_reason)) AND ((char_length(cancel_reason) >= 1) AND (char_length(cancel_reason) <= 500))))),
  constraint "orders_coupon_snapshot_check" check ((((coupon_id IS NULL) AND (coupon_code_snapshot IS NULL) AND (coupon_discount_amount = (0)::numeric)) OR ((coupon_id IS
    NOT NULL) AND (coupon_code_snapshot IS NOT NULL) AND (coupon_code_snapshot = upper(btrim(coupon_code_snapshot)))))),
  constraint "orders_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "orders_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict,
  constraint "orders_customer_name_snapshot_check"
    check (((customer_name_snapshot = btrim(customer_name_snapshot)) AND ((char_length(customer_name_snapshot) >= 1) AND (char_length(customer_name_snapshot) <= 200)))),
  constraint "orders_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 2000))))),
  constraint "orders_customer_phone_snapshot_check" check ((customer_phone_snapshot ~ '^[+][1-9][0-9]{7,14}$'::text)),
  constraint "orders_customer_relationship_fkey" foreign key (business_id, customer_id, customer_business_id) references core.customer_businesses(business_id, customer_id, id)
    on delete restrict,
  constraint "orders_delivery_contact_method_snapshot_check"
    check (((delivery_contact_method_snapshot IS NULL) OR (delivery_contact_method_snapshot = ANY (ARRAY['phone'::text, 'whatsapp'::text, 'telegram'::text])))),
  constraint "orders_delivery_contact_phone_snapshot_check"
    check (((delivery_contact_phone_snapshot IS NULL) OR (delivery_contact_phone_snapshot ~ '^[+][1-9][0-9]{7,14}$'::text))),
  constraint "orders_delivery_contact_telegram_snapshot_check"
    check (((delivery_contact_telegram_username_snapshot IS NULL) OR (delivery_contact_telegram_username_snapshot ~ '^[A-Za-z0-9_]{5,32}$'::text))),
  constraint "orders_estimated_delivery_minutes_check" check (((estimated_delivery_minutes >= 1) AND (estimated_delivery_minutes <= 1440))),
  constraint "orders_fulfillment_shape_check" check ((((fulfillment_type = 'delivery'::text) AND (delivery_address_snapshot IS
    NOT NULL) AND (jsonb_typeof(delivery_address_snapshot) = 'object'::text) AND ((delivery_address_snapshot ->> 'schema_version'::text) = '1'::text) AND (latitude IS
    NOT NULL) AND ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)) AND (longitude IS
    NOT NULL) AND ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)) AND (delivery_zone_id IS NOT NULL) AND (delivery_distance_km IS
    NOT NULL) AND (delivery_distance_km >= (0)::numeric)) OR
    ((fulfillment_type = 'pickup'::text) AND (delivery_address_snapshot IS NULL) AND (latitude IS NULL) AND (longitude IS NULL) AND (delivery_zone_id IS NULL) AND
    (delivery_distance_km IS NULL) AND (delivery_fee = (0)::numeric) AND (normal_delivery_fee = (0)::numeric) AND (estimated_delivery_cost = (0)::numeric) AND
    (out_for_delivery_at IS NULL)))),
  constraint "orders_fulfillment_type_check" check ((fulfillment_type = ANY (ARRAY['delivery'::text, 'pickup'::text]))),
  constraint "orders_location_id_delivery_zone_id_fkey" foreign key (location_id, delivery_zone_id) references ordering.delivery_zones(location_id, id) on delete restrict,
  constraint "orders_order_number_check"
    check (((order_number = upper(btrim(order_number))) AND ((char_length(order_number) >= 8) AND (char_length(order_number) <= 40)) AND (order_number ~ '^[A-Z0-9-]+$'::text))),
  constraint "orders_payment_method_check" check ((payment_method = ANY (ARRAY['online'::text, 'cash'::text]))),
  constraint "orders_payment_status_check" check ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'partially_refunded'::text, 'refunded'::text]))),
  constraint "orders_pkey" primary key (id),
  constraint "orders_rate_snapshots_check"
    check
    ((((aggregator_benchmark_rate_snapshot >= (0)::numeric) AND (aggregator_benchmark_rate_snapshot <= (100)::numeric)) AND ((skrowia_commission_rate_snapshot >= (0)::numeric) AND
    (skrowia_commission_rate_snapshot <= (100)::numeric)))),
  constraint "orders_restaurant_note_check"
    check (((restaurant_note IS NULL) OR ((restaurant_note = btrim(restaurant_note)) AND ((char_length(restaurant_note) >= 1) AND (char_length(restaurant_note) <= 2000))))),
  constraint "orders_status_check"
    check
    ((status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'delivered'::text, 'needs_attention'::text,
    'cancelled'::text]))),
  constraint "orders_status_milestones_check" check ((((status = ANY (ARRAY['payment_pending'::text, 'cancelled'::text])) OR (placed_at IS
    NOT NULL)) AND ((status <> 'accepted'::text) OR (accepted_at IS NOT NULL)) AND ((status <> 'ready_for_pickup'::text) OR (accepted_at IS
    NOT NULL)) AND ((status <> 'out_for_delivery'::text) OR ((accepted_at IS NOT NULL) AND (out_for_delivery_at IS
    NOT NULL))) AND ((status <> 'delivered'::text) OR ((delivered_at IS NOT NULL) AND (accepted_at IS
    NOT NULL) AND ((fulfillment_type <> 'delivery'::text) OR (out_for_delivery_at IS NOT NULL)))) AND ((status <> 'cancelled'::text) OR ((cancelled_at IS
    NOT NULL) AND (cancel_reason IS
    NOT NULL))) AND ((accepted_at IS NULL) OR (placed_at IS NULL) OR (accepted_at >= placed_at)) AND
    ((out_for_delivery_at IS NULL) OR (accepted_at IS NULL) OR (out_for_delivery_at >= accepted_at)) AND
    ((delivered_at IS NULL) OR (COALESCE(out_for_delivery_at, accepted_at, placed_at) IS NULL) OR (delivered_at >= COALESCE(out_for_delivery_at, accepted_at, placed_at))) AND
    ((cancelled_at IS NULL) OR (placed_at IS NULL) OR (cancelled_at >= placed_at)))),
  constraint "orders_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."orders"
  enable row level security;

create index orders_business_coupon_created_idx on ordering.orders using btree (business_id, coupon_id, created_at desc, id)
  where (coupon_id is not null);

create index orders_business_customer_created_idx on ordering.orders using btree (business_id, customer_id, customer_business_id, created_at desc, id);

create index orders_business_location_created_idx on ordering.orders using btree (business_id, location_id, created_at desc, id desc);

create index orders_business_location_status_created_idx on ordering.orders using btree (business_id, location_id, status, created_at desc, id);

create index orders_business_payment_status_created_idx on ordering.orders using btree (business_id, payment_status, created_at desc, id);

create index orders_business_source_created_idx on ordering.orders using btree (business_id, acquisition_source_id, created_at desc, id)
  where (acquisition_source_id is not null);

create index orders_customer_created_idx on ordering.orders using btree (customer_id, created_at desc, id);

create index orders_location_zone_created_idx on ordering.orders using btree (location_id, delivery_zone_id, created_at desc, id)
  where (delivery_zone_id is not null);

create trigger orders_10_validate_financial_snapshot
  before insert on ordering.orders
  for each row
  execute function private.validate_order_financial_snapshot();

create trigger orders_15_validate_payment_method
  before insert on ordering.orders
  for each row
  execute function private.validate_order_payment_method();

create trigger orders_20_enforce_snapshot_immutability
  before update on ordering.orders
  for each row
  execute function private.enforce_order_snapshot_immutability();

create trigger orders_90_set_updated_at
  before update on ordering.orders
  for each row
  execute function private.set_updated_at();

create trigger orders_95_broadcast_change_insert
  after insert on ordering.orders
  for each row
  execute function ordering.broadcast_order_change();

create trigger orders_95_broadcast_change_update
  after update of status, payment_status on ordering.orders
  for each row
  when (((old.status IS DISTINCT FROM new.status) OR (old.payment_status IS DISTINCT FROM new.payment_status)))
  execute function ordering.broadcast_order_change();

create policy "orders_select_settings_managers" on "ordering"."orders"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(orders.location_id) as can_manage_sensitive_location_configuration));

grant select on table "ordering"."orders" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."orders" to "postgres", "service_role";

comment on column "ordering"."orders"."delivery_contact_method_snapshot" is 'Immutable fulfillment contact channel captured when the order is placed.';

comment on column "ordering"."orders"."delivery_contact_phone_snapshot" is 'Immutable E.164 fulfillment contact phone captured when the order is placed.';

comment on column "ordering"."orders"."delivery_contact_telegram_username_snapshot" is 'Immutable Telegram username (without @) captured when the order is placed.';

comment on table "ordering"."orders" is 'Immutable customer/catalog/financial snapshot plus mutable operational state.';
