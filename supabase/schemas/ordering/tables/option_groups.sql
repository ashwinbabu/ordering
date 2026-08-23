create table "ordering"."option_groups" (
  "id"             uuid     not null default gen_random_uuid(),
  "business_id"    uuid     not null,
  "name"           text     not null,
  "selection_type" text     not null,
  "min_selections" smallint not null default 0,
  "max_selections" smallint not null,
  "sort_order"     integer  not null default 0,
  "is_active"      boolean  not null default true,
  constraint "option_groups_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "option_groups_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "option_groups_pkey" primary key (id),
  constraint "option_groups_selection_count_check"
    check (((min_selections >= 0) AND (max_selections >= 1) AND (min_selections <= max_selections) AND ((selection_type <> 'single'::text) OR (max_selections = 1)))),
  constraint "option_groups_selection_type_check" check ((selection_type = ANY (ARRAY['single'::text, 'multiple'::text]))),
  constraint "option_groups_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."option_groups"
  enable row level security;

create index option_groups_business_active_sort_idx on ordering.option_groups using btree (business_id, is_active, sort_order, id);

create unique index option_groups_business_name_normalized_key on ordering.option_groups using btree (business_id, lower(btrim(name)));

create trigger option_groups_10_enforce_identity
  before update on ordering.option_groups
  for each row
  execute function private.enforce_phase_c_identity();

create policy "option_groups_insert_managers" on "ordering"."option_groups"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog(option_groups.business_id) AS can_manage_catalog));

create policy "option_groups_select_members" on "ordering"."option_groups"
  for select
  to "authenticated"
  using (( select private.is_active_business_member(option_groups.business_id) as is_active_business_member));

create policy "option_groups_update_managers" on "ordering"."option_groups"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog(option_groups.business_id) as can_manage_catalog))
  with check (( SELECT private.can_manage_catalog(option_groups.business_id) AS can_manage_catalog));

grant insert, select, update on table "ordering"."option_groups" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."option_groups" to "postgres", "service_role";

comment on table "ordering"."option_groups" is 'Reusable business-level single- or multiple-choice product option groups.';
