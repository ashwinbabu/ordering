create table "ordering"."payments" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "order_id"            uuid                     not null,
  "business_id"         uuid                     not null,
  "provider"            text                     not null,
  "provider_order_id"   text,
  "provider_payment_id" text,
  "status"              text                     not null,
  "amount"              numeric(14,2)            not null,
  "currency"            text                     not null,
  "method"              text,
  "gateway_payload"     jsonb                    not null default '{}'::jsonb,
  "gateway_fee"         numeric(14,2),
  "gateway_tax"         numeric(14,2),
  "paid_at"             timestamp with time zone,
  "failed_at"           timestamp with time zone,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "payments_amount_check" check ((amount > (0)::numeric)),
  constraint "payments_business_id_order_id_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete restrict,
  constraint "payments_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "payments_gateway_cost_check" check ((((gateway_fee IS NULL) OR (gateway_fee >= (0)::numeric)) AND ((gateway_tax IS NULL) OR (gateway_tax >= (0)::numeric)))),
  constraint "payments_gateway_payload_check" check (((jsonb_typeof(gateway_payload) = 'object'::text) AND (octet_length((gateway_payload)::text) <= 65536))),
  constraint "payments_method_check"
    check (((method IS NULL) OR ((method = lower(btrim(method))) AND ((char_length(method) >= 1) AND (char_length(method) <= 50)) AND (method ~ '^[a-z][a-z0-9_-]*$'::text)))),
  constraint "payments_order_id_id_key" unique (order_id, id),
  constraint "payments_pkey" primary key (id),
  constraint "payments_provider_check"
    check (((provider = lower(btrim(provider))) AND ((char_length(provider) >= 2) AND (char_length(provider) <= 50)) AND (provider ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "payments_provider_ids_check"
    check
    ((((provider_order_id IS NULL) OR ((provider_order_id = btrim(provider_order_id)) AND ((char_length(provider_order_id) >= 1) AND (char_length(provider_order_id) <= 255)))) AND
    ((provider_payment_id IS NULL) OR ((provider_payment_id = btrim(provider_payment_id)) AND ((char_length(provider_payment_id) >= 1) AND (char_length(provider_payment_id) <=
    255)))))),
  constraint "payments_status_check" check ((status = ANY (ARRAY['created'::text, 'pending'::text, 'authorized'::text, 'paid'::text, 'failed'::text, 'cancelled'::text]))),
  constraint "payments_status_timestamps_check" check ((((status <> 'paid'::text) OR (paid_at IS NOT NULL)) AND ((status <> 'failed'::text) OR (failed_at IS
    NOT NULL)) AND (NOT ((paid_at IS NOT NULL) AND (failed_at IS NOT NULL))))),
  constraint "payments_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."payments"
  enable row level security;

create index payments_business_order_created_idx on ordering.payments using btree (business_id, order_id, created_at desc, id);

create unique index payments_one_paid_per_order_key on ordering.payments using btree (order_id)
  where (status = 'paid'::text);

create unique index payments_provider_order_id_key on ordering.payments using btree (provider, provider_order_id)
  where (provider_order_id is not null);

create unique index payments_provider_payment_id_key on ordering.payments using btree (provider, provider_payment_id)
  where (provider_payment_id is not null);

create index payments_reconciliation_idx on ordering.payments using btree (status, updated_at, id)
  where (status = ANY (ARRAY['created'::text, 'pending'::text, 'authorized'::text]));

create trigger payments_15_validate_provider_route
  before insert on ordering.payments
  for each row
  execute function private.validate_payment_provider_route();

create trigger payments_20_enforce_identity
  before update on ordering.payments
  for each row
  execute function private.enforce_payment_identity();

create trigger payments_90_set_updated_at
  before update on ordering.payments
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."payments" to "postgres", "service_role";

comment on table "ordering"."payments" is 'Provider payment attempts; verified backend processing is idempotent.';
