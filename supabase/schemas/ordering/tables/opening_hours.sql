create table "ordering"."opening_hours" (
  "id"          uuid                     not null default gen_random_uuid(),
  "location_id" uuid                     not null,
  "day_of_week" smallint                 not null,
  "opens_at"    time without time zone,
  "closes_at"   time without time zone,
  "is_closed"   boolean                  not null default false,
  "created_at"  timestamp with time zone not null default now(),
  constraint "opening_hours_day_of_week_check" check (((day_of_week >= 1) AND (day_of_week <= 7))),
  constraint "opening_hours_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade,
  constraint "opening_hours_pkey" primary key (id),
  constraint "opening_hours_shape_check" check (((is_closed AND (opens_at IS NULL) AND (closes_at IS NULL)) OR ((NOT is_closed) AND (opens_at IS NOT NULL) AND (closes_at IS
    NOT NULL) AND (opens_at <> closes_at))))
);

alter table "ordering"."opening_hours"
  enable row level security;

create index opening_hours_location_day_time_idx on ordering.opening_hours using btree (location_id, day_of_week, opens_at, id);

create unique index opening_hours_one_closed_marker_key on ordering.opening_hours using btree (location_id, day_of_week)
  where is_closed;

create trigger opening_hours_10_enforce_identity
  before update on ordering.opening_hours
  for each row
  execute function private.enforce_phase_c_identity();

create trigger opening_hours_20_validate
  before insert or update on ordering.opening_hours
  for each row
  execute function private.validate_opening_hours();

create policy "opening_hours_delete_managers" on "ordering"."opening_hours"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(opening_hours.location_id) as can_manage_catalog_at_location));

create policy "opening_hours_insert_managers" on "ordering"."opening_hours"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(opening_hours.location_id) AS can_manage_catalog_at_location));

create policy "opening_hours_select_members" on "ordering"."opening_hours"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(opening_hours.location_id) as is_active_location_member));

create policy "opening_hours_update_managers" on "ordering"."opening_hours"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(opening_hours.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(opening_hours.location_id) AS can_manage_catalog_at_location));

grant delete, insert, select, update on table "ordering"."opening_hours" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."opening_hours" to "postgres", "service_role";

comment on table "ordering"."opening_hours" is 'ISO-weekday ordering intervals; overnight intervals belong to their start day.';
