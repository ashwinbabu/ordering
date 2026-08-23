create table "ordering"."coupon_locations" (
  "coupon_id"   uuid not null,
  "location_id" uuid not null,
  constraint "coupon_locations_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "coupon_locations_pkey" primary key (coupon_id, location_id),
  constraint "coupon_locations_coupon_id_fkey" foreign key (coupon_id) references ordering.coupons(id) on delete cascade
);

alter table "ordering"."coupon_locations"
  enable row level security;

create index coupon_locations_location_coupon_idx on ordering.coupon_locations using btree (location_id, coupon_id);

create trigger coupon_locations_20_validate_tenant
  before insert or update on ordering.coupon_locations
  for each row
  execute function private.validate_coupon_location_tenant();

create policy "coupon_locations_delete_managers" on "ordering"."coupon_locations"
  for delete
  to "authenticated"
  using (( select private.can_manage_coupon_mapping(coupon_locations.coupon_id, coupon_locations.location_id) as can_manage_coupon_mapping));

create policy "coupon_locations_insert_managers" on "ordering"."coupon_locations"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_coupon_mapping(coupon_locations.coupon_id, coupon_locations.location_id) AS can_manage_coupon_mapping));

create policy "coupon_locations_select_managers" on "ordering"."coupon_locations"
  for select
  to "authenticated"
  using (( select private.can_manage_coupon_mapping(coupon_locations.coupon_id, coupon_locations.location_id) as can_manage_coupon_mapping));

grant delete, insert, select on table "ordering"."coupon_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."coupon_locations" to "postgres", "service_role";

comment on table "ordering"."coupon_locations" is 'Optional coupon outlet allow-list; an empty mapping means all tenant outlets.';
