create table "ordering"."location_featured_products" (
  "product_id"  uuid                     not null,
  "location_id" uuid                     not null,
  "sort_order"  integer                  not null default 0,
  "is_active"   boolean                  not null default true,
  "starts_at"   timestamp with time zone,
  "ends_at"     timestamp with time zone,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "location_featured_products_pkey" primary key (product_id, location_id),
  constraint "location_featured_products_schedule_check" check (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at))),
  constraint "location_featured_products_sort_order_check" check ((sort_order >= 0)),
  constraint "location_featured_products_updated_at_check" check ((updated_at >= created_at)),
  constraint "location_featured_products_product_location_fkey" foreign key (product_id, location_id) references ordering.product_locations(product_id, location_id)
    on delete cascade
);

alter table "ordering"."location_featured_products"
  enable row level security;

create index location_featured_products_active_location_sort_idx on ordering.location_featured_products using btree (location_id, sort_order, product_id)
  where is_active;

create trigger location_featured_products_90_set_updated_at
  before update on ordering.location_featured_products
  for each row
  execute function private.set_updated_at();

create policy "location_featured_products_delete_managers" on "ordering"."location_featured_products"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(location_featured_products.location_id) as can_manage_catalog_at_location));

create policy "location_featured_products_insert_managers" on "ordering"."location_featured_products"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(location_featured_products.location_id) AS can_manage_catalog_at_location));

create policy "location_featured_products_select_members" on "ordering"."location_featured_products"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(location_featured_products.location_id) as is_active_location_member));

create policy "location_featured_products_select_public" on "ordering"."location_featured_products"
  for select
  to "anon", "authenticated"
  using (((is_active = true) AND ((starts_at is null) or (starts_at <= now())) AND ((ends_at is null) or (ends_at > now()))));

create policy "location_featured_products_update_managers" on "ordering"."location_featured_products"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(location_featured_products.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(location_featured_products.location_id) AS can_manage_catalog_at_location));

grant select on table "ordering"."location_featured_products" to "anon";

grant delete, insert, select, update on table "ordering"."location_featured_products" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."location_featured_products" to "postgres", "service_role";
