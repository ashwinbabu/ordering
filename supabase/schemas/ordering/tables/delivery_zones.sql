create table "ordering"."delivery_zones" (
  "id"                      uuid          not null default gen_random_uuid(),
  "location_id"             uuid          not null,
  "name"                    text          not null,
  "min_distance_km"         numeric(8,3)  not null,
  "max_distance_km"         numeric(8,3)  not null,
  "delivery_fee"            numeric(14,2) not null,
  "free_delivery_threshold" numeric(14,2),
  "minimum_order_value"     numeric(14,2) not null default 0,
  "estimated_delivery_cost" numeric(14,2) not null,
  "is_active"               boolean       not null default true,
  "sort_order"              integer       not null default 0,
  constraint "delivery_zones_delivery_fee_check" check ((delivery_fee >= (0)::numeric)),
  constraint "delivery_zones_distance_window_check" check (((min_distance_km >= (0)::numeric) AND (max_distance_km > min_distance_km))),
  constraint "delivery_zones_estimated_delivery_cost_check" check ((estimated_delivery_cost >= (0)::numeric)),
  constraint "delivery_zones_free_delivery_threshold_check" check (((free_delivery_threshold IS NULL) OR (free_delivery_threshold >= (0)::numeric))),
  constraint "delivery_zones_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete restrict,
  constraint "delivery_zones_location_id_id_key" unique (location_id, id),
  constraint "delivery_zones_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "delivery_zones_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "delivery_zones_pkey" primary key (id),
  constraint "delivery_zones_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."delivery_zones"
  enable row level security;

create index delivery_zones_location_active_distance_idx on ordering.delivery_zones using btree (location_id, is_active, min_distance_km, max_distance_km, id);

create unique index delivery_zones_location_name_normalized_key on ordering.delivery_zones using btree (location_id, lower(btrim(name)));

create trigger delivery_zones_10_enforce_identity
  before update on ordering.delivery_zones
  for each row
  execute function private.enforce_phase_c_identity();

create trigger delivery_zones_20_validate
  before insert or update on ordering.delivery_zones
  for each row
  execute function private.validate_delivery_zone();

create policy "delivery_zones_delete_owners_admins" on "ordering"."delivery_zones"
  for delete
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(delivery_zones.location_id) as can_manage_sensitive_location_configuration));

create policy "delivery_zones_insert_owners_admins" on "ordering"."delivery_zones"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_sensitive_location_configuration(delivery_zones.location_id) AS can_manage_sensitive_location_configuration));

create policy "delivery_zones_select_owners_admins" on "ordering"."delivery_zones"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(delivery_zones.location_id) as can_manage_sensitive_location_configuration));

create policy "delivery_zones_update_owners_admins" on "ordering"."delivery_zones"
  for update
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(delivery_zones.location_id) as can_manage_sensitive_location_configuration))
  with check (( SELECT private.can_manage_sensitive_location_configuration(delivery_zones.location_id) AS can_manage_sensitive_location_configuration));

grant delete, insert, select, update on table "ordering"."delivery_zones" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."delivery_zones" to "postgres", "service_role";

comment on table "ordering"."delivery_zones" is 'Half-open radial delivery bands; estimated cost is private.';
