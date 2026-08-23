create table "ordering"."options" (
  "id"              uuid          not null default gen_random_uuid(),
  "option_group_id" uuid          not null,
  "name"            text          not null,
  "price_delta"     numeric(14,2) not null default 0,
  "is_active"       boolean       not null default true,
  "is_available"    boolean       not null default true,
  "sort_order"      integer       not null default 0,
  constraint "options_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "options_option_group_id_fkey" foreign key (option_group_id) references ordering.option_groups(id) on delete cascade,
  constraint "options_pkey" primary key (id),
  constraint "options_price_delta_check" check ((price_delta >= (0)::numeric)),
  constraint "options_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."options"
  enable row level security;

create index options_group_active_available_sort_idx on ordering.options using btree (option_group_id, is_active, is_available, sort_order, id);

create unique index options_group_name_normalized_key on ordering.options using btree (option_group_id, lower(btrim(name)));

create trigger options_10_enforce_identity
  before update on ordering.options
  for each row
  execute function private.enforce_phase_c_identity();

create policy "options_insert_managers" on "ordering"."options"
  for insert
  to "authenticated"
  with check ((EXISTS ( SELECT 1
   FROM ordering.option_groups option_group
  WHERE ((option_group.id = options.option_group_id) AND ( SELECT private.can_manage_catalog(option_group.business_id) AS can_manage_catalog)))));

create policy "options_select_members" on "ordering"."options"
  for select
  to "authenticated"
  using ((exists ( select 1
   from ordering.option_groups option_group
  where ((option_group.id = options.option_group_id) AND ( select private.is_active_business_member(option_group.business_id) as is_active_business_member)))));

create policy "options_update_managers" on "ordering"."options"
  for update
  to "authenticated"
  using ((exists ( select 1
   from ordering.option_groups option_group
  where ((option_group.id = options.option_group_id) AND ( select private.can_manage_catalog(option_group.business_id) as can_manage_catalog)))))
  with check ((EXISTS ( SELECT 1
   FROM ordering.option_groups option_group
  WHERE ((option_group.id = options.option_group_id) AND ( SELECT private.can_manage_catalog(option_group.business_id) AS can_manage_catalog)))));

grant insert, select, update on table "ordering"."options" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."options" to "postgres", "service_role";

comment on table "ordering"."options" is 'Customer-selectable options belonging to a reusable option group.';
