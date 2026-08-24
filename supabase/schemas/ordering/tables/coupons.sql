create table "ordering"."coupons" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "business_id"         uuid                     not null,
  "campaign_id"         uuid,
  "code"                text                     not null,
  "discount_type"       text                     not null,
  "discount_value"      numeric(14,4)            not null,
  "max_discount_amount" numeric(14,2),
  "minimum_order_value" numeric(14,2)            not null default 0,
  "is_active"           boolean                  not null default true,
  "starts_at"           timestamp with time zone,
  "ends_at"             timestamp with time zone,
  "created_by"          uuid,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "coupons_business_id_campaign_id_fkey" foreign key (business_id, campaign_id) references ordering.campaigns(business_id, id) on delete restrict,
  constraint "coupons_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "coupons_business_id_id_key" unique (business_id, id),
  constraint "coupons_code_check"
    check (((code = upper(btrim(code))) AND ((char_length(code) >= 2) AND (char_length(code) <= 100)) AND (code ~ '^[A-Z0-9]+([_-][A-Z0-9]+)*$'::text))),
  constraint "coupons_created_by_fkey" foreign key (created_by) references core.users(id) on delete set null,
  constraint "coupons_discount_configuration_check"
    check
    ((((discount_type = 'fixed'::text) AND (discount_value > (0)::numeric) AND (max_discount_amount IS NULL)) OR ((discount_type = 'percentage'::text) AND (discount_value >
    (0)::numeric) AND (discount_value <= (100)::numeric) AND ((max_discount_amount IS NULL) OR (max_discount_amount > (0)::numeric))))),
  constraint "coupons_discount_type_check" check ((discount_type = ANY (ARRAY['fixed'::text, 'percentage'::text]))),
  constraint "coupons_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "coupons_pkey" primary key (id),
  constraint "coupons_updated_at_check" check ((updated_at >= created_at)),
  constraint "coupons_window_check" check (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at < ends_at)))
);

alter table "ordering"."coupons"
  enable row level security;

create index coupons_business_active_window_idx on ordering.coupons using btree (business_id, is_active, starts_at, ends_at, id);

create index coupons_business_campaign_idx on ordering.coupons using btree (business_id, campaign_id)
  where (campaign_id is not null);

create unique index coupons_business_code_normalized_key on ordering.coupons using btree (business_id, lower(btrim(code)));

create index coupons_created_by_idx on ordering.coupons using btree (created_by)
  where (created_by is not null);

create trigger coupons_10_normalize_code
  before insert or update of code on ordering.coupons
  for each row
  execute function private.normalize_attribution_code();

create trigger coupons_20_enforce_identity_and_history
  before update on ordering.coupons
  for each row
  execute function private.enforce_coupon_identity_and_history();

create trigger coupons_90_set_updated_at
  before update on ordering.coupons
  for each row
  execute function private.set_updated_at();

create policy "coupons_insert_managers" on "ordering"."coupons"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_coupons(coupons.business_id) AS can_manage_coupons));

create policy "coupons_select_managers" on "ordering"."coupons"
  for select
  to "authenticated"
  using (( select private.can_manage_coupons(coupons.business_id) as can_manage_coupons));

create policy "coupons_update_managers" on "ordering"."coupons"
  for update
  to "authenticated"
  using (( select private.can_manage_coupons(coupons.business_id) as can_manage_coupons))
  with check (( SELECT private.can_manage_coupons(coupons.business_id) AS can_manage_coupons));

grant insert, select, update on table "ordering"."coupons" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."coupons" to "postgres", "service_role";

comment on table "ordering"."coupons" is 'Business-scoped V1 coupon definitions; one coupon may apply to a cart/order.';
