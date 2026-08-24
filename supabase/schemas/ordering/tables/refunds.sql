create table "ordering"."refunds" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "order_id"           uuid                     not null,
  "payment_id"         uuid                     not null,
  "amount"             numeric(14,2)            not null,
  "method"             text                     not null,
  "status"             text                     not null,
  "reason"             text                     not null,
  "processed_by"       uuid,
  "external_reference" text,
  "processed_at"       timestamp with time zone,
  "created_at"         timestamp with time zone not null default now(),
  constraint "refunds_amount_check" check ((amount > (0)::numeric)),
  constraint "refunds_completion_check" check (((status <> 'completed'::text) OR (processed_at IS NOT NULL))),
  constraint "refunds_external_reference_check"
    check
    (((external_reference IS NULL) OR ((external_reference = btrim(external_reference)) AND ((char_length(external_reference) >= 1) AND (char_length(external_reference) <=
    255))))),
  constraint "refunds_method_check" check ((method = ANY (ARRAY['manual'::text, 'gateway'::text]))),
  constraint "refunds_order_id_payment_id_fkey" foreign key (order_id, payment_id) references ordering.payments(order_id, id) on delete restrict,
  constraint "refunds_pkey" primary key (id),
  constraint "refunds_processed_by_fkey" foreign key (processed_by) references core.users(id) on delete set null,
  constraint "refunds_reason_check" check (((reason = btrim(reason)) AND ((char_length(reason) >= 1) AND (char_length(reason) <= 1000)))),
  constraint "refunds_status_check" check ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);

alter table "ordering"."refunds"
  enable row level security;

create index refunds_order_payment_idx on ordering.refunds using btree (order_id, payment_id);

create index refunds_order_status_created_idx on ordering.refunds using btree (order_id, status, created_at desc, id);

create unique index refunds_payment_external_reference_key on ordering.refunds using btree (payment_id, lower(btrim(external_reference)))
  where (external_reference is not null);

create index refunds_payment_status_created_idx on ordering.refunds using btree (payment_id, status, created_at desc, id);

create index refunds_processed_by_idx on ordering.refunds using btree (processed_by, created_at desc, id)
  where (processed_by is not null);

create trigger refunds_20_validate_total
  before insert or update on ordering.refunds
  for each row
  execute function private.validate_refund_total();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."refunds" to "postgres", "service_role";

comment on table "ordering"."refunds" is 'Manual MVP refund responsibility and completion record, separate from cancellation.';
