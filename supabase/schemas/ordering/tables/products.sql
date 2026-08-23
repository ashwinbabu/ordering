create table "ordering"."products" (
  "id"                uuid                     not null default gen_random_uuid(),
  "business_id"       uuid                     not null,
  "category_id"       uuid                     not null,
  "name"              text                     not null,
  "description"       text,
  "base_price"        numeric(14,2)            not null,
  "image_url"         text,
  "dietary_type"      text,
  "is_active"         boolean                  not null default true,
  "is_available"      boolean                  not null default true,
  "sort_order"        integer                  not null default 0,
  "prep_time_minutes" smallint,
  "created_at"        timestamp with time zone not null default now(),
  "updated_at"        timestamp with time zone not null default now(),
  constraint "products_base_price_check" check ((base_price >= (0)::numeric)),
  constraint "products_business_id_category_id_fkey" foreign key (business_id, category_id) references ordering.menu_categories(business_id, id) on delete restrict,
  constraint "products_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "products_description_check"
    check (((description IS NULL) OR ((description = btrim(description)) AND ((char_length(description) >= 1) AND (char_length(description) <= 2000))))),
  constraint "products_dietary_type_check"
    check (((dietary_type IS NULL) OR ((dietary_type = btrim(dietary_type)) AND ((char_length(dietary_type) >= 1) AND (char_length(dietary_type) <= 50))))),
  constraint "products_image_url_check"
    check (((image_url IS NULL) OR ((image_url = btrim(image_url)) AND ((char_length(image_url) >= 8) AND (char_length(image_url) <= 2048)) AND (image_url ~* '^https://'::text)))),
  constraint "products_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "products_pkey" primary key (id),
  constraint "products_prep_time_minutes_check" check (((prep_time_minutes IS NULL) OR ((prep_time_minutes >= 1) AND (prep_time_minutes <= 1440)))),
  constraint "products_sort_order_check" check ((sort_order >= 0)),
  constraint "products_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."products"
  enable row level security;

create index products_business_category_active_available_sort_idx on ordering.products using btree (business_id, category_id, is_active, is_available, sort_order, id);

create trigger products_10_enforce_identity
  before update on ordering.products
  for each row
  execute function private.enforce_phase_c_identity();

create trigger products_20_validate_category_assignment
  before update of category_id on ordering.products
  for each row
  execute function private.validate_product_category_assignment();

create trigger products_90_set_updated_at
  before update on ordering.products
  for each row
  execute function private.set_updated_at();

create policy "products_insert_managers" on "ordering"."products"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog(products.business_id) AS can_manage_catalog));

create policy "products_select_members" on "ordering"."products"
  for select
  to "authenticated"
  using (( select private.is_active_business_member(products.business_id) as is_active_business_member));

create policy "products_update_managers" on "ordering"."products"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog(products.business_id) as can_manage_catalog))
  with check (( SELECT private.can_manage_catalog(products.business_id) AS can_manage_catalog));

grant insert, select, update on table "ordering"."products" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."products" to "postgres", "service_role";

comment on table "ordering"."products" is 'Business catalog products with global active and sold-out controls.';
