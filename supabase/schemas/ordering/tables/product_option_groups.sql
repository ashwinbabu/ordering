create table "ordering"."product_option_groups" (
  "product_id"      uuid    not null,
  "option_group_id" uuid    not null,
  "sort_order"      integer not null default 0,
  constraint "product_option_groups_option_group_id_fkey" foreign key (option_group_id) references ordering.option_groups(id) on delete cascade,
  constraint "product_option_groups_pkey" primary key (product_id, option_group_id),
  constraint "product_option_groups_sort_order_check" check ((sort_order >= 0)),
  constraint "product_option_groups_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade
);

alter table "ordering"."product_option_groups"
  enable row level security;

create index product_option_groups_group_product_idx on ordering.product_option_groups using btree (option_group_id, product_id);

create trigger product_option_groups_10_enforce_identity
  before update on ordering.product_option_groups
  for each row
  execute function private.enforce_phase_c_identity();

create trigger product_option_groups_20_validate_tenant
  before insert or update on ordering.product_option_groups
  for each row
  execute function private.validate_phase_c_tenant_integrity();

create policy "product_option_groups_delete_managers" on "ordering"."product_option_groups"
  for delete
  to "authenticated"
  using ((exists ( select 1
   from ordering.products product
  where ((product.id = product_option_groups.product_id) AND ( select private.can_manage_catalog(product.business_id) as can_manage_catalog)))));

create policy "product_option_groups_insert_managers" on "ordering"."product_option_groups"
  for insert
  to "authenticated"
  with check ((EXISTS ( SELECT 1
   FROM ordering.products product
  WHERE ((product.id = product_option_groups.product_id) AND ( SELECT private.can_manage_catalog(product.business_id) AS can_manage_catalog)))));

create policy "product_option_groups_select_members" on "ordering"."product_option_groups"
  for select
  to "authenticated"
  using ((exists ( select 1
   from ordering.products product
  where ((product.id = product_option_groups.product_id) AND ( select private.is_active_business_member(product.business_id) as is_active_business_member)))));

create policy "product_option_groups_update_managers" on "ordering"."product_option_groups"
  for update
  to "authenticated"
  using ((exists ( select 1
   from ordering.products product
  where ((product.id = product_option_groups.product_id) AND ( select private.can_manage_catalog(product.business_id) as can_manage_catalog)))))
  with check ((EXISTS ( SELECT 1
   FROM ordering.products product
  WHERE ((product.id = product_option_groups.product_id) AND ( SELECT private.can_manage_catalog(product.business_id) AS can_manage_catalog)))));

grant delete, insert, select, update on table "ordering"."product_option_groups" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."product_option_groups" to "postgres", "service_role";

comment on table "ordering"."product_option_groups" is 'Many-to-many attachment of reusable option groups to products.';
