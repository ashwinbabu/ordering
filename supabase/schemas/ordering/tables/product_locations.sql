create table "ordering"."product_locations" (
  "product_id"     uuid          not null,
  "location_id"    uuid          not null,
  "is_available"   boolean       not null default true,
  "price_override" numeric(14,2),
  constraint "product_locations_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "product_locations_pkey" primary key (product_id, location_id),
  constraint "product_locations_price_override_check" check (((price_override IS NULL) OR (price_override >= (0)::numeric))),
  constraint "product_locations_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade
);

alter table "ordering"."product_locations"
  enable row level security;

create index product_locations_location_available_product_idx on ordering.product_locations using btree (location_id, is_available, product_id);

create trigger product_locations_10_enforce_identity
  before update on ordering.product_locations
  for each row
  execute function private.enforce_phase_c_identity();

create trigger product_locations_20_validate_tenant
  before insert or update on ordering.product_locations
  for each row
  execute function private.validate_phase_c_tenant_integrity();

create policy "product_locations_delete_managers" on "ordering"."product_locations"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(product_locations.location_id) as can_manage_catalog_at_location));

create policy "product_locations_insert_managers" on "ordering"."product_locations"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(product_locations.location_id) AS can_manage_catalog_at_location));

create policy "product_locations_select_members" on "ordering"."product_locations"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(product_locations.location_id) as is_active_location_member));

create policy "product_locations_update_managers" on "ordering"."product_locations"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(product_locations.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(product_locations.location_id) AS can_manage_catalog_at_location));

grant delete, insert, select, update on table "ordering"."product_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."product_locations" to "postgres", "service_role";

comment on table "ordering"."product_locations" is 'Optional outlet-level price and availability overrides for products.';
