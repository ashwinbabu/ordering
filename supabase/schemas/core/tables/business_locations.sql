create table "core"."business_locations" (
  "id"                uuid                     not null default gen_random_uuid(),
  "business_id"       uuid                     not null,
  "name"              text                     not null,
  "address_line_1"    text                     not null,
  "address_line_2"    text,
  "locality"          text,
  "city"              text                     not null,
  "state"             text                     not null,
  "postal_code"       text,
  "latitude"          numeric(9,6)             not null,
  "longitude"         numeric(10,6)            not null,
  "phone"             text,
  "is_active"         boolean                  not null default true,
  "created_at"        timestamp with time zone not null default now(),
  "storefront_domain" text,
  constraint "business_locations_business_id_id_key" unique (business_id, id),
  constraint "business_locations_latitude_check" check (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
  constraint "business_locations_longitude_check" check (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
  constraint "business_locations_optional_text_check"
    check
    ((((address_line_2 IS NULL) OR ((address_line_2 = btrim(address_line_2)) AND ((char_length(address_line_2) >= 1) AND (char_length(address_line_2) <= 500)))) AND ((locality IS
    NULL) OR ((locality = btrim(locality)) AND ((char_length(locality) >= 1) AND (char_length(locality) <= 120)))) AND
    ((postal_code IS NULL) OR ((postal_code = btrim(postal_code)) AND ((char_length(postal_code) >= 3) AND (char_length(postal_code) <= 20)))) AND
    ((phone IS NULL) OR ((phone = btrim(phone)) AND ((char_length(phone) >= 5) AND (char_length(phone) <= 32)))))),
  constraint "business_locations_pkey" primary key (id),
  constraint "business_locations_required_text_check"
    check
    (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)) AND (address_line_1 = btrim(address_line_1)) AND ((char_length(address_line_1) >= 1) AND
    (char_length(address_line_1) <= 500)) AND (city = btrim(city)) AND ((char_length(city) >= 1) AND (char_length(city) <= 120)) AND (state = btrim(state)) AND
    ((char_length(state) >= 1) AND (char_length(state) <= 120)))),
  constraint "business_locations_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict
);

alter table "core"."business_locations"
  enable row level security;

create index business_locations_business_active_idx on core.business_locations using btree (business_id, is_active, id);

create unique index business_locations_storefront_domain_unique on core.business_locations using btree (lower(storefront_domain))
  where (storefront_domain is not null);

create trigger business_locations_10_enforce_identity
  before update on core.business_locations
  for each row
  execute function private.enforce_business_location_identity();

create policy "business_locations_select_active_members" on "core"."business_locations"
  for select
  to "authenticated"
  using ((exists ( select 1
   from (core.business_users membership
     JOIN core.users operator_user on ((operator_user.id = membership.user_id)))
  where ((membership.business_id = business_locations.business_id) AND membership.is_active AND (operator_user.auth_user_id = ( select auth.uid() as uid))))));

create policy "business_locations_update_owners_admins" on "core"."business_locations"
  for update
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(business_locations.id) as can_manage_sensitive_location_configuration))
  with check (( SELECT private.can_manage_sensitive_location_configuration(business_locations.id) AS can_manage_sensitive_location_configuration));

grant select, update on table "core"."business_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."business_locations" to "postgres", "service_role";

comment on table "core"."business_locations" is 'Physical outlets belonging to a business tenant.';
