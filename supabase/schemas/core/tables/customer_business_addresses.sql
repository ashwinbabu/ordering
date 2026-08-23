create table "core"."customer_business_addresses" (
  "id"                           uuid                     not null default gen_random_uuid(),
  "customer_business_id"         uuid                     not null,
  "business_id"                  uuid                     not null,
  "customer_id"                  uuid                     not null,
  "label"                        text                     not null,
  "recipient_name"               text                     not null,
  "recipient_phone"              text                     not null,
  "address_line_1"               text                     not null,
  "address_line_2"               text,
  "landmark"                     text,
  "locality"                     text                     not null,
  "city"                         text                     not null,
  "state"                        text                     not null,
  "postal_code"                  text,
  "latitude"                     numeric(9,6)             not null,
  "longitude"                    numeric(10,6)            not null,
  "delivery_instructions"        text,
  "is_default"                   boolean                  not null default false,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  "recipient_phone_e164"         text,
  "preferred_contact_method"     text,
  "telegram_username"            text,
  "recipient_phone_country_iso2" text,
  constraint "customer_business_addresses_contact_method_check"
    check (((preferred_contact_method IS NULL) OR (preferred_contact_method = ANY (ARRAY['phone'::text, 'whatsapp'::text, 'telegram'::text])))),
  constraint "customer_business_addresses_contact_requirements_check"
    check (((preferred_contact_method IS NULL) OR ((preferred_contact_method = ANY (ARRAY['phone'::text, 'whatsapp'::text])) AND (recipient_phone_e164 IS
    NOT NULL)) OR ((preferred_contact_method = 'telegram'::text) AND (recipient_phone_e164 IS NOT NULL) AND (telegram_username IS NOT NULL)))),
  constraint "customer_business_addresses_latitude_check" check (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
  constraint "customer_business_addresses_longitude_check" check (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
  constraint "customer_business_addresses_optional_text_check"
    check
    ((((address_line_2 IS NULL) OR ((address_line_2 = btrim(address_line_2)) AND ((char_length(address_line_2) >= 1) AND (char_length(address_line_2) <= 500)))) AND ((landmark IS
    NULL) OR ((landmark = btrim(landmark)) AND ((char_length(landmark) >= 1) AND (char_length(landmark) <= 500)))) AND
    ((postal_code IS NULL) OR ((postal_code = btrim(postal_code)) AND ((char_length(postal_code) >= 3) AND (char_length(postal_code) <= 20)))) AND
    ((delivery_instructions IS NULL) OR ((delivery_instructions = btrim(delivery_instructions)) AND ((char_length(delivery_instructions) >= 1) AND
    (char_length(delivery_instructions) <= 1000)))))),
  constraint "customer_business_addresses_phone_e164_check" check (((recipient_phone_e164 IS NULL) OR (recipient_phone_e164 ~ '^[+][1-9][0-9]{7,14}$'::text))),
  constraint "customer_business_addresses_pkey" primary key (id),
  constraint "customer_business_addresses_recipient_phone_country_iso2_check"
    check (((recipient_phone_country_iso2 IS NULL) OR (recipient_phone_country_iso2 ~ '^[A-Z]{2}$'::text))),
  constraint "customer_business_addresses_required_text_check"
    check
    (((label = btrim(label)) AND ((char_length(label) >= 1) AND (char_length(label) <= 80)) AND (recipient_name = btrim(recipient_name)) AND ((char_length(recipient_name) >= 1) AND
    (char_length(recipient_name) <= 200)) AND (recipient_phone = btrim(recipient_phone)) AND ((char_length(recipient_phone) >= 5) AND (char_length(recipient_phone) <= 32)) AND
    (address_line_1 = btrim(address_line_1)) AND ((char_length(address_line_1) >= 1) AND (char_length(address_line_1) <= 500)) AND (locality = btrim(locality)) AND
    ((char_length(locality) >= 1) AND (char_length(locality) <= 120)) AND (city = btrim(city)) AND ((char_length(city) >= 1) AND (char_length(city) <= 120)) AND
    (state = btrim(state)) AND ((char_length(state) >= 1) AND (char_length(state) <= 120)))),
  constraint "customer_business_addresses_telegram_username_check" check (((telegram_username IS NULL) OR (telegram_username ~ '^[A-Za-z0-9_]{5,32}$'::text))),
  constraint "customer_business_addresses_updated_at_check" check ((updated_at >= created_at)),
  constraint "customer_business_addresses_owner_fkey" foreign key (business_id, customer_id, customer_business_id) references core.customer_businesses(business_id, customer_id, id)
    on delete cascade
);

alter table "core"."customer_business_addresses"
  enable row level security;

create unique index customer_business_addresses_one_default_key on core.customer_business_addresses using btree (customer_business_id)
  where is_default;

create index customer_business_addresses_owner_fk_idx on core.customer_business_addresses using btree (business_id, customer_id, customer_business_id);

create index customer_business_addresses_relationship_created_idx on core.customer_business_addresses using btree (customer_business_id, created_at desc, id);

create trigger customer_business_addresses_20_enforce_identity
  before update on core.customer_business_addresses
  for each row
  execute function private.enforce_phase_b_identity();

create trigger customer_business_addresses_90_set_updated_at
  before update on core.customer_business_addresses
  for each row
  execute function private.set_updated_at();

create policy "customer_business_addresses_select_customer_or_member" on "core"."customer_business_addresses"
  for select
  to "authenticated"
  using
    ((( select private.is_customer_owner(customer_business_addresses.customer_id) as is_customer_owner) or ( select
    private.is_active_business_member(customer_business_addresses.business_id) as is_active_business_member)));

grant select on table "core"."customer_business_addresses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_business_addresses" to "postgres", "service_role";

comment on column "core"."customer_business_addresses"."preferred_contact_method" is 'How restaurant/rider should contact the recipient for this address: phone, whatsapp, or telegram.';

comment on column "core"."customer_business_addresses"."recipient_phone_e164" is 'Canonical E.164 phone for the recipient at this saved delivery address. Fulfillment contact, not authentication identity.';

comment on column "core"."customer_business_addresses"."telegram_username" is 'Telegram username without leading @; used only when preferred_contact_method=telegram.';

comment on table "core"."customer_business_addresses" is 'Saved delivery addresses isolated to one customer-business relationship.';
