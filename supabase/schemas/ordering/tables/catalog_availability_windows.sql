create table "ordering"."catalog_availability_windows" (
  "id"          uuid                     not null default gen_random_uuid(),
  "location_id" uuid                     not null,
  "category_id" uuid,
  "product_id"  uuid,
  "day_of_week" smallint                 not null,
  "starts_at"   time without time zone   not null,
  "ends_at"     time without time zone   not null,
  "created_at"  timestamp with time zone not null default now(),
  constraint "catalog_availability_windows_day_of_week_check" check (((day_of_week >= 1) AND (day_of_week <= 7))),
  constraint "catalog_availability_windows_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "catalog_availability_windows_pkey" primary key (id),
  constraint "catalog_availability_windows_target_check" check (((category_id IS NULL) <> (product_id IS NULL))),
  constraint "catalog_availability_windows_time_check" check ((starts_at <> ends_at)),
  constraint "catalog_availability_windows_category_id_fkey" foreign key (category_id) references ordering.menu_categories(id) on delete cascade,
  constraint "catalog_availability_windows_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade
);

alter table "ordering"."catalog_availability_windows"
  enable row level security;

create unique index catalog_availability_windows_category_day_key on ordering.catalog_availability_windows using btree (category_id, location_id, day_of_week)
  where (category_id is not null);

create index catalog_availability_windows_location_day_category_idx on ordering.catalog_availability_windows using btree (location_id, day_of_week, category_id)
  where (category_id is not null);

create index catalog_availability_windows_location_day_product_idx on ordering.catalog_availability_windows using btree (location_id, day_of_week, product_id)
  where (product_id is not null);

create unique index catalog_availability_windows_product_day_key on ordering.catalog_availability_windows using btree (product_id, location_id, day_of_week)
  where (product_id is not null);

create trigger catalog_availability_windows_10_enforce_identity
  before update on ordering.catalog_availability_windows
  for each row
  execute function private.enforce_phase_c_identity();

create trigger catalog_availability_windows_20_validate_tenant
  before insert or update on ordering.catalog_availability_windows
  for each row
  execute function private.validate_phase_c_tenant_integrity();

create policy "catalog_availability_windows_delete_managers" on "ordering"."catalog_availability_windows"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(catalog_availability_windows.location_id) as can_manage_catalog_at_location));

create policy "catalog_availability_windows_insert_managers" on "ordering"."catalog_availability_windows"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(catalog_availability_windows.location_id) AS can_manage_catalog_at_location));

create policy "catalog_availability_windows_select_members" on "ordering"."catalog_availability_windows"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(catalog_availability_windows.location_id) as is_active_location_member));

create policy "catalog_availability_windows_update_managers" on "ordering"."catalog_availability_windows"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(catalog_availability_windows.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(catalog_availability_windows.location_id) AS can_manage_catalog_at_location));

grant delete, insert, select, update on table "ordering"."catalog_availability_windows" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."catalog_availability_windows" to "postgres", "service_role";

comment on table "ordering"."catalog_availability_windows" is 'Location-specific weekly category or product availability intervals.';
