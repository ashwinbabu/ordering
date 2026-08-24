create table "ordering"."menu_categories" (
  "id"          uuid                     not null default gen_random_uuid(),
  "business_id" uuid                     not null,
  "location_id" uuid,
  "name"        text                     not null,
  "description" text,
  "sort_order"  integer                  not null default 0,
  "is_active"   boolean                  not null default true,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "menu_categories_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "menu_categories_business_id_id_key" unique (business_id, id),
  constraint "menu_categories_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict,
  constraint "menu_categories_description_check"
    check (((description IS NULL) OR ((description = btrim(description)) AND ((char_length(description) >= 1) AND (char_length(description) <= 1000))))),
  constraint "menu_categories_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "menu_categories_pkey" primary key (id),
  constraint "menu_categories_sort_order_check" check ((sort_order >= 0)),
  constraint "menu_categories_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."menu_categories"
  enable row level security;

create index menu_categories_business_location_active_sort_idx on ordering.menu_categories using btree (business_id, location_id, is_active, sort_order, id);

create unique index menu_categories_global_name_normalized_key on ordering.menu_categories using btree (business_id, lower(btrim(name)))
  where (location_id is null);

create unique index menu_categories_local_name_normalized_key on ordering.menu_categories using btree (business_id, location_id, lower(btrim(name)))
  where (location_id is not null);

create trigger menu_categories_10_enforce_identity
  before update on ordering.menu_categories
  for each row
  execute function private.enforce_phase_c_identity();

create trigger menu_categories_20_validate_scope
  before insert or update of business_id, location_id, name on ordering.menu_categories
  for each row
  execute function private.validate_menu_category_scope();

create trigger menu_categories_90_set_updated_at
  before update on ordering.menu_categories
  for each row
  execute function private.set_updated_at();

create policy "menu_categories_insert_managers" on "ordering"."menu_categories"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog(menu_categories.business_id) AS can_manage_catalog));

create policy "menu_categories_select_members" on "ordering"."menu_categories"
  for select
  to "authenticated"
  using (( select private.is_active_business_member(menu_categories.business_id) as is_active_business_member));

create policy "menu_categories_update_managers" on "ordering"."menu_categories"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog(menu_categories.business_id) as can_manage_catalog))
  with check (( SELECT private.can_manage_catalog(menu_categories.business_id) AS can_manage_catalog));

grant insert, select, update on table "ordering"."menu_categories" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."menu_categories" to "postgres", "service_role";

comment on table "ordering"."menu_categories" is 'Business-wide or outlet-specific customer-facing menu categories.';
