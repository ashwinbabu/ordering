set local check_function_bodies = off;

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "service_role";

create schema "core";

create schema "notifications";

create schema "ordering";

create schema "private";

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
    ((char_length(state) >= 1) AND (char_length(state) <= 120))))
);

alter table "core"."business_locations"
  enable row level security;

create table "core"."business_users" (
  "id"          uuid                     not null default gen_random_uuid(),
  "user_id"     uuid                     not null,
  "business_id" uuid                     not null,
  "role"        text                     not null,
  "is_active"   boolean                  not null default true,
  "created_at"  timestamp with time zone not null default now(),
  constraint "business_users_business_id_user_id_key" unique (business_id, user_id),
  constraint "business_users_pkey" primary key (id),
  constraint "business_users_role_check" check ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text])))
);

alter table "core"."business_users"
  enable row level security;

create table "core"."businesses" (
  "id"         uuid                     not null default gen_random_uuid(),
  "name"       text                     not null,
  "slug"       text                     not null,
  "status"     text                     not null,
  "timezone"   text                     not null,
  "currency"   text                     not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "logo_url"   text,
  constraint "businesses_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "businesses_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "businesses_pkey" primary key (id),
  constraint "businesses_slug_check" check (((slug = btrim(slug)) AND ((char_length(slug) >= 2) AND (char_length(slug) <= 100)) AND (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text))),
  constraint "businesses_status_check" check ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'archived'::text]))),
  constraint "businesses_timezone_check" check (((timezone = btrim(timezone)) AND ((char_length(timezone) >= 1) AND (char_length(timezone) <= 100)))),
  constraint "businesses_updated_at_check" check ((updated_at >= created_at))
);

alter table "core"."businesses"
  enable row level security;

create table "core"."customer_auth_verifications" (
  "id"              uuid                     not null default gen_random_uuid(),
  "token_hash"      text                     not null,
  "identifier_e164" text                     not null,
  "channel"         text                     not null default 'sms'::text,
  "customer_id"     uuid,
  "created_at"      timestamp with time zone not null default now(),
  constraint "customer_auth_verifications_channel_check" check ((channel = ANY (ARRAY['sms'::text, 'email'::text]))),
  constraint "customer_auth_verifications_identifier_e164_check" check ((identifier_e164 ~ '^[+][1-9][0-9]{7,14}$'::text)),
  constraint "customer_auth_verifications_pkey" primary key (id),
  constraint "customer_auth_verifications_token_hash_key" unique (token_hash)
);

alter table "core"."customer_auth_verifications"
  enable row level security;

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
  constraint "customer_business_addresses_updated_at_check" check ((updated_at >= created_at))
);

alter table "core"."customer_business_addresses"
  enable row level security;

create table "core"."customer_businesses" (
  "id"                             uuid                     not null default gen_random_uuid(),
  "business_id"                    uuid                     not null,
  "customer_id"                    uuid                     not null,
  "first_seen_at"                  timestamp with time zone not null,
  "last_seen_at"                   timestamp with time zone not null,
  "first_order_at"                 timestamp with time zone,
  "last_order_at"                  timestamp with time zone,
  "order_count"                    integer                  not null default 0,
  "lifetime_order_value"           numeric(14,2)            not null default 0,
  "status"                         text                     not null,
  "original_acquisition_source_id" uuid,
  "created_at"                     timestamp with time zone not null default now(),
  constraint "customer_businesses_business_customer_id_id_key" unique (business_id, customer_id, id),
  constraint "customer_businesses_business_id_customer_id_key" unique (business_id, customer_id),
  constraint "customer_businesses_lifetime_value_check" check ((lifetime_order_value >= (0)::numeric)),
  constraint "customer_businesses_order_count_check" check ((order_count >= 0)),
  constraint "customer_businesses_order_window_check" check (((first_order_at IS NULL) OR (last_order_at IS NULL) OR (first_order_at <= last_order_at))),
  constraint "customer_businesses_pkey" primary key (id),
  constraint "customer_businesses_seen_window_check" check ((first_seen_at <= last_seen_at)),
  constraint "customer_businesses_status_check" check ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'blocked'::text])))
);

alter table "core"."customer_businesses"
  enable row level security;

create table "core"."customers" (
  "id"                           uuid                     not null default gen_random_uuid(),
  "auth_user_id"                 uuid,
  "phone_e164"                   text,
  "email"                        text,
  "display_name"                 text,
  "phone_verified_at"            timestamp with time zone,
  "email_verified_at"            timestamp with time zone,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  "preferred_contact_phone_e164" text,
  "preferred_contact_method"     text,
  constraint "customers_display_name_check"
    check (((display_name IS NULL) OR ((display_name = btrim(display_name)) AND ((char_length(display_name) >= 1) AND (char_length(display_name) <= 200))))),
  constraint "customers_email_check" check (((email IS NULL) OR ((email = btrim(email)) AND ((char_length(email) >= 3) AND (char_length(email) <= 320))))),
  constraint "customers_phone_e164_check" check ((phone_e164 ~ '^[+][1-9][0-9]{7,14}$'::text)),
  constraint "customers_phone_e164_key" unique (phone_e164),
  constraint "customers_pkey" primary key (id),
  constraint "customers_preferred_contact_method_check" check (((preferred_contact_method IS NULL) OR (preferred_contact_method = ANY (ARRAY['phone'::text, 'whatsapp'::text])))),
  constraint "customers_preferred_contact_pair_check" check ((((preferred_contact_phone_e164 IS NULL) AND (preferred_contact_method IS NULL)) OR ((preferred_contact_phone_e164 IS
    NOT NULL) AND (preferred_contact_method IS NOT NULL)))),
  constraint "customers_preferred_contact_phone_e164_check" check (((preferred_contact_phone_e164 IS NULL) OR (preferred_contact_phone_e164 ~ '^[+][1-9][0-9]{7,14}$'::text))),
  constraint "customers_updated_at_check" check ((updated_at >= created_at))
);

alter table "core"."customers"
  enable row level security;

create table "core"."users" (
  "id"           uuid                     not null default gen_random_uuid(),
  "auth_user_id" uuid,
  "name"         text                     not null,
  "email"        text,
  "phone"        text,
  "created_at"   timestamp with time zone not null default now(),
  constraint "users_email_check" check (((email IS NULL) OR ((email = btrim(email)) AND ((char_length(email) >= 3) AND (char_length(email) <= 320))))),
  constraint "users_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "users_phone_check" check (((phone IS NULL) OR ((phone = btrim(phone)) AND ((char_length(phone) >= 5) AND (char_length(phone) <= 32))))),
  constraint "users_pkey" primary key (id)
);

alter table "core"."users"
  enable row level security;

create table "notifications"."business_preferences" (
  "business_id"                  uuid                     not null,
  "notify_owner_on_cancellation" boolean                  not null default false,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  constraint "business_preferences_pkey" primary key (business_id)
);

alter table "notifications"."business_preferences"
  enable row level security;

create table "notifications"."deliveries" (
  "id"                       uuid                     not null default gen_random_uuid(),
  "event_id"                 uuid                     not null,
  "business_id"              uuid                     not null,
  "location_id"              uuid,
  "channel"                  text                     not null,
  "template_key"             text                     not null,
  "recipient_type"           text                     not null,
  "recipient_id"             uuid,
  "recipient_address"        text,
  "locale"                   text                     not null default 'en-IN'::text,
  "payload"                  jsonb                    not null default '{}'::jsonb,
  "status"                   text                     not null default 'pending'::text,
  "skip_reason"              text,
  "attempt_count"            integer                  not null default 0,
  "next_attempt_at"          timestamp with time zone not null default now(),
  "sending_started_at"       timestamp with time zone,
  "sending_lease_expires_at" timestamp with time zone,
  "last_error"               text,
  "provider"                 text,
  "provider_message_id"      text,
  "created_at"               timestamp with time zone not null default now(),
  "updated_at"               timestamp with time zone not null default now(),
  "sent_at"                  timestamp with time zone,
  constraint "deliveries_channel_check" check ((channel = ANY (ARRAY['email'::text, 'telegram'::text]))),
  constraint "deliveries_pkey" primary key (id),
  constraint "deliveries_recipient_type_check"
    check ((recipient_type = ANY (ARRAY['customer'::text, 'business_user'::text, 'location_admins'::text, 'email'::text, 'staff_group'::text, 'business_owner'::text]))),
  constraint "deliveries_status_check" check ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'skipped'::text, 'dead'::text]))),
  constraint "notifications_deliveries_address_required_check" check (((status = 'skipped'::text) OR (recipient_address IS NOT NULL))),
  constraint "notifications_deliveries_skip_reason_check" check (((status = 'skipped'::text) = (skip_reason IS NOT NULL)))
);

alter table "notifications"."deliveries"
  enable row level security;

create table "notifications"."events" (
  "id"                        uuid                     not null default gen_random_uuid(),
  "event_type"                text                     not null,
  "entity_type"               text                     not null,
  "entity_id"                 uuid                     not null,
  "business_id"               uuid                     not null,
  "location_id"               uuid,
  "source_event_id"           uuid,
  "dedupe_key"                text                     not null,
  "occurred_at"               timestamp with time zone not null,
  "payload"                   jsonb                    not null default '{}'::jsonb,
  "status"                    text                     not null default 'pending'::text,
  "attempt_count"             integer                  not null default 0,
  "planning_started_at"       timestamp with time zone,
  "planning_lease_expires_at" timestamp with time zone,
  "next_attempt_at"           timestamp with time zone not null default now(),
  "last_error"                text,
  "planned_at"                timestamp with time zone,
  "created_at"                timestamp with time zone not null default now(),
  "updated_at"                timestamp with time zone not null default now(),
  constraint "events_entity_type_check" check ((entity_type = ANY (ARRAY['order'::text, 'location'::text]))),
  constraint "events_event_type_check"
    check
    ((event_type = ANY (ARRAY['order.placed'::text, 'order.cancelled'::text, 'order.waiting_3m'::text, 'order.waiting_8m'::text, 'store.paused'::text, 'store.resumed'::text,
    'sales.daily_summary'::text]))),
  constraint "events_pkey" primary key (id),
  constraint "events_status_check" check ((status = ANY (ARRAY['pending'::text, 'planning'::text, 'planned'::text, 'failed'::text, 'dead'::text]))),
  constraint "notifications_events_dedupe_key_key" unique (dedupe_key),
  constraint "notifications_events_source_event_id_key" unique (source_event_id)
);

alter table "notifications"."events"
  enable row level security;

create table "notifications"."settings" (
  "id"                           boolean                  not null default true,
  "email_provider"               text                     not null default 'resend'::text,
  "email_from_address"           text                     not null default 'onboarding@resend.dev'::text,
  "email_from_name_fallback"     text                     not null default 'A2 Food and Beverages'::text,
  "email_reply_to"               text,
  "notifications_email_mode"     text                     not null default 'redirect'::text,
  "notifications_dev_recipient"  text,
  "notifications_environment"    text                     not null default 'development'::text,
  "dev_default_storefront_url"   text                     default 'https://ordering-storefront-dev.vercel.app'::text,
  "resend_api_key_secret_id"     uuid,
  "dispatcher_auth_secret_id"    uuid,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  "telegram_bot_token_secret_id" uuid,
  "telegram_webhook_secret_id"   uuid,
  "telegram_bot_username"        text,
  "notifications_telegram_mode"  text                     not null default 'log'::text,
  constraint "notifications_settings_singleton_check" check (id),
  constraint "settings_notifications_email_mode_check" check ((notifications_email_mode = ANY (ARRAY['off'::text, 'log'::text, 'redirect'::text, 'live'::text]))),
  constraint "settings_notifications_environment_check" check ((notifications_environment = ANY (ARRAY['development'::text, 'production'::text]))),
  constraint "settings_notifications_telegram_mode_check" check ((notifications_telegram_mode = ANY (ARRAY['off'::text, 'log'::text, 'live'::text]))),
  constraint "settings_pkey" primary key (id)
);

alter table "notifications"."settings"
  enable row level security;

create table "notifications"."telegram_destinations" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "business_id"         uuid                     not null,
  "location_id"         uuid,
  "destination_type"    text                     not null,
  "business_user_id"    uuid,
  "telegram_chat_id"    text                     not null,
  "telegram_user_id"    text,
  "telegram_chat_type"  text                     not null,
  "telegram_chat_title" text,
  "is_active"           boolean                  not null default true,
  "connected_at"        timestamp with time zone not null default now(),
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "telegram_destinations_destination_type_check" check ((destination_type = ANY (ARRAY['staff_group'::text, 'business_user'::text]))),
  constraint "telegram_destinations_pkey" primary key (id),
  constraint "telegram_destinations_shape_check" check ((((destination_type = 'staff_group'::text) AND (location_id IS
    NOT NULL) AND (business_user_id IS NULL) AND (telegram_chat_type = ANY (ARRAY['group'::text, 'supergroup'::text]))) OR
    ((destination_type = 'business_user'::text) AND (business_user_id IS NOT NULL) AND (telegram_chat_type = 'private'::text)))),
  constraint "telegram_destinations_telegram_chat_type_check" check ((telegram_chat_type = ANY (ARRAY['private'::text, 'group'::text, 'supergroup'::text])))
);

alter table "notifications"."telegram_destinations"
  enable row level security;

create table "notifications"."telegram_pairing_tokens" (
  "id"               uuid                     not null default gen_random_uuid(),
  "token_hash"       text                     not null,
  "business_id"      uuid                     not null,
  "location_id"      uuid,
  "destination_type" text                     not null,
  "business_user_id" uuid,
  "expires_at"       timestamp with time zone not null,
  "consumed_at"      timestamp with time zone,
  "created_by"       uuid,
  "created_at"       timestamp with time zone not null default now(),
  constraint "telegram_pairing_tokens_destination_type_check" check ((destination_type = ANY (ARRAY['staff_group'::text, 'business_user'::text]))),
  constraint "telegram_pairing_tokens_pkey" primary key (id),
  constraint "telegram_pairing_tokens_shape_check" check ((((destination_type = 'staff_group'::text) AND (location_id IS
    NOT NULL) AND (business_user_id IS NULL)) OR ((destination_type = 'business_user'::text) AND (business_user_id IS NOT NULL)))),
  constraint "telegram_pairing_tokens_token_hash_key" unique (token_hash)
);

alter table "notifications"."telegram_pairing_tokens"
  enable row level security;

create table "notifications"."telegram_webhook_updates" (
  "update_id"   bigint                   not null,
  "received_at" timestamp with time zone not null default now(),
  constraint "telegram_webhook_updates_pkey" primary key (update_id)
);

alter table "notifications"."telegram_webhook_updates"
  enable row level security;

create table "ordering"."acquisition_sources" (
  "id"          uuid    not null default gen_random_uuid(),
  "business_id" uuid    not null,
  "campaign_id" uuid,
  "code"        text    not null,
  "name"        text    not null,
  "channel"     text    not null,
  "is_active"   boolean not null default true,
  constraint "acquisition_sources_business_id_id_key" unique (business_id, id),
  constraint "acquisition_sources_channel_check"
    check (((channel = lower(btrim(channel))) AND ((char_length(channel) >= 1) AND (char_length(channel) <= 50)) AND (channel ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "acquisition_sources_code_check"
    check (((code = upper(btrim(code))) AND ((char_length(code) >= 2) AND (char_length(code) <= 100)) AND (code ~ '^[A-Z0-9]+([_-][A-Z0-9]+)*$'::text))),
  constraint "acquisition_sources_direct_check" check (((code <> 'DIRECT'::text) OR ((campaign_id IS NULL) AND (channel = 'direct'::text) AND is_active))),
  constraint "acquisition_sources_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "acquisition_sources_pkey" primary key (id)
);

alter table "ordering"."acquisition_sources"
  enable row level security;

create table "ordering"."analytics_events" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "business_id"           uuid                     not null,
  "location_id"           uuid,
  "session_id"            uuid                     not null,
  "customer_id"           uuid,
  "cart_id"               uuid,
  "order_id"              uuid,
  "acquisition_source_id" uuid,
  "event_name"            text                     not null,
  "metadata"              jsonb                    not null default '{}'::jsonb,
  "occurred_at"           timestamp with time zone not null default now(),
  constraint "analytics_events_cart_requires_location_check" check (((cart_id IS NULL) OR (location_id IS NOT NULL))),
  constraint "analytics_events_event_name_check"
    check
    ((event_name = ANY (ARRAY['menu_viewed'::text, 'item_added_to_cart'::text, 'cart_viewed'::text, 'checkout_started'::text, 'payment_started'::text, 'order_placed'::text,
    'payment_failed'::text, 'otp_failed'::text, 'delivery_unserviceable'::text, 'location_permission_denied'::text]))),
  constraint "analytics_events_metadata_check"
    check
    (((jsonb_typeof(metadata) = 'object'::text) AND (octet_length((metadata)::text) <= 16384) AND ((metadata = '{}'::jsonb) OR ((metadata ? 'schema_version'::text) AND
    (jsonb_typeof((metadata -> 'schema_version'::text)) = 'number'::text) AND ((metadata ->> 'schema_version'::text) = '1'::text))))),
  constraint "analytics_events_order_placed_requires_order_check" check (((event_name <> 'order_placed'::text) OR (order_id IS NOT NULL))),
  constraint "analytics_events_pkey" primary key (id)
);

alter table "ordering"."analytics_events"
  enable row level security;

create table "ordering"."campaigns" (
  "id"          uuid                     not null default gen_random_uuid(),
  "business_id" uuid                     not null,
  "name"        text                     not null,
  "code"        text                     not null,
  "status"      text                     not null,
  "starts_at"   timestamp with time zone,
  "ends_at"     timestamp with time zone,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "campaigns_business_id_id_key" unique (business_id, id),
  constraint "campaigns_code_check"
    check (((code = upper(btrim(code))) AND ((char_length(code) >= 2) AND (char_length(code) <= 100)) AND (code ~ '^[A-Z0-9]+([_-][A-Z0-9]+)*$'::text))),
  constraint "campaigns_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "campaigns_pkey" primary key (id),
  constraint "campaigns_status_check" check ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text, 'archived'::text]))),
  constraint "campaigns_updated_at_check" check ((updated_at >= created_at)),
  constraint "campaigns_window_check" check (((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at > starts_at)))
);

alter table "ordering"."campaigns"
  enable row level security;

create table "ordering"."cart_item_options" (
  "cart_item_id" uuid    not null,
  "option_id"    uuid    not null,
  "quantity"     integer not null default 1,
  constraint "cart_item_options_pkey" primary key (cart_item_id, option_id),
  constraint "cart_item_options_quantity_check" check ((quantity > 0))
);

alter table "ordering"."cart_item_options"
  enable row level security;

create table "ordering"."cart_items" (
  "id"            uuid                     not null default gen_random_uuid(),
  "cart_id"       uuid                     not null,
  "product_id"    uuid                     not null,
  "quantity"      integer                  not null,
  "customer_note" text,
  "created_at"    timestamp with time zone not null default now(),
  "updated_at"    timestamp with time zone not null default now(),
  constraint "cart_items_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 1000))))),
  constraint "cart_items_pkey" primary key (id),
  constraint "cart_items_quantity_check" check ((quantity > 0)),
  constraint "cart_items_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."cart_items"
  enable row level security;

create table "ordering"."carts" (
  "id"                    uuid                     not null default gen_random_uuid(),
  "business_id"           uuid                     not null,
  "location_id"           uuid                     not null,
  "customer_id"           uuid,
  "customer_business_id"  uuid,
  "anonymous_session_id"  uuid,
  "status"                text                     not null default 'active'::text,
  "acquisition_source_id" uuid,
  "coupon_id"             uuid,
  "created_at"            timestamp with time zone not null default now(),
  "updated_at"            timestamp with time zone not null default now(),
  "expires_at"            timestamp with time zone not null,
  "converted_order_id"    uuid,
  constraint "carts_business_id_location_id_id_key" unique (business_id, location_id, id),
  constraint "carts_conversion_check" check ((((status = 'converted'::text) AND (converted_order_id IS
    NOT NULL)) OR ((status <> 'converted'::text) AND (converted_order_id IS NULL)))),
  constraint "carts_expiry_check" check ((expires_at > created_at)),
  constraint "carts_identity_check" check ((((anonymous_session_id IS NOT NULL) OR (customer_id IS NOT NULL)) AND ((customer_id IS NULL) = (customer_business_id IS NULL)))),
  constraint "carts_pkey" primary key (id),
  constraint "carts_status_check" check ((status = ANY (ARRAY['active'::text, 'converted'::text, 'abandoned'::text, 'expired'::text]))),
  constraint "carts_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."carts"
  enable row level security;

create table "ordering"."catalog_availability_windows" (
  "id"          uuid                     not null default gen_random_uuid(),
  "location_id" uuid                     not null,
  "category_id" uuid,
  "product_id"  uuid,
  "day_of_week" smallint                 not null,
  "starts_at"   time without time zone   not null,
  "ends_at"     time without time zone   not null,
  "created_at"  timestamp with time zone not null default now(),
  constraint "catalog_availability_windows_day_of_week_check" check (((day_of_week >= 1) AND (day_of_week <= 7))),
  constraint "catalog_availability_windows_pkey" primary key (id),
  constraint "catalog_availability_windows_target_check" check (((category_id IS NULL) <> (product_id IS NULL))),
  constraint "catalog_availability_windows_time_check" check ((starts_at <> ends_at))
);

alter table "ordering"."catalog_availability_windows"
  enable row level security;

create table "ordering"."coupon_locations" (
  "coupon_id"   uuid not null,
  "location_id" uuid not null,
  constraint "coupon_locations_pkey" primary key (coupon_id, location_id)
);

alter table "ordering"."coupon_locations"
  enable row level security;

create table "ordering"."coupons" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "business_id"         uuid                     not null,
  "campaign_id"         uuid,
  "code"                text                     not null,
  "discount_type"       text                     not null,
  "discount_value"      numeric(14,4)            not null,
  "max_discount_amount" numeric(14,2),
  "minimum_order_value" numeric(14,2)            not null default 0,
  "is_active"           boolean                  not null default true,
  "starts_at"           timestamp with time zone,
  "ends_at"             timestamp with time zone,
  "created_by"          uuid,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "coupons_business_id_id_key" unique (business_id, id),
  constraint "coupons_code_check"
    check (((code = upper(btrim(code))) AND ((char_length(code) >= 2) AND (char_length(code) <= 100)) AND (code ~ '^[A-Z0-9]+([_-][A-Z0-9]+)*$'::text))),
  constraint "coupons_discount_configuration_check"
    check
    ((((discount_type = 'fixed'::text) AND (discount_value > (0)::numeric) AND (max_discount_amount IS NULL)) OR ((discount_type = 'percentage'::text) AND (discount_value >
    (0)::numeric) AND (discount_value <= (100)::numeric) AND ((max_discount_amount IS NULL) OR (max_discount_amount > (0)::numeric))))),
  constraint "coupons_discount_type_check" check ((discount_type = ANY (ARRAY['fixed'::text, 'percentage'::text]))),
  constraint "coupons_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "coupons_pkey" primary key (id),
  constraint "coupons_updated_at_check" check ((updated_at >= created_at)),
  constraint "coupons_window_check" check (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at < ends_at)))
);

alter table "ordering"."coupons"
  enable row level security;

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
  constraint "delivery_zones_location_id_id_key" unique (location_id, id),
  constraint "delivery_zones_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "delivery_zones_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "delivery_zones_pkey" primary key (id),
  constraint "delivery_zones_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."delivery_zones"
  enable row level security;

create table "ordering"."location_featured_products" (
  "product_id"  uuid                     not null,
  "location_id" uuid                     not null,
  "sort_order"  integer                  not null default 0,
  "is_active"   boolean                  not null default true,
  "starts_at"   timestamp with time zone,
  "ends_at"     timestamp with time zone,
  "created_at"  timestamp with time zone not null default now(),
  "updated_at"  timestamp with time zone not null default now(),
  constraint "location_featured_products_pkey" primary key (product_id, location_id),
  constraint "location_featured_products_schedule_check" check (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at))),
  constraint "location_featured_products_sort_order_check" check ((sort_order >= 0)),
  constraint "location_featured_products_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."location_featured_products"
  enable row level security;

create table "ordering"."location_payment_providers" (
  "id"                     uuid                     not null default gen_random_uuid(),
  "location_id"            uuid                     not null,
  "provider"               text                     not null,
  "configuration_status"   text                     not null default 'pending'::text,
  "is_active"              boolean                  not null default false,
  "provider_account_id"    text,
  "public_config"          jsonb                    not null default '{}'::jsonb,
  "credentials_secret_id"  uuid,
  "created_at"             timestamp with time zone not null default now(),
  "updated_at"             timestamp with time zone not null default now(),
  "auth_mode"              text                     not null default 'api_key'::text,
  "environment"            text                     not null default 'test'::text,
  "webhook_secret_id"      uuid,
  "credentials_expires_at" timestamp with time zone,
  constraint "location_payment_providers_account_check"
    check
    (((provider_account_id IS NULL) OR ((provider_account_id = btrim(provider_account_id)) AND ((char_length(provider_account_id) >= 1) AND (char_length(provider_account_id) <=
    255))))),
  constraint "location_payment_providers_api_key_expiry_check" check (((auth_mode <> 'api_key'::text) OR (credentials_expires_at IS NULL))),
  constraint "location_payment_providers_auth_mode_check" check ((auth_mode = ANY (ARRAY['api_key'::text, 'oauth'::text]))),
  constraint "location_payment_providers_environment_check" check ((environment = ANY (ARRAY['test'::text, 'live'::text]))),
  constraint "location_payment_providers_location_id_provider_key" unique (location_id, provider),
  constraint "location_payment_providers_pkey" primary key (id),
  constraint "location_payment_providers_provider_check"
    check (((provider = lower(btrim(provider))) AND ((char_length(provider) >= 2) AND (char_length(provider) <= 50)) AND (provider ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "location_payment_providers_public_config_check" check (((jsonb_typeof(public_config) = 'object'::text) AND (octet_length((public_config)::text) <= 16384))),
  constraint "location_payment_providers_ready_credentials_check" check (((configuration_status <> 'ready'::text) OR ((credentials_secret_id IS NOT NULL) AND (webhook_secret_id IS
    NOT NULL) AND ((auth_mode <> 'oauth'::text) OR (credentials_expires_at IS NOT NULL))))),
  constraint "location_payment_providers_ready_secret_check" check (((configuration_status <> 'ready'::text) OR (credentials_secret_id IS NOT NULL))),
  constraint "location_payment_providers_status_check" check ((configuration_status = ANY (ARRAY['pending'::text, 'ready'::text, 'error'::text, 'disabled'::text]))),
  constraint "location_payment_providers_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."location_payment_providers"
  enable row level security;

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
  constraint "menu_categories_business_id_id_key" unique (business_id, id),
  constraint "menu_categories_description_check"
    check (((description IS NULL) OR ((description = btrim(description)) AND ((char_length(description) >= 1) AND (char_length(description) <= 1000))))),
  constraint "menu_categories_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "menu_categories_pkey" primary key (id),
  constraint "menu_categories_sort_order_check" check ((sort_order >= 0)),
  constraint "menu_categories_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."menu_categories"
  enable row level security;

create table "ordering"."opening_hours" (
  "id"          uuid                     not null default gen_random_uuid(),
  "location_id" uuid                     not null,
  "day_of_week" smallint                 not null,
  "opens_at"    time without time zone,
  "closes_at"   time without time zone,
  "is_closed"   boolean                  not null default false,
  "created_at"  timestamp with time zone not null default now(),
  constraint "opening_hours_day_of_week_check" check (((day_of_week >= 1) AND (day_of_week <= 7))),
  constraint "opening_hours_pkey" primary key (id),
  constraint "opening_hours_shape_check" check (((is_closed AND (opens_at IS NULL) AND (closes_at IS NULL)) OR ((NOT is_closed) AND (opens_at IS NOT NULL) AND (closes_at IS
    NOT NULL) AND (opens_at <> closes_at))))
);

alter table "ordering"."opening_hours"
  enable row level security;

create table "ordering"."option_groups" (
  "id"             uuid     not null default gen_random_uuid(),
  "business_id"    uuid     not null,
  "name"           text     not null,
  "selection_type" text     not null,
  "min_selections" smallint not null default 0,
  "max_selections" smallint not null,
  "sort_order"     integer  not null default 0,
  "is_active"      boolean  not null default true,
  constraint "option_groups_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "option_groups_pkey" primary key (id),
  constraint "option_groups_selection_count_check"
    check (((min_selections >= 0) AND (max_selections >= 1) AND (min_selections <= max_selections) AND ((selection_type <> 'single'::text) OR (max_selections = 1)))),
  constraint "option_groups_selection_type_check" check ((selection_type = ANY (ARRAY['single'::text, 'multiple'::text]))),
  constraint "option_groups_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."option_groups"
  enable row level security;

create table "ordering"."options" (
  "id"              uuid          not null default gen_random_uuid(),
  "option_group_id" uuid          not null,
  "name"            text          not null,
  "price_delta"     numeric(14,2) not null default 0,
  "is_active"       boolean       not null default true,
  "is_available"    boolean       not null default true,
  "sort_order"      integer       not null default 0,
  constraint "options_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "options_pkey" primary key (id),
  constraint "options_price_delta_check" check ((price_delta >= (0)::numeric)),
  constraint "options_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."options"
  enable row level security;

create table "ordering"."order_events" (
  "id"          uuid                     not null default gen_random_uuid(),
  "order_id"    uuid                     not null,
  "business_id" uuid                     not null,
  "event_type"  text                     not null,
  "from_status" text,
  "to_status"   text,
  "actor_type"  text                     not null,
  "actor_id"    uuid,
  "metadata"    jsonb                    not null default '{}'::jsonb,
  "created_at"  timestamp with time zone not null default now(),
  constraint "order_events_actor_type_check" check ((actor_type = ANY (ARRAY['customer'::text, 'admin'::text, 'telegram'::text, 'system'::text]))),
  constraint "order_events_event_type_check"
    check
    ((event_type = ANY (ARRAY['order_created'::text, 'order_placed'::text, 'order_accepted'::text, 'order_needs_attention'::text, 'order_ready_for_pickup'::text,
    'order_out_for_delivery'::text, 'order_delivered'::text, 'order_cancelled'::text, 'payment_status_changed'::text, 'refund_recorded'::text]))),
  constraint "order_events_metadata_check" check (((jsonb_typeof(metadata) = 'object'::text) AND (octet_length((metadata)::text) <= 65536))),
  constraint "order_events_pkey" primary key (id),
  constraint "order_events_status_values_check"
    check
    ((((from_status IS NULL) OR (from_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text,
    'delivered'::text,
    'needs_attention'::text,
    'cancelled'::text]))) AND
    ((to_status IS NULL) OR (to_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text,
    'delivered'::text, 'needs_attention'::text, 'cancelled'::text])))))
);

alter table "ordering"."order_events"
  enable row level security;

create table "ordering"."order_item_options" (
  "id"                uuid          not null default gen_random_uuid(),
  "order_item_id"     uuid          not null,
  "option_group_name" text          not null,
  "option_id"         uuid          not null,
  "option_name"       text          not null,
  "price_delta"       numeric(14,2) not null,
  "quantity"          integer       not null,
  constraint "order_item_options_group_name_check"
    check (((option_group_name = btrim(option_group_name)) AND ((char_length(option_group_name) >= 1) AND (char_length(option_group_name) <= 200)))),
  constraint "order_item_options_option_name_check" check (((option_name = btrim(option_name)) AND ((char_length(option_name) >= 1) AND (char_length(option_name) <= 200)))),
  constraint "order_item_options_pkey" primary key (id),
  constraint "order_item_options_price_delta_check" check ((price_delta >= (0)::numeric)),
  constraint "order_item_options_quantity_check" check ((quantity > 0))
);

alter table "ordering"."order_item_options"
  enable row level security;

create table "ordering"."order_items" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "order_id"             uuid                     not null,
  "product_id"           uuid                     not null,
  "product_name"         text                     not null,
  "quantity"             integer                  not null,
  "base_unit_price"      numeric(14,2)            not null,
  "modifier_unit_total"  numeric(14,2)            not null,
  "final_unit_price"     numeric(14,2)            not null,
  "line_total"           numeric(14,2)            not null,
  "customer_note"        text,
  "category_id_snapshot" uuid                     not null,
  "created_at"           timestamp with time zone not null default now(),
  constraint "order_items_amounts_check"
    check
    (((base_unit_price >= (0)::numeric) AND (modifier_unit_total >= (0)::numeric) AND (final_unit_price = (base_unit_price + modifier_unit_total)) AND (line_total =
    round((final_unit_price * (quantity)::numeric), 2)))),
  constraint "order_items_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 1000))))),
  constraint "order_items_pkey" primary key (id),
  constraint "order_items_product_name_check" check (((product_name = btrim(product_name)) AND ((char_length(product_name) >= 1) AND (char_length(product_name) <= 200)))),
  constraint "order_items_quantity_check" check ((quantity > 0))
);

alter table "ordering"."order_items"
  enable row level security;

create table "ordering"."orders" (
  "id"                                          uuid                     not null default gen_random_uuid(),
  "order_number"                                text                     not null,
  "business_id"                                 uuid                     not null,
  "location_id"                                 uuid                     not null,
  "customer_id"                                 uuid                     not null,
  "customer_business_id"                        uuid                     not null,
  "acquisition_source_id"                       uuid,
  "fulfillment_type"                            text                     not null,
  "status"                                      text                     not null,
  "payment_status"                              text                     not null,
  "currency"                                    text                     not null,
  "food_subtotal"                               numeric(14,2)            not null,
  "discount_total"                              numeric(14,2)            not null,
  "tax_total"                                   numeric(14,2)            not null,
  "delivery_fee"                                numeric(14,2)            not null,
  "loyalty_redeemed"                            numeric(14,2)            not null default 0,
  "grand_total"                                 numeric(14,2)            not null,
  "customer_name_snapshot"                      text                     not null,
  "customer_phone_snapshot"                     text                     not null,
  "delivery_address_snapshot"                   jsonb,
  "latitude"                                    numeric(9,6),
  "longitude"                                   numeric(10,6),
  "customer_note"                               text,
  "restaurant_note"                             text,
  "placed_at"                                   timestamp with time zone,
  "accepted_at"                                 timestamp with time zone,
  "out_for_delivery_at"                         timestamp with time zone,
  "delivered_at"                                timestamp with time zone,
  "cancelled_at"                                timestamp with time zone,
  "cancel_reason"                               text,
  "delivery_zone_id"                            uuid,
  "delivery_distance_km"                        numeric(8,3),
  "normal_delivery_fee"                         numeric(14,2)            not null,
  "estimated_delivery_cost"                     numeric(14,2)            not null,
  "aggregator_benchmark_rate_snapshot"          numeric(7,4)             not null,
  "skrowia_commission_rate_snapshot"            numeric(7,4)             not null,
  "skrowia_commissionable_amount"               numeric(14,2)            not null,
  "estimated_delivery_minutes"                  smallint                 not null,
  "coupon_id"                                   uuid,
  "coupon_code_snapshot"                        text,
  "coupon_discount_amount"                      numeric(14,2)            not null default 0,
  "created_at"                                  timestamp with time zone not null default now(),
  "updated_at"                                  timestamp with time zone not null default now(),
  "payment_method"                              text                     not null,
  "delivery_contact_phone_snapshot"             text,
  "delivery_contact_method_snapshot"            text,
  "delivery_contact_telegram_username_snapshot" text,
  constraint "orders_amounts_check"
    check
    (((food_subtotal >= (0)::numeric) AND (discount_total >= (0)::numeric) AND (discount_total <= food_subtotal) AND (tax_total >= (0)::numeric) AND (delivery_fee >= (0)::numeric)
    AND (loyalty_redeemed >= (0)::numeric) AND (loyalty_redeemed <= (food_subtotal - discount_total)) AND (grand_total >= (0)::numeric) AND (normal_delivery_fee >= (0)::numeric)
    AND (estimated_delivery_cost >= (0)::numeric) AND (coupon_discount_amount >= (0)::numeric) AND (coupon_discount_amount = discount_total) AND
    (skrowia_commissionable_amount >= (0)::numeric))),
  constraint "orders_business_id_id_key" unique (business_id, id),
  constraint "orders_business_id_location_id_id_key" unique (business_id, location_id, id),
  constraint "orders_business_order_number_key" unique (business_id, order_number),
  constraint "orders_cancel_reason_check"
    check (((cancel_reason IS NULL) OR ((cancel_reason = btrim(cancel_reason)) AND ((char_length(cancel_reason) >= 1) AND (char_length(cancel_reason) <= 500))))),
  constraint "orders_coupon_snapshot_check" check ((((coupon_id IS NULL) AND (coupon_code_snapshot IS NULL) AND (coupon_discount_amount = (0)::numeric)) OR ((coupon_id IS
    NOT NULL) AND (coupon_code_snapshot IS NOT NULL) AND (coupon_code_snapshot = upper(btrim(coupon_code_snapshot)))))),
  constraint "orders_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "orders_customer_name_snapshot_check"
    check (((customer_name_snapshot = btrim(customer_name_snapshot)) AND ((char_length(customer_name_snapshot) >= 1) AND (char_length(customer_name_snapshot) <= 200)))),
  constraint "orders_customer_note_check"
    check (((customer_note IS NULL) OR ((customer_note = btrim(customer_note)) AND ((char_length(customer_note) >= 1) AND (char_length(customer_note) <= 2000))))),
  constraint "orders_customer_phone_snapshot_check" check ((customer_phone_snapshot ~ '^[+][1-9][0-9]{7,14}$'::text)),
  constraint "orders_delivery_contact_method_snapshot_check"
    check (((delivery_contact_method_snapshot IS NULL) OR (delivery_contact_method_snapshot = ANY (ARRAY['phone'::text, 'whatsapp'::text, 'telegram'::text])))),
  constraint "orders_delivery_contact_phone_snapshot_check"
    check (((delivery_contact_phone_snapshot IS NULL) OR (delivery_contact_phone_snapshot ~ '^[+][1-9][0-9]{7,14}$'::text))),
  constraint "orders_delivery_contact_telegram_snapshot_check"
    check (((delivery_contact_telegram_username_snapshot IS NULL) OR (delivery_contact_telegram_username_snapshot ~ '^[A-Za-z0-9_]{5,32}$'::text))),
  constraint "orders_estimated_delivery_minutes_check" check (((estimated_delivery_minutes >= 1) AND (estimated_delivery_minutes <= 1440))),
  constraint "orders_fulfillment_shape_check" check ((((fulfillment_type = 'delivery'::text) AND (delivery_address_snapshot IS
    NOT NULL) AND (jsonb_typeof(delivery_address_snapshot) = 'object'::text) AND ((delivery_address_snapshot ->> 'schema_version'::text) = '1'::text) AND (latitude IS
    NOT NULL) AND ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)) AND (longitude IS
    NOT NULL) AND ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)) AND (delivery_zone_id IS NOT NULL) AND (delivery_distance_km IS
    NOT NULL) AND (delivery_distance_km >= (0)::numeric)) OR
    ((fulfillment_type = 'pickup'::text) AND (delivery_address_snapshot IS NULL) AND (latitude IS NULL) AND (longitude IS NULL) AND (delivery_zone_id IS NULL) AND
    (delivery_distance_km IS NULL) AND (delivery_fee = (0)::numeric) AND (normal_delivery_fee = (0)::numeric) AND (estimated_delivery_cost = (0)::numeric) AND
    (out_for_delivery_at IS NULL)))),
  constraint "orders_fulfillment_type_check" check ((fulfillment_type = ANY (ARRAY['delivery'::text, 'pickup'::text]))),
  constraint "orders_order_number_check"
    check (((order_number = upper(btrim(order_number))) AND ((char_length(order_number) >= 8) AND (char_length(order_number) <= 40)) AND (order_number ~ '^[A-Z0-9-]+$'::text))),
  constraint "orders_payment_method_check" check ((payment_method = ANY (ARRAY['online'::text, 'cash'::text]))),
  constraint "orders_payment_status_check" check ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'partially_refunded'::text, 'refunded'::text]))),
  constraint "orders_pkey" primary key (id),
  constraint "orders_rate_snapshots_check"
    check
    ((((aggregator_benchmark_rate_snapshot >= (0)::numeric) AND (aggregator_benchmark_rate_snapshot <= (100)::numeric)) AND ((skrowia_commission_rate_snapshot >= (0)::numeric) AND
    (skrowia_commission_rate_snapshot <= (100)::numeric)))),
  constraint "orders_restaurant_note_check"
    check (((restaurant_note IS NULL) OR ((restaurant_note = btrim(restaurant_note)) AND ((char_length(restaurant_note) >= 1) AND (char_length(restaurant_note) <= 2000))))),
  constraint "orders_status_check"
    check
    ((status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'delivered'::text, 'needs_attention'::text,
    'cancelled'::text]))),
  constraint "orders_status_milestones_check" check ((((status = ANY (ARRAY['payment_pending'::text, 'cancelled'::text])) OR (placed_at IS
    NOT NULL)) AND ((status <> 'accepted'::text) OR (accepted_at IS NOT NULL)) AND ((status <> 'ready_for_pickup'::text) OR (accepted_at IS
    NOT NULL)) AND ((status <> 'out_for_delivery'::text) OR ((accepted_at IS NOT NULL) AND (out_for_delivery_at IS
    NOT NULL))) AND ((status <> 'delivered'::text) OR ((delivered_at IS NOT NULL) AND (accepted_at IS
    NOT NULL) AND ((fulfillment_type <> 'delivery'::text) OR (out_for_delivery_at IS NOT NULL)))) AND ((status <> 'cancelled'::text) OR ((cancelled_at IS
    NOT NULL) AND (cancel_reason IS
    NOT NULL))) AND ((accepted_at IS NULL) OR (placed_at IS NULL) OR (accepted_at >= placed_at)) AND
    ((out_for_delivery_at IS NULL) OR (accepted_at IS NULL) OR (out_for_delivery_at >= accepted_at)) AND
    ((delivered_at IS NULL) OR (COALESCE(out_for_delivery_at, accepted_at, placed_at) IS NULL) OR (delivered_at >= COALESCE(out_for_delivery_at, accepted_at, placed_at))) AND
    ((cancelled_at IS NULL) OR (placed_at IS NULL) OR (cancelled_at >= placed_at)))),
  constraint "orders_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."orders"
  enable row level security;

create table "ordering"."payments" (
  "id"                  uuid                     not null default gen_random_uuid(),
  "order_id"            uuid                     not null,
  "business_id"         uuid                     not null,
  "provider"            text                     not null,
  "provider_order_id"   text,
  "provider_payment_id" text,
  "status"              text                     not null,
  "amount"              numeric(14,2)            not null,
  "currency"            text                     not null,
  "method"              text,
  "gateway_payload"     jsonb                    not null default '{}'::jsonb,
  "gateway_fee"         numeric(14,2),
  "gateway_tax"         numeric(14,2),
  "paid_at"             timestamp with time zone,
  "failed_at"           timestamp with time zone,
  "created_at"          timestamp with time zone not null default now(),
  "updated_at"          timestamp with time zone not null default now(),
  constraint "payments_amount_check" check ((amount > (0)::numeric)),
  constraint "payments_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "payments_gateway_cost_check" check ((((gateway_fee IS NULL) OR (gateway_fee >= (0)::numeric)) AND ((gateway_tax IS NULL) OR (gateway_tax >= (0)::numeric)))),
  constraint "payments_gateway_payload_check" check (((jsonb_typeof(gateway_payload) = 'object'::text) AND (octet_length((gateway_payload)::text) <= 65536))),
  constraint "payments_method_check"
    check (((method IS NULL) OR ((method = lower(btrim(method))) AND ((char_length(method) >= 1) AND (char_length(method) <= 50)) AND (method ~ '^[a-z][a-z0-9_-]*$'::text)))),
  constraint "payments_order_id_id_key" unique (order_id, id),
  constraint "payments_pkey" primary key (id),
  constraint "payments_provider_check"
    check (((provider = lower(btrim(provider))) AND ((char_length(provider) >= 2) AND (char_length(provider) <= 50)) AND (provider ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "payments_provider_ids_check"
    check
    ((((provider_order_id IS NULL) OR ((provider_order_id = btrim(provider_order_id)) AND ((char_length(provider_order_id) >= 1) AND (char_length(provider_order_id) <= 255)))) AND
    ((provider_payment_id IS NULL) OR ((provider_payment_id = btrim(provider_payment_id)) AND ((char_length(provider_payment_id) >= 1) AND (char_length(provider_payment_id) <=
    255)))))),
  constraint "payments_status_check" check ((status = ANY (ARRAY['created'::text, 'pending'::text, 'authorized'::text, 'paid'::text, 'failed'::text, 'cancelled'::text]))),
  constraint "payments_status_timestamps_check" check ((((status <> 'paid'::text) OR (paid_at IS NOT NULL)) AND ((status <> 'failed'::text) OR (failed_at IS
    NOT NULL)) AND (NOT ((paid_at IS NOT NULL) AND (failed_at IS NOT NULL))))),
  constraint "payments_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."payments"
  enable row level security;

create table "ordering"."product_locations" (
  "product_id"     uuid          not null,
  "location_id"    uuid          not null,
  "is_available"   boolean       not null default true,
  "price_override" numeric(14,2),
  constraint "product_locations_pkey" primary key (product_id, location_id),
  constraint "product_locations_price_override_check" check (((price_override IS NULL) OR (price_override >= (0)::numeric)))
);

alter table "ordering"."product_locations"
  enable row level security;

create table "ordering"."product_option_groups" (
  "product_id"      uuid    not null,
  "option_group_id" uuid    not null,
  "sort_order"      integer not null default 0,
  constraint "product_option_groups_pkey" primary key (product_id, option_group_id),
  constraint "product_option_groups_sort_order_check" check ((sort_order >= 0))
);

alter table "ordering"."product_option_groups"
  enable row level security;

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

create table "ordering"."refunds" (
  "id"                 uuid                     not null default gen_random_uuid(),
  "order_id"           uuid                     not null,
  "payment_id"         uuid                     not null,
  "amount"             numeric(14,2)            not null,
  "method"             text                     not null,
  "status"             text                     not null,
  "reason"             text                     not null,
  "processed_by"       uuid,
  "external_reference" text,
  "processed_at"       timestamp with time zone,
  "created_at"         timestamp with time zone not null default now(),
  constraint "refunds_amount_check" check ((amount > (0)::numeric)),
  constraint "refunds_completion_check" check (((status <> 'completed'::text) OR (processed_at IS NOT NULL))),
  constraint "refunds_external_reference_check"
    check
    (((external_reference IS NULL) OR ((external_reference = btrim(external_reference)) AND ((char_length(external_reference) >= 1) AND (char_length(external_reference) <=
    255))))),
  constraint "refunds_method_check" check ((method = ANY (ARRAY['manual'::text, 'gateway'::text]))),
  constraint "refunds_pkey" primary key (id),
  constraint "refunds_reason_check" check (((reason = btrim(reason)) AND ((char_length(reason) >= 1) AND (char_length(reason) <= 1000)))),
  constraint "refunds_status_check" check ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);

alter table "ordering"."refunds"
  enable row level security;

create table "ordering"."restaurant_settings" (
  "location_id"                      uuid                     not null,
  "ordering_enabled"                 boolean                  not null default false,
  "ordering_mode"                    text                     not null,
  "minimum_order_value"              numeric(14,2)            not null default 0,
  "accept_orders_when_closed"        boolean                  not null default false,
  "tax_mode"                         text                     not null,
  "tax_rate"                         numeric(7,4)             not null,
  "default_prep_minutes"             smallint                 not null,
  "currency"                         text                     not null,
  "aggregator_benchmark_rate"        numeric(7,4),
  "skrowia_commission_rate"          numeric(7,4)             not null,
  "created_at"                       timestamp with time zone not null default now(),
  "updated_at"                       timestamp with time zone not null default now(),
  "cash_on_delivery_enabled"         boolean                  not null default true,
  "online_payments_enabled"          boolean                  not null default false,
  "default_payment_method"           text                     not null default 'cash'::text,
  "new_order_alert_duration_seconds" smallint                 not null default 7,
  constraint "restaurant_settings_aggregator_benchmark_rate_check"
    check (((aggregator_benchmark_rate IS NULL) OR ((aggregator_benchmark_rate >= (0)::numeric) AND (aggregator_benchmark_rate <= (100)::numeric)))),
  constraint "restaurant_settings_currency_check" check ((currency ~ '^[A-Z]{3}$'::text)),
  constraint "restaurant_settings_default_payment_enabled_check"
    check ((((default_payment_method = 'cash'::text) AND cash_on_delivery_enabled) OR ((default_payment_method = 'online'::text) AND online_payments_enabled))),
  constraint "restaurant_settings_default_payment_method_check" check ((default_payment_method = ANY (ARRAY['cash'::text, 'online'::text]))),
  constraint "restaurant_settings_default_prep_minutes_check" check (((default_prep_minutes >= 1) AND (default_prep_minutes <= 1440))),
  constraint "restaurant_settings_minimum_order_value_check" check ((minimum_order_value >= (0)::numeric)),
  constraint "restaurant_settings_new_order_alert_duration_seconds_check" check (((new_order_alert_duration_seconds >= 1) AND (new_order_alert_duration_seconds <= 60))),
  constraint "restaurant_settings_ordering_mode_check" check ((ordering_mode = ANY (ARRAY['delivery'::text, 'pickup'::text, 'both'::text]))),
  constraint "restaurant_settings_payment_methods_check" check ((cash_on_delivery_enabled OR online_payments_enabled)),
  constraint "restaurant_settings_pkey" primary key (location_id),
  constraint "restaurant_settings_skrowia_commission_rate_check" check (((skrowia_commission_rate >= (0)::numeric) AND (skrowia_commission_rate <= (100)::numeric))),
  constraint "restaurant_settings_tax_configuration_check"
    check
    ((((tax_mode = 'none'::text) AND (tax_rate = (0)::numeric)) OR ((tax_mode = ANY (ARRAY['inclusive'::text, 'exclusive'::text])) AND (tax_rate > (0)::numeric) AND (tax_rate <=
    (100)::numeric)))),
  constraint "restaurant_settings_tax_mode_check" check ((tax_mode = ANY (ARRAY['none'::text, 'inclusive'::text, 'exclusive'::text]))),
  constraint "restaurant_settings_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."restaurant_settings"
  enable row level security;

create table "ordering"."telegram_order_messages" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "order_id"             uuid                     not null,
  "telegram_chat_id"     bigint                   not null,
  "telegram_message_id"  bigint                   not null,
  "last_rendered_status" text                     not null,
  "created_at"           timestamp with time zone not null default now(),
  "updated_at"           timestamp with time zone not null default now(),
  constraint "telegram_order_messages_chat_message_key" unique (telegram_chat_id, telegram_message_id),
  constraint "telegram_order_messages_message_id_check" check ((telegram_message_id > 0)),
  constraint "telegram_order_messages_order_chat_key" unique (order_id, telegram_chat_id),
  constraint "telegram_order_messages_pkey" primary key (id),
  constraint "telegram_order_messages_status_check"
    check
    ((last_rendered_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'delivered'::text,
    'needs_attention'::text, 'cancelled'::text]))),
  constraint "telegram_order_messages_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."telegram_order_messages"
  enable row level security;

create table "ordering"."telegram_staff" (
  "id"               uuid                     not null default gen_random_uuid(),
  "business_id"      uuid                     not null,
  "telegram_user_id" bigint                   not null,
  "display_name"     text                     not null,
  "is_authorized"    boolean                  not null default true,
  "created_at"       timestamp with time zone not null default now(),
  constraint "telegram_staff_business_telegram_user_key" unique (business_id, telegram_user_id),
  constraint "telegram_staff_display_name_check" check (((display_name = btrim(display_name)) AND ((char_length(display_name) >= 1) AND (char_length(display_name) <= 200)))),
  constraint "telegram_staff_pkey" primary key (id),
  constraint "telegram_staff_telegram_user_id_check" check ((telegram_user_id > 0))
);

alter table "ordering"."telegram_staff"
  enable row level security;

alter table "notifications"."deliveries"
  add column "dedupe_key" text generated always as
    ((((((((((event_id)::text || ':'::text) || channel) || ':'::text) || recipient_type) || ':'::text) || COALESCE((recipient_id)::text, '-'::text)) || ':'::text) ||
    COALESCE(lower(recipient_address), '-'::text))) stored;

create or replace function core.create_customer_business_address (
  p_customer_business_id  uuid,
  p_label                 text,
  p_recipient_name        text,
  p_recipient_phone       text,
  p_address_line_1        text,
  p_locality              text,
  p_city                  text,
  p_state                 text,
  p_latitude              numeric,
  p_longitude             numeric,
  p_address_line_2        text    default null::text,
  p_landmark              text    default null::text,
  p_postal_code           text    default null::text,
  p_delivery_instructions text    default null::text,
  p_is_default            boolean default false
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
  v_phone_e164 text := private.normalize_delivery_phone(p_recipient_phone);
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if v_phone_e164 is null then
    raise exception using errcode = '22023', message = 'a valid recipient phone is required';
  end if;

  select relationship.business_id, relationship.customer_id
  into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, preferred_contact_method,
    address_line_1, address_line_2, landmark, locality, city, state, postal_code,
    latitude, longitude, delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    p_recipient_phone, v_phone_e164, 'phone',
    p_address_line_1, p_address_line_2, p_landmark, p_locality, p_city, p_state, p_postal_code,
    p_latitude, p_longitude, p_delivery_instructions, p_is_default
  ) returning id into v_address_id;

  return v_address_id;
end;
$function$;

create or replace function core.create_customer_business_address_v2 (
  p_customer_business_id     uuid,
  p_label                    text,
  p_recipient_name           text,
  p_recipient_phone_e164     text,
  p_preferred_contact_method text,
  p_telegram_username        text,
  p_address_line_1           text,
  p_locality                 text,
  p_city                     text,
  p_state                    text,
  p_latitude                 numeric,
  p_longitude                numeric,
  p_address_line_2           text    default null::text,
  p_landmark                 text    default null::text,
  p_postal_code              text    default null::text,
  p_delivery_instructions    text    default null::text,
  p_is_default               boolean default false
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select relationship.business_id, relationship.customer_id
  into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, preferred_contact_method, telegram_username,
    address_line_1, address_line_2, landmark, locality, city, state, postal_code,
    latitude, longitude, delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    v_phone, v_phone, v_method, v_telegram,
    p_address_line_1, p_address_line_2, p_landmark, p_locality, p_city, p_state, p_postal_code,
    p_latitude, p_longitude, p_delivery_instructions, p_is_default
  ) returning id into v_address_id;

  return v_address_id;
end;
$function$;

create or replace function core.create_customer_business_address_v2 (
  p_customer_business_id         uuid,
  p_label                        text,
  p_recipient_name               text,
  p_recipient_phone_e164         text,
  p_recipient_phone_country_iso2 text,
  p_preferred_contact_method     text,
  p_telegram_username            text,
  p_address_line_1               text,
  p_locality                     text,
  p_city                         text,
  p_state                        text,
  p_latitude                     numeric,
  p_longitude                    numeric,
  p_address_line_2               text    default null::text,
  p_landmark                     text    default null::text,
  p_postal_code                  text    default null::text,
  p_delivery_instructions        text    default null::text,
  p_is_default                   boolean default false
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_country text := upper(btrim(coalesce(p_recipient_phone_country_iso2, '')));
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'a valid recipient phone country is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select relationship.business_id, relationship.customer_id
  into v_business_id, v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'customer relationship was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = p_customer_business_id and is_default;
  end if;

  insert into core.customer_business_addresses (
    customer_business_id, business_id, customer_id, label, recipient_name,
    recipient_phone, recipient_phone_e164, recipient_phone_country_iso2,
    preferred_contact_method, telegram_username,
    address_line_1, address_line_2, landmark, locality, city, state, postal_code,
    latitude, longitude, delivery_instructions, is_default
  ) values (
    p_customer_business_id, v_business_id, v_customer_id, p_label, p_recipient_name,
    v_phone, v_phone, v_country, v_method, v_telegram,
    p_address_line_1, p_address_line_2, p_landmark, p_locality, p_city, p_state,
    p_postal_code, p_latitude, p_longitude, p_delivery_instructions, p_is_default
  )
  returning id into v_address_id;

  return v_address_id;
end;
$function$;

create or replace function core.delete_customer_business_address (
  p_address_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer
    on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'saved address was not found or is not owned';
  end if;

  delete from core.customer_business_addresses
  where id = p_address_id
    and customer_business_id = v_customer_business_id;
end;
$function$;

create or replace function core.record_customer_business_visit (
  p_business_id           uuid,
  p_customer_id           uuid,
  p_acquisition_source_id uuid                     default null::uuid,
  p_seen_at               timestamp with time zone default now()
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_seen_at timestamptz := coalesce(p_seen_at, now());
  v_source_id uuid;
  v_relationship_id uuid;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  if not exists (
    select 1
    from core.customers as customer
    where customer.id = p_customer_id
      and customer.auth_user_id = v_auth_user_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'customer does not belong to the authenticated user';
  end if;

  select source.id
  into v_source_id
  from ordering.acquisition_sources as source
  left join ordering.campaigns as campaign
    on campaign.business_id = source.business_id
   and campaign.id = source.campaign_id
  where source.business_id = p_business_id
    and source.is_active
    and (
      (p_acquisition_source_id is not null
       and source.id = p_acquisition_source_id)
      or
      (p_acquisition_source_id is null and source.code = 'DIRECT')
    )
    and (
      source.campaign_id is null
      or (
        campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= v_seen_at)
        and (campaign.ends_at is null or v_seen_at < campaign.ends_at)
      )
    );

  if v_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'acquisition source is unavailable for this business and time';
  end if;

  insert into core.customer_businesses as existing_relationship (
    business_id,
    customer_id,
    first_seen_at,
    last_seen_at,
    status,
    original_acquisition_source_id
  )
  values (
    p_business_id,
    p_customer_id,
    v_seen_at,
    v_seen_at,
    'active',
    v_source_id
  )
  on conflict (business_id, customer_id)
  do update
    set last_seen_at = greatest(
      existing_relationship.last_seen_at,
      excluded.last_seen_at
    )
  returning existing_relationship.id into v_relationship_id;

  return v_relationship_id;
end;
$function$;

create or replace function core.set_default_customer_business_address (
  p_customer_business_id uuid,
  p_address_id           uuid
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_updated_rows integer;
begin
  if v_auth_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication is required';
  end if;

  perform 1
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  where relationship.id = p_customer_business_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'customer relationship was not found or is not owned';
  end if;

  update core.customer_business_addresses
  set is_default = false
  where customer_business_id = p_customer_business_id
    and id <> p_address_id
    and is_default;

  update core.customer_business_addresses
  set is_default = true
  where id = p_address_id
    and customer_business_id = p_customer_business_id;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> 1 then
    raise exception using
      errcode = '42501',
      message = 'saved address was not found or is not owned';
  end if;
end;
$function$;

create or replace function core.update_customer_business_address (
  p_address_id            uuid,
  p_label                 text,
  p_recipient_name        text,
  p_recipient_phone       text,
  p_address_line_1        text,
  p_locality              text,
  p_city                  text,
  p_state                 text,
  p_latitude              numeric,
  p_longitude             numeric,
  p_is_default            boolean,
  p_address_line_2        text    default null::text,
  p_landmark              text    default null::text,
  p_postal_code           text    default null::text,
  p_delivery_instructions text    default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone_e164 text := private.normalize_delivery_phone(p_recipient_phone);
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;

  if v_phone_e164 is null then
    raise exception using errcode = '22023', message = 'a valid recipient phone is required';
  end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'saved address was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = v_customer_business_id
      and id <> p_address_id
      and is_default;
  end if;

  update core.customer_business_addresses
  set label = p_label,
      recipient_name = p_recipient_name,
      recipient_phone = p_recipient_phone,
      recipient_phone_e164 = v_phone_e164,
      preferred_contact_method = coalesce(preferred_contact_method, 'phone'),
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      landmark = p_landmark,
      locality = p_locality,
      city = p_city,
      state = p_state,
      postal_code = p_postal_code,
      latitude = p_latitude,
      longitude = p_longitude,
      delivery_instructions = p_delivery_instructions,
      is_default = p_is_default
  where id = p_address_id;

  return p_address_id;
end;
$function$;

create or replace function core.update_customer_business_address_v2 (
  p_address_id               uuid,
  p_label                    text,
  p_recipient_name           text,
  p_recipient_phone_e164     text,
  p_preferred_contact_method text,
  p_telegram_username        text,
  p_address_line_1           text,
  p_locality                 text,
  p_city                     text,
  p_state                    text,
  p_latitude                 numeric,
  p_longitude                numeric,
  p_is_default               boolean,
  p_address_line_2           text    default null::text,
  p_landmark                 text    default null::text,
  p_postal_code              text    default null::text,
  p_delivery_instructions    text    default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'saved address was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = v_customer_business_id
      and id <> p_address_id
      and is_default;
  end if;

  update core.customer_business_addresses
  set label = p_label,
      recipient_name = p_recipient_name,
      recipient_phone = v_phone,
      recipient_phone_e164 = v_phone,
      preferred_contact_method = v_method,
      telegram_username = v_telegram,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      landmark = p_landmark,
      locality = p_locality,
      city = p_city,
      state = p_state,
      postal_code = p_postal_code,
      latitude = p_latitude,
      longitude = p_longitude,
      delivery_instructions = p_delivery_instructions,
      is_default = p_is_default
  where id = p_address_id;

  return p_address_id;
end;
$function$;

create or replace function core.update_customer_business_address_v2 (
  p_address_id                   uuid,
  p_label                        text,
  p_recipient_name               text,
  p_recipient_phone_e164         text,
  p_recipient_phone_country_iso2 text,
  p_preferred_contact_method     text,
  p_telegram_username            text,
  p_address_line_1               text,
  p_locality                     text,
  p_city                         text,
  p_state                        text,
  p_latitude                     numeric,
  p_longitude                    numeric,
  p_is_default                   boolean,
  p_address_line_2               text    default null::text,
  p_landmark                     text    default null::text,
  p_postal_code                  text    default null::text,
  p_delivery_instructions        text    default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_customer_business_id uuid;
  v_phone text := private.normalize_delivery_phone(p_recipient_phone_e164);
  v_country text := upper(btrim(coalesce(p_recipient_phone_country_iso2, '')));
  v_method text := lower(btrim(coalesce(p_preferred_contact_method, '')));
  v_telegram text := nullif(regexp_replace(btrim(coalesce(p_telegram_username, '')), '^@', ''), '');
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'authentication is required';
  end if;
  if v_phone is null then
    raise exception using errcode = '22023', message = 'a valid E.164 recipient phone is required';
  end if;
  if v_country !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'a valid recipient phone country is required';
  end if;
  if v_method not in ('phone', 'whatsapp', 'telegram') then
    raise exception using errcode = '22023', message = 'unsupported contact method';
  end if;
  if v_method = 'telegram' and (v_telegram is null or v_telegram !~ '^[A-Za-z0-9_]{5,32}$') then
    raise exception using errcode = '22023', message = 'a valid Telegram username is required';
  end if;
  if v_method <> 'telegram' then v_telegram := null; end if;

  select address.customer_business_id
  into v_customer_business_id
  from core.customer_business_addresses as address
  join core.customer_businesses as relationship
    on relationship.id = address.customer_business_id
   and relationship.business_id = address.business_id
   and relationship.customer_id = address.customer_id
  join core.customers as customer on customer.id = relationship.customer_id
  where address.id = p_address_id
    and customer.auth_user_id = v_auth_user_id
  for update of relationship;

  if not found then
    raise exception using errcode = '42501', message = 'saved address was not found or is not owned';
  end if;

  if p_is_default then
    update core.customer_business_addresses
    set is_default = false
    where customer_business_id = v_customer_business_id
      and id <> p_address_id
      and is_default;
  end if;

  update core.customer_business_addresses
  set label = p_label,
      recipient_name = p_recipient_name,
      recipient_phone = v_phone,
      recipient_phone_e164 = v_phone,
      recipient_phone_country_iso2 = v_country,
      preferred_contact_method = v_method,
      telegram_username = v_telegram,
      address_line_1 = p_address_line_1,
      address_line_2 = p_address_line_2,
      landmark = p_landmark,
      locality = p_locality,
      city = p_city,
      state = p_state,
      postal_code = p_postal_code,
      latitude = p_latitude,
      longitude = p_longitude,
      delivery_instructions = p_delivery_instructions,
      is_default = p_is_default
  where id = p_address_id;

  return p_address_id;
end;
$function$;

create or replace function core.update_customer_contact (
  p_contact_phone_e164       text,
  p_preferred_contact_method text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_phone text := nullif(btrim(coalesce(p_contact_phone_e164, '')), '');
  v_method text := lower(nullif(btrim(coalesce(p_preferred_contact_method, '')), ''));
  v_row core.customers;
begin
  if v_auth_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_phone is null or v_phone !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'a valid E.164 contact phone is required' using errcode = '22023';
  end if;

  if v_method is null or v_method not in ('phone', 'whatsapp') then
    raise exception 'preferred contact method must be phone or whatsapp' using errcode = '22023';
  end if;

  update core.customers
  set preferred_contact_phone_e164 = v_phone,
      preferred_contact_method = v_method,
      updated_at = now()
  where core.customers.auth_user_id = v_auth_user_id
  returning * into v_row;

  if not found then
    raise exception 'no customer profile exists for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone_e164', v_row.phone_e164,
    'preferred_contact_phone_e164', v_row.preferred_contact_phone_e164,
    'preferred_contact_method', v_row.preferred_contact_method
  );
end;
$function$;

create or replace function core.update_customer_profile (
  p_display_name text,
  p_email        text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_display_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_row core.customers;
begin
  if v_auth_user_id is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if v_display_name is null then
    raise exception 'a display name is required' using errcode = '22023';
  end if;

  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid email address is required' using errcode = '22023';
  end if;

  update core.customers
  set display_name = v_display_name,
      email = v_email,
      email_verified_at = case
        when v_email is distinct from core.customers.email then null
        else core.customers.email_verified_at
      end,
      updated_at = now()
  where core.customers.auth_user_id = v_auth_user_id
  returning * into v_row;

  if not found then
    raise exception 'no customer profile exists for this account' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'phone_e164', v_row.phone_e164,
    'display_name', v_row.display_name,
    'email', v_row.email,
    'phone_verified_at', v_row.phone_verified_at
  );
end;
$function$;

create or replace function notifications.retry_backoff (
  p_attempt_count integer
)
  returns interval
  language sql
  immutable
  set search_path to ''
  AS $function$
  select (array[
    interval '1 minute',
    interval '5 minutes',
    interval '15 minutes',
    interval '1 hour',
    interval '6 hours'
  ])[least(greatest(p_attempt_count, 1), 5)];
$function$;

create or replace function ordering.attach_anonymous_cart (
  p_business_id          uuid,
  p_location_id          uuid,
  p_anonymous_session_id uuid,
  p_customer_business_id uuid,
  p_new_cart_id          uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_customer_id uuid;
  v_anonymous_cart_id uuid;
  v_customer_cart_id uuid;
  v_target_cart_id uuid;
  v_anonymous_updated_at timestamptz;
  v_customer_updated_at timestamptz;
  v_anonymous_source_id uuid;
  v_anonymous_coupon_id uuid;
  v_coupon_code text;
  v_coupon_validation jsonb;
begin
  if p_anonymous_session_id is null or p_new_cart_id is null then
    raise exception using
      errcode = '22023',
      message = 'anonymous session and fallback cart identifiers are required';
  end if;

  select relationship.customer_id
  into v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  join core.business_locations as location
    on location.business_id = relationship.business_id
   and location.id = p_location_id
  where relationship.id = p_customer_business_id
    and relationship.business_id = p_business_id
    and relationship.status = 'active'
    and customer.auth_user_id = (select auth.uid())
    and location.is_active
  for update of relationship;

  if v_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'active customer relationship is required';
  end if;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now
    and (
      expired_cart.anonymous_session_id = p_anonymous_session_id
      or expired_cart.customer_id = v_customer_id
    );

  -- Every candidate is locked in UUID order before a target is selected.
  perform candidate.id
  from ordering.carts as candidate
  where candidate.business_id = p_business_id
    and candidate.location_id = p_location_id
    and candidate.status in ('active', 'abandoned')
    and candidate.expires_at > v_now
    and (
      candidate.anonymous_session_id = p_anonymous_session_id
      or candidate.customer_id = v_customer_id
    )
  order by candidate.id
  for update;

  select
    cart.id,
    cart.updated_at,
    cart.acquisition_source_id,
    cart.coupon_id
  into
    v_anonymous_cart_id,
    v_anonymous_updated_at,
    v_anonymous_source_id,
    v_anonymous_coupon_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.anonymous_session_id = p_anonymous_session_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1;

  select cart.id, cart.updated_at
  into v_customer_cart_id, v_customer_updated_at
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.customer_id = v_customer_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1;

  if v_customer_cart_id is not null then
    v_target_cart_id := v_customer_cart_id;

    if v_anonymous_cart_id is not null
       and v_anonymous_cart_id <> v_customer_cart_id then
      update ordering.cart_items
      set cart_id = v_target_cart_id
      where cart_id = v_anonymous_cart_id;

      update ordering.carts
      set status = 'abandoned',
          coupon_id = null
      where id = v_anonymous_cart_id;

      update ordering.carts
      set status = 'active',
          anonymous_session_id = null,
          customer_id = v_customer_id,
          customer_business_id = p_customer_business_id,
          acquisition_source_id = case
            when v_anonymous_updated_at >= v_customer_updated_at
              and v_anonymous_source_id is not null
              then v_anonymous_source_id
            else acquisition_source_id
          end,
          coupon_id = case
            when v_anonymous_updated_at >= v_customer_updated_at
              and v_anonymous_coupon_id is not null
              then v_anonymous_coupon_id
            else coupon_id
          end,
          expires_at = v_now + interval '30 days'
      where id = v_target_cart_id;
    else
      update ordering.carts
      set status = 'active',
          anonymous_session_id = null,
          expires_at = v_now + interval '30 days'
      where id = v_target_cart_id;
    end if;

  elsif v_anonymous_cart_id is not null then
    v_target_cart_id := v_anonymous_cart_id;

    update ordering.carts
    set status = 'active',
        anonymous_session_id = null,
        customer_id = v_customer_id,
        customer_business_id = p_customer_business_id,
        expires_at = v_now + interval '30 days'
    where id = v_target_cart_id;

  else
    insert into ordering.carts (
      id,
      business_id,
      location_id,
      customer_id,
      customer_business_id,
      status,
      acquisition_source_id,
      expires_at
    )
    select
      p_new_cart_id,
      p_business_id,
      p_location_id,
      v_customer_id,
      p_customer_business_id,
      'active',
      source.id,
      v_now + interval '30 days'
    from ordering.acquisition_sources as source
    where source.business_id = p_business_id
      and source.code = 'DIRECT'
      and source.is_active
    returning id into v_target_cart_id;

    if v_target_cart_id is null then
      raise exception using
        errcode = '55000',
        message = 'DIRECT acquisition source is unavailable';
    end if;
  end if;

  -- Retain valid lines, prune catalog rows that can no longer belong to the
  -- cart, and remove unavailable/unattached option selections. Required-group
  -- completeness is then surfaced by the mutation/quote APIs.
  delete from ordering.cart_items as item
  where item.cart_id = v_target_cart_id
    and not exists (
      select 1
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      left join ordering.product_locations as location_override
        on location_override.product_id = product.id
       and location_override.location_id = p_location_id
      where product.id = item.product_id
        and product.business_id = p_business_id
        and product.is_active
        and product.is_available
        and coalesce(location_override.is_available, true)
        and category.is_active
        and (category.location_id is null or category.location_id = p_location_id)
    );

  delete from ordering.cart_item_options as selection
  using ordering.cart_items as item
  where selection.cart_item_id = item.id
    and item.cart_id = v_target_cart_id
    and not exists (
      select 1
      from ordering.options as option_item
      join ordering.option_groups as option_group
        on option_group.id = option_item.option_group_id
       and option_group.is_active
      join ordering.product_option_groups as attachment
        on attachment.product_id = item.product_id
       and attachment.option_group_id = option_group.id
      where option_item.id = selection.option_id
        and option_item.is_active
        and option_item.is_available
    );

  select coupon.code
  into v_coupon_code
  from ordering.carts as cart
  join ordering.coupons as coupon
    on coupon.business_id = cart.business_id
   and coupon.id = cart.coupon_id
  where cart.id = v_target_cart_id;

  if v_coupon_code is not null then
    v_coupon_validation := ordering.validate_coupon(
      p_business_id,
      p_location_id,
      v_coupon_code,
      private.current_cart_subtotal(v_target_cart_id),
      v_now
    );

    if not coalesce((v_coupon_validation ->> 'valid')::boolean, false) then
      update ordering.carts set coupon_id = null where id = v_target_cart_id;
    end if;
  end if;

  return ordering.get_cart(v_target_cart_id, null);
end;
$function$;

create or replace function ordering.broadcast_order_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_auth_user_id uuid;
begin
  select customer.auth_user_id
  into v_auth_user_id
  from core.customers as customer
  where customer.id = new.customer_id;

  if v_auth_user_id is not null then
    perform realtime.send(
      jsonb_build_object('order_id', new.id),
      'order-changed',
      'customer-orders:' || v_auth_user_id::text || ':' || new.location_id::text,
      true
    );
  end if;

  perform realtime.send(
    jsonb_build_object('order_id', new.id),
    'order-changed',
    'location-orders:' || new.location_id::text,
    true
  );

  return null;
end;
$function$;

create or replace function ordering.broadcast_ordering_status()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform realtime.send(
    jsonb_build_object(
      'locationId', new.location_id,
      'orderingEnabled', new.ordering_enabled
    ),
    'ordering-status',
    'ordering-status:' || new.location_id::text,
    false
  );
  return null;
end;
$function$;

create or replace function ordering.checkout_cart (
  p_order_id                     uuid,
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_customer_note                text     default null::text,
  p_trusted_delivery_minutes     smallint default null::smallint,
  p_payment_method               text     default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_quote jsonb;
  v_order_number text;
  v_order_number_prefix text;
  v_order_number_sequence integer;
  v_order_number_date date;
  v_business_slug text;
  v_business_timezone text;
  v_customer_name text;
  v_customer_phone text;
  v_line_total numeric(14, 2);
  v_actor_type text;
  v_actor_id uuid;
  v_payment_method text;
  v_status text;
  v_placed_at timestamptz;
begin
  if p_order_id is null or p_cart_id is null then
    raise exception using
      errcode = '22023',
      message = 'stable order and cart identifiers are required';
  end if;

  v_payment_method := lower(btrim(coalesce(p_payment_method, '')));

  if v_payment_method not in ('online', 'cash') then
    raise exception using
      errcode = '22023',
      message = 'unsupported payment method';
  end if;

  -- A cash order is complete the moment it is created: there is no provider
  -- hand-off to wait on, so it goes straight to 'placed' with placed_at set
  -- (orders_status_milestones_check requires placed_at whenever status is
  -- anything other than payment_pending/cancelled).
  v_status := case when v_payment_method = 'cash' then 'placed' else 'payment_pending' end;
  v_placed_at := case when v_payment_method = 'cash' then now() else null end;

  if not (select private.can_access_cart(p_cart_id, null)) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status = 'converted' then
    if v_cart.converted_order_id = p_order_id then
      return ordering.get_order(p_order_id);
    end if;
    raise exception using errcode = '55000', message = 'cart is already converted';
  end if;

  if v_cart.customer_id is null or v_cart.customer_business_id is null then
    raise exception using errcode = '42501', message = 'checkout requires authentication';
  end if;

  perform 1
  from ordering.restaurant_settings as settings
  where settings.location_id = v_cart.location_id
  for share;

  perform product.id
  from ordering.products as product
  join ordering.cart_items as item
    on item.product_id = product.id
  where item.cart_id = p_cart_id
  order by product.id
  for share of product;

  perform option_item.id
  from ordering.options as option_item
  join ordering.cart_item_options as selection
    on selection.option_id = option_item.id
  join ordering.cart_items as item
    on item.id = selection.cart_item_id
  where item.cart_id = p_cart_id
  order by option_item.id
  for share of option_item;

  v_quote := private.calculate_order_quote(
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_trusted_delivery_minutes,
    now()
  );

  select business.slug, business.timezone
  into v_business_slug, v_business_timezone
  from core.businesses as business
  where business.id = v_cart.business_id;

  select
    coalesce(nullif(btrim(customer.display_name), ''), 'Customer'),
    coalesce(customer.preferred_contact_phone_e164, customer.phone_e164)
  into v_customer_name, v_customer_phone
  from core.customers as customer
  where customer.id = v_cart.customer_id;

  if v_customer_phone is null then
    raise exception using
      errcode = '22023',
      message = 'a contact phone is required before checkout';
  end if;

  v_order_number_date := (now() at time zone v_business_timezone)::date;

  v_order_number_prefix := upper(
    coalesce(nullif(left(regexp_replace(v_business_slug, '[^a-z0-9]', '', 'g'), 4), ''), 'A2')
    || '-' || to_char(v_order_number_date, 'YYMMDD')
    || '-'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_cart.business_id::text || ':' || v_order_number_date::text,
      0
    )
  );

  select coalesce(max(
    substring(placed_order.order_number from '([0-9]+)$')::integer
  ), 0) + 1
  into v_order_number_sequence
  from ordering.orders as placed_order
  where placed_order.business_id = v_cart.business_id
    and left(placed_order.order_number, char_length(v_order_number_prefix))
      = v_order_number_prefix;

  if v_order_number_sequence > 999999 then
    raise exception using
      errcode = '54000',
      message = 'daily order number capacity exceeded';
  end if;

  v_order_number := v_order_number_prefix
    || lpad(v_order_number_sequence::text, 6, '0');

  insert into ordering.orders (
    id,
    order_number,
    business_id,
    location_id,
    customer_id,
    customer_business_id,
    acquisition_source_id,
    fulfillment_type,
    status,
    payment_status,
    payment_method,
    placed_at,
    currency,
    food_subtotal,
    discount_total,
    tax_total,
    delivery_fee,
    loyalty_redeemed,
    grand_total,
    customer_name_snapshot,
    customer_phone_snapshot,
    delivery_address_snapshot,
    latitude,
    longitude,
    customer_note,
    delivery_zone_id,
    delivery_distance_km,
    normal_delivery_fee,
    estimated_delivery_cost,
    aggregator_benchmark_rate_snapshot,
    skrowia_commission_rate_snapshot,
    skrowia_commissionable_amount,
    estimated_delivery_minutes,
    coupon_id,
    coupon_code_snapshot,
    coupon_discount_amount
  ) values (
    p_order_id,
    v_order_number,
    (v_quote ->> 'business_id')::uuid,
    (v_quote ->> 'location_id')::uuid,
    (v_quote ->> 'customer_id')::uuid,
    (v_quote ->> 'customer_business_id')::uuid,
    (v_quote ->> 'acquisition_source_id')::uuid,
    v_quote ->> 'fulfillment_type',
    v_status,
    'pending',
    v_payment_method,
    v_placed_at,
    v_quote ->> 'currency',
    (v_quote ->> 'food_subtotal')::numeric,
    (v_quote ->> 'discount_total')::numeric,
    (v_quote ->> 'tax_total')::numeric,
    (v_quote ->> 'delivery_fee')::numeric,
    0,
    (v_quote ->> 'grand_total')::numeric,
    v_customer_name,
    v_customer_phone,
    nullif(v_quote -> 'delivery_address_snapshot', 'null'::jsonb),
    (v_quote ->> 'latitude')::numeric,
    (v_quote ->> 'longitude')::numeric,
    nullif(btrim(p_customer_note), ''),
    (v_quote ->> 'delivery_zone_id')::uuid,
    (v_quote ->> 'delivery_distance_km')::numeric,
    (v_quote ->> 'normal_delivery_fee')::numeric,
    (v_quote ->> 'estimated_delivery_cost')::numeric,
    (v_quote ->> 'aggregator_benchmark_rate_snapshot')::numeric,
    (v_quote ->> 'skrowia_commission_rate_snapshot')::numeric,
    (v_quote ->> 'skrowia_commissionable_amount')::numeric,
    (v_quote ->> 'estimated_delivery_minutes')::smallint,
    (v_quote ->> 'coupon_id')::uuid,
    v_quote ->> 'coupon_code',
    (v_quote ->> 'coupon_discount_amount')::numeric
  );

  insert into ordering.order_items (
    id,
    order_id,
    product_id,
    product_name,
    quantity,
    base_unit_price,
    modifier_unit_total,
    final_unit_price,
    line_total,
    customer_note,
    category_id_snapshot
  )
  select
    private.snapshot_order_item_id(p_order_id, item.id),
    p_order_id,
    product.id,
    product.name,
    item.quantity,
    coalesce(location_override.price_override, product.base_price),
    coalesce(option_total.amount, 0),
    coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0),
    round((
      coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0)
    ) * item.quantity, 2),
    item.customer_note,
    product.category_id
  from ordering.cart_items as item
  join ordering.products as product
    on product.id = item.product_id
  left join ordering.product_locations as location_override
    on location_override.product_id = product.id
   and location_override.location_id = v_cart.location_id
  left join lateral (
    select sum(option_item.price_delta * selection.quantity) as amount
    from ordering.cart_item_options as selection
    join ordering.options as option_item
      on option_item.id = selection.option_id
    where selection.cart_item_id = item.id
  ) as option_total on true
  where item.cart_id = p_cart_id;

  insert into ordering.order_item_options (
    order_item_id,
    option_group_name,
    option_id,
    option_name,
    price_delta,
    quantity
  )
  select
    private.snapshot_order_item_id(p_order_id, item.id),
    option_group.name,
    option_item.id,
    option_item.name,
    option_item.price_delta,
    selection.quantity
  from ordering.cart_items as item
  join ordering.cart_item_options as selection
    on selection.cart_item_id = item.id
  join ordering.options as option_item
    on option_item.id = selection.option_id
  join ordering.option_groups as option_group
    on option_group.id = option_item.option_group_id
  where item.cart_id = p_cart_id;

  select coalesce(sum(item.line_total), 0)
  into v_line_total
  from ordering.order_items as item
  where item.order_id = p_order_id;

  if v_line_total <> (v_quote ->> 'food_subtotal')::numeric then
    raise exception using
      errcode = '23514',
      message = 'order line snapshots do not reconcile to food subtotal';
  end if;

  v_actor_type := case when (select auth.uid()) is null then 'system' else 'customer' end;
  v_actor_id := case when v_actor_type = 'customer' then v_cart.customer_id else null end;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_cart.business_id,
    'order_created',
    null,
    v_status,
    v_actor_type,
    v_actor_id,
    jsonb_build_object(
      'schema_version', 1,
      'cart_id', p_cart_id,
      'payment_method', v_payment_method
    )
  );

  update ordering.carts
  set status = 'converted',
      converted_order_id = p_order_id
  where id = p_cart_id
    and status = 'active';

  if not found then
    raise exception using errcode = '40001', message = 'cart conversion lost a race';
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

create or replace function ordering.checkout_cart_v2 (
  p_order_id                     uuid,
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_customer_note                text     default null::text,
  p_trusted_delivery_minutes     smallint default null::smallint,
  p_payment_method               text     default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
  v_phone text;
  v_method text;
  v_telegram text;
  v_address_snapshot jsonb;
begin
  v_result := ordering.checkout_cart(
    p_order_id,
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_customer_note,
    p_trusted_delivery_minutes,
    p_payment_method
  );

  if p_fulfillment_type = 'delivery' then
    select
      address.recipient_phone_e164,
      coalesce(address.preferred_contact_method, 'phone'),
      address.telegram_username
    into v_phone, v_method, v_telegram
    from core.customer_business_addresses as address
    join ordering.orders as placed_order
      on placed_order.id = p_order_id
     and placed_order.business_id = address.business_id
     and placed_order.customer_id = address.customer_id
     and placed_order.customer_business_id = address.customer_business_id
    where address.id = p_customer_business_address_id;

    if v_phone is null then
      raise exception using errcode = '22023', message = 'delivery contact phone is unavailable';
    end if;
    if v_method = 'telegram' and v_telegram is null then
      raise exception using errcode = '22023', message = 'Telegram contact requires a username';
    end if;

    -- Only fill snapshots once. Retrying the same stable order id must not mutate history.
    update ordering.orders as placed_order
    set delivery_contact_phone_snapshot = v_phone,
        delivery_contact_method_snapshot = v_method,
        delivery_contact_telegram_username_snapshot = case when v_method = 'telegram' then v_telegram else null end,
        delivery_address_snapshot = coalesce(placed_order.delivery_address_snapshot, '{}'::jsonb)
          || jsonb_build_object(
            'schema_version', 2,
            'recipient_phone_e164', v_phone,
            'preferred_contact_method', v_method,
            'telegram_username', case when v_method = 'telegram' then v_telegram else null end
          )
    where placed_order.id = p_order_id
      and placed_order.delivery_contact_method_snapshot is null;
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

create or replace function ordering.create_manual_refund (
  p_refund_id  uuid,
  p_order_id   uuid,
  p_payment_id uuid,
  p_amount     numeric,
  p_reason     text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_operator_id uuid;
  v_existing ordering.refunds%rowtype;
begin
  if p_refund_id is null
     or p_amount is null
     or p_amount <= 0
     or p_reason is null
     or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'invalid manual refund';
  end if;

  select refund.*
  into v_existing
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if found then
    if v_existing.order_id <> p_order_id
       or v_existing.payment_id <> p_payment_id
       or v_existing.amount <> round(p_amount, 2)
       or v_existing.reason <> btrim(p_reason) then
      raise exception using
        errcode = '23505',
        message = 'refund idempotency identifier was reused with different facts';
    end if;
    return ordering.get_order_finance(p_order_id);
  end if;

  -- Consistent lock order: payment, order, then refund rows by UUID.
  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
    and payment.order_id = p_order_id
  for update;

  if not found or v_payment.status <> 'paid' then
    raise exception using errcode = '22023', message = 'captured payment is required';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
    and placed_order.business_id = v_payment.business_id
  for update;

  if not found then
    raise exception using errcode = '23514', message = 'payment/order mismatch';
  end if;

  select operator_user.id
  into v_operator_id
  from core.business_users as membership
  join core.users as operator_user
    on operator_user.id = membership.user_id
  where membership.business_id = v_order.business_id
    and membership.is_active
    and membership.role in ('owner', 'admin')
    and operator_user.auth_user_id = (select auth.uid());

  if v_operator_id is null then
    raise exception using errcode = '42501', message = 'owner or admin is required';
  end if;

  perform refund.id
  from ordering.refunds as refund
  where refund.payment_id = p_payment_id
  order by refund.id
  for update;

  insert into ordering.refunds (
    id,
    order_id,
    payment_id,
    amount,
    method,
    status,
    reason
  ) values (
    p_refund_id,
    p_order_id,
    p_payment_id,
    round(p_amount, 2),
    'manual',
    'pending',
    btrim(p_reason)
  );

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_order.business_id,
    'refund_recorded',
    'admin',
    v_operator_id,
    jsonb_build_object(
      'schema_version', 1,
      'refund_id', p_refund_id,
      'payment_id', p_payment_id,
      'refund_status', 'pending',
      'amount', round(p_amount, 2)
    )
  );

  return ordering.get_order_finance(p_order_id);
end;
$function$;

create or replace function ordering.create_payment_attempt (
  p_payment_id uuid,
  p_order_id   uuid,
  p_provider   text,
  p_amount     numeric,
  p_currency   text,
  p_method     text    default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_payment ordering.payments%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_payment_id is null
     or p_order_id is null
     or p_provider is null
     or btrim(p_provider) = ''
     or p_amount is null
     or p_amount <= 0
     or p_currency is null then
    raise exception using errcode = '22023', message = 'invalid payment attempt';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.status <> 'payment_pending'
     or v_order.payment_status in ('paid', 'partially_refunded', 'refunded') then
    raise exception using errcode = '55000', message = 'order cannot start a payment';
  end if;

  if round(p_amount, 2) <> v_order.grand_total
     or upper(btrim(p_currency)) <> v_order.currency then
    raise exception using
      errcode = '22023',
      message = 'payment amount and currency must match the order snapshot';
  end if;

  insert into ordering.payments (
    id,
    order_id,
    business_id,
    provider,
    status,
    amount,
    currency,
    method
  ) values (
    p_payment_id,
    p_order_id,
    v_order.business_id,
    lower(btrim(p_provider)),
    'created',
    round(p_amount, 2),
    upper(btrim(p_currency)),
    nullif(lower(btrim(p_method)), '')
  )
  on conflict (id) do nothing;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id;

  if v_payment.order_id <> p_order_id
     or v_payment.provider <> lower(btrim(p_provider))
     or v_payment.amount <> round(p_amount, 2)
     or v_payment.currency <> upper(btrim(p_currency)) then
    raise exception using
      errcode = '23505',
      message = 'payment idempotency identifier was reused with different facts';
  end if;

  update ordering.orders
  set payment_status = 'pending'
  where id = p_order_id
    and payment_status <> 'pending';

  if found then
    insert into ordering.order_events (
      order_id,
      business_id,
      event_type,
      actor_type,
      metadata
    ) values (
      p_order_id,
      v_order.business_id,
      'payment_status_changed',
      'system',
      jsonb_build_object(
        'schema_version', 1,
        'payment_id', p_payment_id,
        'from_payment_status', v_order.payment_status,
        'to_payment_status', 'pending'
      )
    );
  end if;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'provider', v_payment.provider,
    'status', v_payment.status,
    'amount', v_payment.amount,
    'currency', v_payment.currency,
    'provider_order_id', v_payment.provider_order_id
  );
end;
$function$;

create or replace function ordering.get_analytics_diagnostics (
  p_business_id uuid,
  p_from        timestamp with time zone default (now() - '30 days'::interval),
  p_to          timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'analytics reporting denied';
  end if;

  if p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '366 days' then
    raise exception using
      errcode = '22023',
      message = 'analytics window must be positive and no longer than 366 days';
  end if;

  return jsonb_build_object(
    'business_id', p_business_id,
    'from', p_from,
    'to', p_to,
    'events', coalesce((
      select jsonb_object_agg(
        event.event_name,
        jsonb_build_object(
          'events', event.event_count,
          'sessions', event.session_count
        )
      )
      from (
        select analytics.event_name,
               count(*) as event_count,
               count(distinct analytics.session_id) as session_count
        from ordering.analytics_events as analytics
        where analytics.business_id = p_business_id
          and analytics.occurred_at >= p_from
          and analytics.occurred_at < p_to
          and analytics.event_name in (
            'payment_failed', 'otp_failed', 'delivery_unserviceable',
            'location_permission_denied'
          )
        group by analytics.event_name
      ) as event
    ), '{}'::jsonb)
  );
end;
$function$;

create or replace function ordering.get_analytics_funnel (
  p_business_id uuid,
  p_from        timestamp with time zone default (now() - '30 days'::interval),
  p_to          timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'analytics reporting denied';
  end if;

  if p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '366 days' then
    raise exception using
      errcode = '22023',
      message = 'analytics window must be positive and no longer than 366 days';
  end if;

  with per_session as (
    select event.session_id,
           min(event.occurred_at) filter (where event.event_name = 'menu_viewed') as menu_viewed_at,
           min(event.occurred_at) filter (where event.event_name = 'item_added_to_cart') as item_added_at,
           min(event.occurred_at) filter (where event.event_name = 'cart_viewed') as cart_viewed_at,
           min(event.occurred_at) filter (where event.event_name = 'checkout_started') as checkout_started_at,
           min(event.occurred_at) filter (where event.event_name = 'payment_started') as payment_started_at,
           min(event.occurred_at) filter (where event.event_name = 'order_placed') as order_placed_at
    from ordering.analytics_events as event
    where event.business_id = p_business_id
      and event.occurred_at >= p_from
      and event.occurred_at < p_to
    group by event.session_id
  ), stage_counts as (
    select count(*) filter (where menu_viewed_at is not null) as menu_viewed_sessions,
           count(*) filter (
             where item_added_at is not null
               and menu_viewed_at is not null
               and menu_viewed_at <= item_added_at
           ) as item_added_to_cart_sessions,
           count(*) filter (
             where cart_viewed_at is not null
               and item_added_at is not null
               and item_added_at <= cart_viewed_at
           ) as cart_viewed_sessions,
           count(*) filter (
             where checkout_started_at is not null
               and cart_viewed_at is not null
               and cart_viewed_at <= checkout_started_at
           ) as checkout_started_sessions,
           count(*) filter (
             where payment_started_at is not null
               and checkout_started_at is not null
               and checkout_started_at <= payment_started_at
           ) as payment_started_sessions,
           count(*) filter (
             where order_placed_at is not null
               and payment_started_at is not null
               and payment_started_at <= order_placed_at
           ) as order_placed_sessions
    from per_session
  ), event_counts as (
    select event.event_name,
           count(*) as event_count,
           count(distinct event.session_id) as session_count
    from ordering.analytics_events as event
    where event.business_id = p_business_id
      and event.occurred_at >= p_from
      and event.occurred_at < p_to
      and event.event_name in (
        'menu_viewed', 'item_added_to_cart', 'cart_viewed',
        'checkout_started', 'payment_started', 'order_placed'
      )
    group by event.event_name
  )
  select jsonb_build_object(
    'business_id', p_business_id,
    'from', p_from,
    'to', p_to,
    'definition', 'A session advances only when each listed funnel event occurred in order within the selected window.',
    'stages', jsonb_build_object(
      'menu_viewed', coalesce(stage_counts.menu_viewed_sessions, 0),
      'item_added_to_cart', coalesce(stage_counts.item_added_to_cart_sessions, 0),
      'cart_viewed', coalesce(stage_counts.cart_viewed_sessions, 0),
      'checkout_started', coalesce(stage_counts.checkout_started_sessions, 0),
      'payment_started', coalesce(stage_counts.payment_started_sessions, 0),
      'order_placed', coalesce(stage_counts.order_placed_sessions, 0)
    ),
    'events', coalesce((
      select jsonb_object_agg(
        event_counts.event_name,
        jsonb_build_object(
          'events', event_counts.event_count,
          'sessions', event_counts.session_count
        )
      )
      from event_counts
    ), '{}'::jsonb)
  )
  into v_result
  from stage_counts;

  return v_result;
end;
$function$;

create or replace function ordering.get_cart (
  p_cart_id              uuid,
  p_anonymous_session_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_result jsonb;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using
      errcode = '42501',
      message = 'cart access denied';
  end if;

  select jsonb_build_object(
    'id', cart.id,
    'business_id', cart.business_id,
    'location_id', cart.location_id,
    'status', cart.status,
    'is_authenticated', cart.customer_id is not null,
    'updated_at', cart.updated_at,
    'expires_at', cart.expires_at,
    'estimated_food_subtotal', private.current_cart_subtotal(cart.id),
    'coupon', case
      when coupon.id is null then null
      else jsonb_build_object('id', coupon.id, 'code', coupon.code)
    end,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'product_id', product.id,
          'product_name', product.name,
          'quantity', item.quantity,
          'customer_note', item.customer_note,
          'base_unit_price', coalesce(
            location_override.price_override,
            product.base_price
          ),
          'modifier_unit_total', coalesce(option_total.amount, 0),
          'estimated_line_total', round((
            coalesce(location_override.price_override, product.base_price)
            + coalesce(option_total.amount, 0)
          ) * item.quantity, 2),
          'options', coalesce(option_total.options, '[]'::jsonb)
        )
        order by item.created_at, item.id
      )
      from ordering.cart_items as item
      join ordering.products as product
        on product.id = item.product_id
      left join ordering.product_locations as location_override
        on location_override.product_id = product.id
       and location_override.location_id = cart.location_id
      left join lateral (
        select
          sum(option_item.price_delta * selection.quantity) as amount,
          jsonb_agg(
            jsonb_build_object(
              'option_id', option_item.id,
              'name', option_item.name,
              'price_delta', option_item.price_delta,
              'quantity', selection.quantity
            )
            order by option_group.sort_order, option_item.sort_order,
              option_item.id
          ) as options
        from ordering.cart_item_options as selection
        join ordering.options as option_item
          on option_item.id = selection.option_id
        join ordering.option_groups as option_group
          on option_group.id = option_item.option_group_id
        where selection.cart_item_id = item.id
      ) as option_total on true
      where item.cart_id = cart.id
    ), '[]'::jsonb)
  )
  into v_result
  from ordering.carts as cart
  left join ordering.coupons as coupon
    on coupon.business_id = cart.business_id
   and coupon.id = cart.coupon_id
  where cart.id = p_cart_id;

  return v_result;
end;
$function$;

create or replace function ordering.get_delivery_quote (
  p_location_id                  uuid,
  p_destination_latitude         numeric,
  p_destination_longitude        numeric,
  p_food_subtotal_after_discount numeric
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_origin_latitude numeric;
  v_origin_longitude numeric;
  v_ordering_mode text;
  v_restaurant_minimum numeric(14, 2);
  v_distance double precision;
  v_zone_minimum numeric(14, 2);
  v_normal_delivery_fee numeric(14, 2);
  v_free_delivery_threshold numeric(14, 2);
  v_customer_delivery_fee numeric(14, 2);
  v_zone_found boolean;
  v_delivery_supported boolean;
begin
  if p_location_id is null
     or p_destination_latitude is null
     or p_destination_latitude not between -90 and 90
     or p_destination_longitude is null
     or p_destination_longitude not between -180 and 180
     or p_food_subtotal_after_discount is null
     or p_food_subtotal_after_discount < 0 then
    raise exception using
      errcode = '22023',
      message = 'valid location, coordinates, and nonnegative subtotal are required';
  end if;

  select
    location.latitude,
    location.longitude,
    settings.ordering_mode,
    settings.minimum_order_value
  into
    v_origin_latitude,
    v_origin_longitude,
    v_ordering_mode,
    v_restaurant_minimum
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where location.id = p_location_id
    and location.is_active
    and business.status = 'active';

  if not found then
    return null;
  end if;

  v_distance := private.haversine_distance_km(
    v_origin_latitude,
    v_origin_longitude,
    p_destination_latitude,
    p_destination_longitude
  );

  select
    zone.minimum_order_value,
    zone.delivery_fee,
    zone.free_delivery_threshold
  into
    v_zone_minimum,
    v_normal_delivery_fee,
    v_free_delivery_threshold
  from ordering.delivery_zones as zone
  where zone.location_id = p_location_id
    and zone.is_active
    and v_distance >= zone.min_distance_km::double precision
    and v_distance < zone.max_distance_km::double precision
  order by zone.min_distance_km, zone.id
  limit 1;

  v_zone_found := found;
  v_delivery_supported := v_ordering_mode in ('delivery', 'both');

  if v_zone_found and v_delivery_supported then
    v_customer_delivery_fee := case
      when v_free_delivery_threshold is not null
       and p_food_subtotal_after_discount >= v_free_delivery_threshold then 0
      else v_normal_delivery_fee
    end;
  end if;

  return jsonb_build_object(
    'serviceable', v_zone_found and v_delivery_supported,
    'distance_km', round(v_distance::numeric, 3),
    'minimum_order_value', case
      when v_zone_found and v_delivery_supported then
        greatest(v_restaurant_minimum, v_zone_minimum)
      else null
    end,
    'normal_delivery_fee', case
      when v_zone_found and v_delivery_supported then v_normal_delivery_fee
      else null
    end,
    'delivery_fee', case
      when v_zone_found and v_delivery_supported then v_customer_delivery_fee
      else null
    end
  );
end;
$function$;

create or replace function ordering.get_featured_product_ids (
  p_business_id uuid,
  p_location_id uuid
)
  returns jsonb
  language plpgsql
  stable
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read featured products.' using errcode = '42501';
  end if;

  if not (select private.is_active_location_member(p_location_id))
    or not exists (
      select 1
      from core.business_locations as location
      where location.id = p_location_id
        and location.business_id = p_business_id
        and location.is_active
    ) then
    raise exception 'You do not have permission to read featured products.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(featured.product_id order by featured.sort_order, featured.product_id)
    from ordering.location_featured_products as featured
    join ordering.product_locations as product_location
      on product_location.product_id = featured.product_id
     and product_location.location_id = featured.location_id
    join ordering.products as product
      on product.id = featured.product_id
     and product.business_id = p_business_id
     and product.is_active
    where featured.location_id = p_location_id
      and featured.is_active
  ), '[]'::jsonb);
end;
$function$;

create or replace function ordering.get_location_payment_configuration (
  p_business_id uuid,
  p_location_id uuid
)
  returns jsonb
  language plpgsql
  stable
  set search_path to ''
  AS $function$
declare
  v_settings ordering.restaurant_settings%rowtype;
  v_provider ordering.location_payment_providers%rowtype;
begin
  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception using errcode = '22023', message = 'selected outlet is unavailable';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception using errcode = '42501', message = 'payment configuration access denied';
  end if;

  select settings.* into v_settings
  from ordering.restaurant_settings as settings
  where settings.location_id = p_location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = p_location_id
    and provider.is_active
  limit 1;

  return jsonb_build_object(
    'cashOnDeliveryEnabled', v_settings.cash_on_delivery_enabled,
    'onlinePaymentsEnabled', v_settings.online_payments_enabled,
    'defaultPaymentMethod', v_settings.default_payment_method,
    'activeProvider', case when v_provider.id is null then null else jsonb_build_object(
      'id', v_provider.id,
      'provider', v_provider.provider,
      'configurationStatus', v_provider.configuration_status,
      'providerAccountId', v_provider.provider_account_id,
      'publicConfig', v_provider.public_config
    ) end,
    'onlineProviderReady', coalesce(v_provider.configuration_status = 'ready', false)
  );
end;
$function$;

create or replace function ordering.get_menu (
  p_business_id uuid,
  p_location_id uuid
)
  returns jsonb
  language plpgsql
  stable
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read a menu.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to read this menu.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  return (
    with scoped_categories as (
      select
        category.id,
        category.name,
        category.description,
        category.sort_order,
        category.is_active,
        category.updated_at
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    ),
    scoped_products as (
      select
        product.id,
        product.category_id,
        product.name,
        product.description,
        product.base_price,
        product.image_url,
        product.dietary_type,
        product.is_available,
        product.sort_order,
        product.prep_time_minutes,
        product.updated_at
      from ordering.products as product
      join scoped_categories as category on category.id = product.category_id
      where product.business_id = p_business_id
        and product.is_active
    ),
    scoped_product_locations as (
      select product_location.product_id, product_location.is_available
      from ordering.product_locations as product_location
      join scoped_products as product on product.id = product_location.product_id
      where product_location.location_id = p_location_id
    ),
    scoped_availability_windows as (
      select
        availability_window.category_id,
        availability_window.product_id,
        availability_window.day_of_week,
        availability_window.starts_at,
        availability_window.ends_at
      from ordering.catalog_availability_windows as availability_window
      where availability_window.location_id = p_location_id
        and (
          availability_window.category_id in (select id from scoped_categories)
          or availability_window.product_id in (select id from scoped_products)
        )
    ),
    scoped_product_option_groups as (
      select
        product_option_group.product_id,
        product_option_group.option_group_id,
        product_option_group.sort_order
      from ordering.product_option_groups as product_option_group
      join scoped_products as product on product.id = product_option_group.product_id
    ),
    scoped_option_groups as (
      select
        option_group.id,
        option_group.name,
        option_group.selection_type,
        option_group.min_selections,
        option_group.max_selections,
        option_group.sort_order
      from ordering.option_groups as option_group
      where option_group.business_id = p_business_id
        and option_group.is_active
        and option_group.id in (
          select distinct option_group_id
          from scoped_product_option_groups
        )
    ),
    scoped_options as (
      select
        option.id,
        option.option_group_id,
        option.name,
        option.price_delta,
        option.is_available,
        option.sort_order
      from ordering.options as option
      join scoped_option_groups as option_group
        on option_group.id = option.option_group_id
      where option.is_active
    )
    select jsonb_build_object(
      'schema_version', 1,
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'description', category.description,
          'sort_order', category.sort_order,
          'is_active', category.is_active,
          'updated_at', category.updated_at
        ) order by category.sort_order, category.id)
        from scoped_categories as category
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', product.id,
          'category_id', product.category_id,
          'name', product.name,
          'description', product.description,
          'base_price', product.base_price,
          'image_url', product.image_url,
          'dietary_type', product.dietary_type,
          'is_available', product.is_available,
          'sort_order', product.sort_order,
          'prep_time_minutes', product.prep_time_minutes,
          'updated_at', product.updated_at
        ) order by product.sort_order, product.id)
        from scoped_products as product
      ), '[]'::jsonb),
      'product_locations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', product_location.product_id,
          'is_available', product_location.is_available
        ) order by product_location.product_id)
        from scoped_product_locations as product_location
      ), '[]'::jsonb),
      'availability_windows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'category_id', availability_window.category_id,
          'product_id', availability_window.product_id,
          'day_of_week', availability_window.day_of_week,
          'starts_at', availability_window.starts_at,
          'ends_at', availability_window.ends_at
        ) order by
          availability_window.category_id nulls last,
          availability_window.product_id nulls last,
          availability_window.day_of_week,
          availability_window.starts_at,
          availability_window.ends_at)
        from scoped_availability_windows as availability_window
      ), '[]'::jsonb),
      'product_option_groups', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', product_option_group.product_id,
          'option_group_id', product_option_group.option_group_id,
          'sort_order', product_option_group.sort_order
        ) order by
          product_option_group.product_id,
          product_option_group.sort_order,
          product_option_group.option_group_id)
        from scoped_product_option_groups as product_option_group
      ), '[]'::jsonb),
      'option_groups', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option_group.id,
          'name', option_group.name,
          'selection_type', option_group.selection_type,
          'min_selections', option_group.min_selections,
          'max_selections', option_group.max_selections,
          'sort_order', option_group.sort_order
        ) order by option_group.sort_order, option_group.id)
        from scoped_option_groups as option_group
      ), '[]'::jsonb),
      'options', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', option.id,
          'option_group_id', option.option_group_id,
          'name', option.name,
          'price_delta', option.price_delta,
          'is_available', option.is_available,
          'sort_order', option.sort_order
        ) order by option.sort_order, option.id)
        from scoped_options as option
      ), '[]'::jsonb)
    )
  );
end;
$function$;

create or replace function ordering.get_new_order_alert_duration (
  p_location_id uuid
)
  returns smallint
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_duration_seconds smallint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to read the new-order alert.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to read this outlet setting.' using errcode = '42501';
  end if;

  select settings.new_order_alert_duration_seconds
  into v_duration_seconds
  from ordering.restaurant_settings as settings
  join core.business_locations as location
    on location.id = settings.location_id
  where settings.location_id = p_location_id
    and location.is_active;

  if v_duration_seconds is null then
    raise exception 'The new-order alert is not configured for this outlet.' using errcode = '22023';
  end if;

  return v_duration_seconds;
end;
$function$;

create or replace function ordering.get_order (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_is_operator boolean;
  v_result jsonb;
begin
  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found or not (select private.can_view_order(v_order.business_id, v_order.customer_id)) then
    raise exception using errcode = '42501', message = 'order access denied';
  end if;

  v_is_operator := private.can_operate_orders(v_order.business_id) or private.request_is_service_role();

  select jsonb_build_object(
    'id', placed_order.id,
    'order_number', placed_order.order_number,
    'business_id', placed_order.business_id,
    'location_id', placed_order.location_id,
    'fulfillment_type', placed_order.fulfillment_type,
    'status', placed_order.status,
    'payment_status', placed_order.payment_status,
    'payment_method', placed_order.payment_method,
    'currency', placed_order.currency,
    'food_subtotal', placed_order.food_subtotal,
    'discount_total', placed_order.discount_total,
    'tax_total', placed_order.tax_total,
    'delivery_fee', placed_order.delivery_fee,
    'loyalty_redeemed', placed_order.loyalty_redeemed,
    'grand_total', placed_order.grand_total,
    'customer_name', placed_order.customer_name_snapshot,
    'customer_phone', placed_order.customer_phone_snapshot,
    'delivery_address', placed_order.delivery_address_snapshot,
    'delivery_contact', case when placed_order.fulfillment_type = 'delivery' then jsonb_build_object(
      'method', coalesce(placed_order.delivery_contact_method_snapshot, 'phone'),
      'phone', coalesce(placed_order.delivery_contact_phone_snapshot, placed_order.customer_phone_snapshot),
      'telegram_username', placed_order.delivery_contact_telegram_username_snapshot
    ) else null end,
    'customer_note', placed_order.customer_note,
    'restaurant_note', case when v_is_operator then placed_order.restaurant_note else null end,
    'placed_at', placed_order.placed_at,
    'accepted_at', placed_order.accepted_at,
    'out_for_delivery_at', placed_order.out_for_delivery_at,
    'delivered_at', placed_order.delivered_at,
    'cancelled_at', placed_order.cancelled_at,
    'cancel_reason', placed_order.cancel_reason,
    'estimated_delivery_minutes', placed_order.estimated_delivery_minutes,
    'coupon_code', placed_order.coupon_code_snapshot,
    'coupon_discount_amount', placed_order.coupon_discount_amount,
    'customer_cancel_seconds_remaining', case
      when placed_order.status = 'placed' and placed_order.placed_at is not null
      then greatest(0, floor(extract(epoch from (placed_order.placed_at + interval '90 seconds' - now())))::integer)
      else 0
    end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id,
        'product_id', item.product_id,
        'product_name', item.product_name,
        'quantity', item.quantity,
        'base_unit_price', item.base_unit_price,
        'modifier_unit_total', item.modifier_unit_total,
        'final_unit_price', item.final_unit_price,
        'line_total', item.line_total,
        'customer_note', item.customer_note,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'option_group_name', selected.option_group_name,
            'option_id', selected.option_id,
            'option_name', selected.option_name,
            'price_delta', selected.price_delta,
            'quantity', selected.quantity
          ) order by selected.id)
          from ordering.order_item_options as selected
          where selected.order_item_id = item.id
        ), '[]'::jsonb)
      ) order by item.created_at, item.id)
      from ordering.order_items as item
      where item.order_id = placed_order.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', event.event_type,
        'from_status', event.from_status,
        'to_status', event.to_status,
        'actor_type', event.actor_type,
        'created_at', event.created_at
      ) order by event.created_at, event.id)
      from ordering.order_events as event
      where event.order_id = placed_order.id
    ), '[]'::jsonb),
    'created_at', placed_order.created_at,
    'updated_at', placed_order.updated_at
  ) into v_result
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  return v_result;
end;
$function$;

create or replace function ordering.get_order_finance (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
begin
  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found or not private.can_view_order_finance(v_order.business_id) then
    raise exception using errcode = '42501', message = 'finance access denied';
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'currency', v_order.currency,
    'food_subtotal', v_order.food_subtotal,
    'discount_total', v_order.discount_total,
    'tax_total', v_order.tax_total,
    'delivery_fee', v_order.delivery_fee,
    'grand_total', v_order.grand_total,
    'normal_delivery_fee', v_order.normal_delivery_fee,
    'estimated_delivery_cost', v_order.estimated_delivery_cost,
    'aggregator_benchmark_rate', v_order.aggregator_benchmark_rate_snapshot,
    'skrowia_commission_rate', v_order.skrowia_commission_rate_snapshot,
    'skrowia_commissionable_amount', v_order.skrowia_commissionable_amount,
    'skrowia_commission_due', round(
      v_order.skrowia_commissionable_amount
      * v_order.skrowia_commission_rate_snapshot / 100,
      2
    ),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', payment.id,
          'provider', payment.provider,
          'provider_order_id', payment.provider_order_id,
          'provider_payment_id', payment.provider_payment_id,
          'status', payment.status,
          'amount', payment.amount,
          'currency', payment.currency,
          'method', payment.method,
          'gateway_fee', payment.gateway_fee,
          'gateway_tax', payment.gateway_tax,
          'paid_at', payment.paid_at,
          'failed_at', payment.failed_at,
          'created_at', payment.created_at,
          'updated_at', payment.updated_at
        )
        order by payment.created_at, payment.id
      )
      from ordering.payments as payment
      where payment.order_id = v_order.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', refund.id,
          'payment_id', refund.payment_id,
          'amount', refund.amount,
          'method', refund.method,
          'status', refund.status,
          'reason', refund.reason,
          'processed_by', refund.processed_by,
          'external_reference', refund.external_reference,
          'processed_at', refund.processed_at,
          'created_at', refund.created_at
        )
        order by refund.created_at, refund.id
      )
      from ordering.refunds as refund
      where refund.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function ordering.get_payment_provider_for_order (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_provider ordering.location_payment_providers%rowtype;
  v_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_method <> 'online' or v_order.status <> 'payment_pending' then
    raise exception using errcode = '55000', message = 'order is not awaiting online payment';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = v_order.location_id
    and provider.is_active
    and provider.configuration_status = 'ready'
  limit 1;

  if v_provider.id is null then
    raise exception using errcode = '55000', message = 'no ready online payment provider is configured for this outlet';
  end if;

  select secret.decrypted_secret into v_secret
  from vault.decrypted_secrets as secret
  where secret.id = v_provider.credentials_secret_id;

  if v_secret is null then
    raise exception using errcode = '55000', message = 'payment provider credentials are unavailable';
  end if;

  return jsonb_build_object(
    'orderId', v_order.id,
    'locationId', v_order.location_id,
    'provider', v_provider.provider,
    'authMode', v_provider.auth_mode,
    'environment', v_provider.environment,
    'providerAccountId', v_provider.provider_account_id,
    'publicConfig', v_provider.public_config,
    'credentialsSecret', v_secret
  );
end;
$function$;

create or replace function ordering.get_payment_provider_webhook_config (
  p_provider_configuration_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_provider ordering.location_payment_providers%rowtype;
  v_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_provider_configuration_id is null then
    raise exception using errcode = '22023', message = 'provider configuration id is required';
  end if;

  select provider.* into v_provider
  from ordering.location_payment_providers as provider
  where provider.id = p_provider_configuration_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment provider configuration was not found';
  end if;

  if not v_provider.is_active then
    raise exception using errcode = '55000', message = 'payment provider configuration is not active';
  end if;

  select secret.decrypted_secret into v_secret
  from vault.decrypted_secrets as secret
  where secret.id = v_provider.webhook_secret_id;

  if v_secret is null then
    raise exception using errcode = '55000', message = 'webhook secret is unavailable for this provider';
  end if;

  return jsonb_build_object(
    'providerConfigurationId', v_provider.id,
    'locationId', v_provider.location_id,
    'provider', v_provider.provider,
    'environment', v_provider.environment,
    'authMode', v_provider.auth_mode,
    'providerAccountId', v_provider.provider_account_id,
    'webhookSecret', v_secret
  );
end;
$function$;

create or replace function ordering.get_public_menu (
  p_business_slug text,
  p_location_id   uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_business_id uuid;
  v_business_name text;
  v_business_slug text;
  v_business_timezone text;
  v_business_currency text;
  v_location_name text;
  v_address_line_1 text;
  v_address_line_2 text;
  v_locality text;
  v_city text;
  v_state text;
  v_postal_code text;
  v_phone text;
  v_ordering_enabled boolean;
  v_ordering_mode text;
  v_minimum_order_value numeric(14, 2);
  v_accept_orders_when_closed boolean;
  v_tax_mode text;
  v_default_prep_minutes smallint;
  v_ordering_currency text;
  v_is_open_now boolean;
  v_can_accept_orders_now boolean;
begin
  if p_business_slug is null
     or btrim(p_business_slug) = ''
     or p_location_id is null then
    return null;
  end if;

  select
    business.id,
    business.name,
    business.slug,
    business.timezone,
    business.currency,
    location.name,
    location.address_line_1,
    location.address_line_2,
    location.locality,
    location.city,
    location.state,
    location.postal_code,
    location.phone,
    settings.ordering_enabled,
    settings.ordering_mode,
    settings.minimum_order_value,
    settings.accept_orders_when_closed,
    settings.tax_mode,
    settings.default_prep_minutes,
    settings.currency
  into
    v_business_id,
    v_business_name,
    v_business_slug,
    v_business_timezone,
    v_business_currency,
    v_location_name,
    v_address_line_1,
    v_address_line_2,
    v_locality,
    v_city,
    v_state,
    v_postal_code,
    v_phone,
    v_ordering_enabled,
    v_ordering_mode,
    v_minimum_order_value,
    v_accept_orders_when_closed,
    v_tax_mode,
    v_default_prep_minutes,
    v_ordering_currency
  from core.businesses as business
  join core.business_locations as location
    on location.business_id = business.id
  left join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where business.slug = lower(btrim(p_business_slug))
    and business.status = 'active'
    and location.id = p_location_id
    and location.is_active;

  if not found then
    return null;
  end if;

  v_is_open_now := private.is_location_open_at(p_location_id, v_now);
  v_can_accept_orders_now := coalesce(v_ordering_enabled, false)
    and (
      coalesce(v_accept_orders_when_closed, false)
      or v_is_open_now
    );

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business_id,
      'name', v_business_name,
      'slug', v_business_slug,
      'timezone', v_business_timezone,
      'currency', v_business_currency
    ),
    'location', jsonb_build_object(
      'id', p_location_id,
      'name', v_location_name,
      'address_line_1', v_address_line_1,
      'address_line_2', v_address_line_2,
      'locality', v_locality,
      'city', v_city,
      'state', v_state,
      'postal_code', v_postal_code,
      'phone', v_phone
    ),
    'settings', jsonb_build_object(
      'ordering_enabled', coalesce(v_ordering_enabled, false),
      'ordering_mode', v_ordering_mode,
      'minimum_order_value', coalesce(v_minimum_order_value, 0),
      'currency', coalesce(v_ordering_currency, v_business_currency),
      'default_prep_minutes', v_default_prep_minutes,
      'prices_include_tax', coalesce(v_tax_mode = 'inclusive', false)
    ),
    'opening_hours', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day_of_week', hours.day_of_week,
          'opens_at', case
            when hours.opens_at is null then null
            else to_char(hours.opens_at, 'HH24:MI')
          end,
          'closes_at', case
            when hours.closes_at is null then null
            else to_char(hours.closes_at, 'HH24:MI')
          end,
          'is_closed', hours.is_closed
        )
        order by
          hours.day_of_week,
          hours.is_closed desc,
          hours.opens_at nulls first,
          hours.id
      )
      from ordering.opening_hours as hours
      where hours.location_id = p_location_id
    ), '[]'::jsonb),
    'is_open_now', v_is_open_now,
    'can_accept_orders_now', v_can_accept_orders_now,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category_row.id,
          'name', category_row.name,
          'description', category_row.description,
          'sort_order', category_row.sort_order,
          'is_available_now',
            v_can_accept_orders_now and category_row.schedule_available,
          'availability_windows', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day_of_week', availability.day_of_week,
                'starts_at', to_char(availability.starts_at, 'HH24:MI'),
                'ends_at', to_char(availability.ends_at, 'HH24:MI')
              )
              order by availability.day_of_week
            )
            from ordering.catalog_availability_windows as availability
            where availability.location_id = p_location_id
              and availability.category_id = category_row.id
          ), '[]'::jsonb),
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', product_row.id,
                'name', product_row.name,
                'description', product_row.description,
                'price', product_row.effective_price,
                'image_url', product_row.image_url,
                'dietary_type', product_row.dietary_type,
                'is_sold_out', not product_row.stock_available,
                'is_available_now',
                  v_can_accept_orders_now
                  and category_row.schedule_available
                  and product_row.stock_available
                  and product_row.schedule_available
                  and product_row.required_options_satisfied,
                'sort_order', product_row.sort_order,
                'prep_time_minutes', coalesce(
                  product_row.prep_time_minutes,
                  v_default_prep_minutes
                ),
                'availability_windows', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'day_of_week', availability.day_of_week,
                      'starts_at', to_char(
                        availability.starts_at,
                        'HH24:MI'
                      ),
                      'ends_at', to_char(
                        availability.ends_at,
                        'HH24:MI'
                      )
                    )
                    order by availability.day_of_week
                  )
                  from ordering.catalog_availability_windows as availability
                  where availability.location_id = p_location_id
                    and availability.product_id = product_row.id
                ), '[]'::jsonb),
                'option_groups', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', option_group.id,
                      'name', option_group.name,
                      'selection_type', option_group.selection_type,
                      'min_selections', option_group.min_selections,
                      'max_selections', option_group.max_selections,
                      'sort_order', attachment.sort_order,
                      'options', coalesce((
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', option_item.id,
                            'name', option_item.name,
                            'price_delta', option_item.price_delta,
                            'is_available', option_item.is_available,
                            'sort_order', option_item.sort_order
                          )
                          order by
                            option_item.sort_order,
                            option_item.name,
                            option_item.id
                        )
                        from ordering.options as option_item
                        where option_item.option_group_id = option_group.id
                          and option_item.is_active
                      ), '[]'::jsonb)
                    )
                    order by
                      attachment.sort_order,
                      option_group.name,
                      option_group.id
                  )
                  from ordering.product_option_groups as attachment
                  join ordering.option_groups as option_group
                    on option_group.id = attachment.option_group_id
                  where attachment.product_id = product_row.id
                    and option_group.is_active
                ), '[]'::jsonb)
              )
              order by
                product_row.sort_order,
                product_row.name,
                product_row.id
            )
            from (
              select
                product.id,
                product.name,
                product.description,
                coalesce(
                  location_override.price_override,
                  product.base_price
                ) as effective_price,
                product.image_url,
                product.dietary_type,
                product.is_available
                  and coalesce(
                    location_override.is_available,
                    true
                  ) as stock_available,
                product.sort_order,
                product.prep_time_minutes,
                private.catalog_target_available_at(
                  p_location_id,
                  null,
                  product.id,
                  v_now
                ) as schedule_available,
                not exists (
                  select 1
                  from ordering.product_option_groups as required_attachment
                  join ordering.option_groups as required_group
                    on required_group.id = required_attachment.option_group_id
                  where required_attachment.product_id = product.id
                    and required_group.is_active
                    and required_group.min_selections > 0
                    and (
                      select count(*)
                      from ordering.options as available_option
                      where available_option.option_group_id = required_group.id
                        and available_option.is_active
                        and available_option.is_available
                    ) < required_group.min_selections
                ) as required_options_satisfied
              from ordering.products as product
              left join ordering.product_locations as location_override
                on location_override.product_id = product.id
               and location_override.location_id = p_location_id
              where product.business_id = v_business_id
                and product.category_id = category_row.id
                and product.is_active
            ) as product_row
          ), '[]'::jsonb)
        )
        order by
          category_row.sort_order,
          category_row.name,
          category_row.id
      )
      from (
        select
          category.id,
          category.name,
          category.description,
          category.sort_order,
          private.catalog_target_available_at(
            p_location_id,
            category.id,
            null,
            v_now
          ) as schedule_available
        from ordering.menu_categories as category
        where category.business_id = v_business_id
          and category.is_active
          and (
            category.location_id is null
            or category.location_id = p_location_id
          )
          and exists (
            select 1
            from ordering.products as active_product
            where active_product.business_id = v_business_id
              and active_product.category_id = category.id
              and active_product.is_active
          )
      ) as category_row
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function ordering.get_storefront_menu (
  p_location_id uuid
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  with requested_location as (
    select
      location.id as location_id,
      location.business_id,
      location.name as location_name,
      business.name as business_name,
      business.slug as business_slug,
      business.currency,
      business.logo_url as business_logo_url,
      business.timezone as business_timezone,
      coalesce(settings.ordering_enabled, true) as ordering_enabled
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    left join ordering.restaurant_settings as settings
      on settings.location_id = location.id
    where location.id = p_location_id
      and location.is_active
      and business.status = 'active'
  ), current_local_time as (
    select
      requested_location.*,
      extract(isodow from now() at time zone requested_location.business_timezone)::smallint as iso_day_of_week,
      (now() at time zone requested_location.business_timezone)::time as local_time
    from requested_location
  ), visible_categories as (
    select
      category.id,
      category.name,
      category.description,
      category.sort_order,
      current_local_time.location_id,
      current_local_time.business_id,
      current_local_time.iso_day_of_week,
      current_local_time.local_time,
      not exists (
        select 1
        from ordering.catalog_availability_windows as availability_window
        where availability_window.location_id = current_local_time.location_id
          and availability_window.category_id = category.id
      )
      or exists (
        select 1
        from ordering.catalog_availability_windows as availability_window
        where availability_window.location_id = current_local_time.location_id
          and availability_window.category_id = category.id
          and availability_window.day_of_week = current_local_time.iso_day_of_week
          and current_local_time.local_time >= availability_window.starts_at
          and current_local_time.local_time < availability_window.ends_at
      ) as schedule_available
    from current_local_time
    join ordering.menu_categories as category
      on category.business_id = current_local_time.business_id
     and (category.location_id = current_local_time.location_id or category.location_id is null)
    where category.is_active
  ), visible_products as (
    select
      product.id,
      product.category_id,
      product.name,
      product.description,
      coalesce(product_location.price_override, product.base_price) as base_price,
      product.image_url,
      product.dietary_type,
      product.sort_order,
      category.schedule_available
        and product.is_available
        and product_location.is_available
        and (
          not exists (
            select 1
            from ordering.catalog_availability_windows as availability_window
            where availability_window.location_id = category.location_id
              and availability_window.product_id = product.id
          )
          or exists (
            select 1
            from ordering.catalog_availability_windows as availability_window
            where availability_window.location_id = category.location_id
              and availability_window.product_id = product.id
              and availability_window.day_of_week = category.iso_day_of_week
              and category.local_time >= availability_window.starts_at
              and category.local_time < availability_window.ends_at
          )
        )
        and not exists (
          select 1
          from ordering.product_option_groups as product_option_group
          join ordering.option_groups as option_group
            on option_group.id = product_option_group.option_group_id
           and option_group.business_id = category.business_id
          where product_option_group.product_id = product.id
            and option_group.is_active
            and option_group.min_selections > 0
            and not exists (
              select 1
              from ordering.options as option
              where option.option_group_id = option_group.id
                and option.is_active
                and option.is_available
            )
        ) as available
    from visible_categories as category
    join ordering.products as product
      on product.category_id = category.id
     and product.business_id = category.business_id
     and product.is_active
    join ordering.product_locations as product_location
      on product_location.product_id = product.id
     and product_location.location_id = category.location_id
  ), categories_with_products as (
    select category.*
    from visible_categories as category
    where exists (
      select 1
      from visible_products as product
      where product.category_id = category.id
    )
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'orderingEnabled', location.ordering_enabled,
    'business', jsonb_build_object(
      'id', location.business_id,
      'name', location.business_name,
      'slug', location.business_slug,
      'currency', location.currency,
      'logoUrl', location.business_logo_url
    ),
    'location', jsonb_build_object(
      'id', location.location_id,
      'name', location.location_name
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', category.id,
          'name', category.name,
          'description', category.description,
          'sortOrder', category.sort_order,
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', product.id,
                'name', product.name,
                'description', product.description,
                'basePrice', product.base_price,
                'image', product.image_url,
                'dietaryType', product.dietary_type,
                'available', product.available,
                'sortOrder', product.sort_order,
                'optionGroups', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', option_group.id,
                      'name', option_group.name,
                      'selectionType', option_group.selection_type,
                      'minSelections', option_group.min_selections,
                      'maxSelections', option_group.max_selections,
                      'sortOrder', product_option_group.sort_order,
                      'options', coalesce((
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', option.id,
                            'name', option.name,
                            'priceDelta', option.price_delta,
                            'available', option.is_available,
                            'sortOrder', option.sort_order
                          )
                          order by option.sort_order, option.id
                        )
                        from ordering.options as option
                        where option.option_group_id = option_group.id
                          and option.is_active
                          and option.is_available
                      ), '[]'::jsonb)
                    )
                    order by product_option_group.sort_order, option_group.id
                  )
                  from ordering.product_option_groups as product_option_group
                  join ordering.option_groups as option_group
                    on option_group.id = product_option_group.option_group_id
                   and option_group.business_id = location.business_id
                  where product_option_group.product_id = product.id
                    and option_group.is_active
                    and exists (
                      select 1
                      from ordering.options as option
                      where option.option_group_id = option_group.id
                        and option.is_active
                        and option.is_available
                    )
                ), '[]'::jsonb)
              )
              order by product.sort_order, product.id
            )
            from visible_products as product
            where product.category_id = category.id
          ), '[]'::jsonb)
        )
        order by category.sort_order, category.id
      )
      from categories_with_products as category
    ), '[]'::jsonb)
  )
  from current_local_time as location;
$function$;

create or replace function ordering.get_storefront_settings (
  p_location_id uuid
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select jsonb_build_object(
    'schemaVersion', 2,
    'currency', business.currency,
    'locationPhone', location.phone,
    'orderingEnabled', settings.ordering_enabled,
    'orderingMode', settings.ordering_mode,
    'acceptOrdersWhenClosed', settings.accept_orders_when_closed,
    'isOpenNow', private.is_location_open_at(location.id, now()),
    'minimumOrderValue', settings.minimum_order_value,
    'taxMode', settings.tax_mode,
    'taxRate', settings.tax_rate,
    'paymentMethods', jsonb_build_object(
      'defaultMethod', settings.default_payment_method,
      'cash', jsonb_build_object('enabled', settings.cash_on_delivery_enabled),
      'online', jsonb_build_object(
        'configured', exists (
          select 1 from ordering.location_payment_providers as provider
          where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
        ),
        'enabled', settings.online_payments_enabled and exists (
          select 1 from ordering.location_payment_providers as provider
          where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
        ),
        'status', case
          when exists (
            select 1 from ordering.location_payment_providers as provider
            where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
          ) and settings.online_payments_enabled then 'available'
          when exists (
            select 1 from ordering.location_payment_providers as provider
            where provider.location_id = location.id and provider.is_active and provider.configuration_status = 'ready'
          ) then 'disabled'
          else 'not_configured'
        end
      )
    ),
    'deliveryZones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', zone.id,
        'name', zone.name,
        'minDistanceKm', zone.min_distance_km,
        'maxDistanceKm', zone.max_distance_km,
        'deliveryFee', zone.delivery_fee,
        'freeDeliveryThreshold', zone.free_delivery_threshold,
        'minimumOrderValue', zone.minimum_order_value
      ) order by zone.min_distance_km, zone.id)
      from ordering.delivery_zones as zone
      where zone.location_id = location.id and zone.is_active
    ), '[]'::jsonb)
  )
  from core.business_locations as location
  join core.businesses as business on business.id = location.business_id
  join ordering.restaurant_settings as settings on settings.location_id = location.id
  where location.id = p_location_id
    and location.is_active
    and business.status = 'active'
$function$;

create or replace function ordering.get_telegram_message_payload (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram payload requires the trusted backend';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  return jsonb_build_object(
    'id', v_order.id,
    'business_id', v_order.business_id,
    'location_id', v_order.location_id,
    'order_number', v_order.order_number,
    'fulfillment_type', v_order.fulfillment_type,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'currency', v_order.currency,
    'grand_total', v_order.grand_total,
    'customer_name', v_order.customer_name_snapshot,
    'customer_phone', v_order.customer_phone_snapshot,
    'delivery_address', v_order.delivery_address_snapshot,
    'customer_note', v_order.customer_note,
    'restaurant_note', v_order.restaurant_note,
    'estimated_delivery_minutes', v_order.estimated_delivery_minutes,
    'placed_at', v_order.placed_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_name', item.product_name,
          'quantity', item.quantity,
          'line_total', item.line_total,
          'customer_note', item.customer_note,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'option_group_name', selected.option_group_name,
                'option_name', selected.option_name,
                'quantity', selected.quantity
              ) order by selected.id
            )
            from ordering.order_item_options as selected
            where selected.order_item_id = item.id
          ), '[]'::jsonb)
        ) order by item.created_at, item.id
      )
      from ordering.order_items as item
      where item.order_id = v_order.id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function ordering.ingest_analytics_events (
  p_events jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_events jsonb;
  v_business_id uuid;
  v_session_id uuid;
  v_input_count integer;
  v_new_count integer;
  v_recent_count integer;
  v_inserted_count integer;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'analytics ingestion requires the trusted backend';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception using errcode = '22023', message = 'analytics events must be a JSON array';
  end if;

  v_input_count := jsonb_array_length(p_events);
  if v_input_count < 1 or v_input_count > 25 then
    raise exception using errcode = '22023', message = 'analytics event batch size must be between 1 and 25';
  end if;

  -- Supply a UUID only when an internal caller omitted one. Browser retries
  -- should always reuse their generated event UUID for deterministic dedupe.
  select jsonb_agg(
    case
      when entry.value ? 'id' and nullif(entry.value ->> 'id', '') is not null
        then entry.value
      else entry.value || jsonb_build_object('id', gen_random_uuid()::text)
    end
  )
  into v_events
  from jsonb_array_elements(p_events) as entry;

  select event.business_id, event.session_id
  into v_business_id, v_session_id
  from jsonb_to_recordset(v_events) as event(
    id uuid,
    business_id uuid,
    session_id uuid
  )
  limit 1;

  if v_business_id is null or v_session_id is null then
    raise exception using errcode = '22023', message = 'each analytics event requires business_id and session_id';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_events) as event(
      id uuid,
      business_id uuid,
      session_id uuid
    )
    where event.business_id is distinct from v_business_id
       or event.session_id is distinct from v_session_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'every analytics batch must belong to one business and session';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_events) as event(event_name text)
    where event.event_name = 'order_placed'
  ) then
    raise exception using
      errcode = '42501',
      message = 'order_placed must use the trusted order-placement analytics function';
  end if;

  -- A transaction advisory lock makes the database-side session limit safe
  -- across concurrent Edge invocations. The public Edge endpoint must also
  -- rate-limit by client/IP because a malicious caller could mint sessions.
  perform pg_advisory_xact_lock(
    hashtextextended(v_business_id::text || ':' || v_session_id::text, 0)
  );

  select count(distinct input.id)
  into v_new_count
  from jsonb_to_recordset(v_events) as input(id uuid)
  left join ordering.analytics_events as existing
    on existing.id = input.id
  where existing.id is null;

  select count(*)
  into v_recent_count
  from ordering.analytics_events as event
  where event.business_id = v_business_id
    and event.session_id = v_session_id
    and event.occurred_at >= now() - interval '1 minute';

  if v_recent_count + v_new_count > 60 then
    raise exception using
      errcode = '54000',
      message = 'analytics session rate limit exceeded';
  end if;

  with input as (
    select *
    from jsonb_to_recordset(v_events) as event(
      id uuid,
      business_id uuid,
      location_id uuid,
      session_id uuid,
      customer_id uuid,
      cart_id uuid,
      order_id uuid,
      acquisition_source_id uuid,
      event_name text,
      metadata jsonb,
      occurred_at timestamptz
    )
  ), inserted as (
    insert into ordering.analytics_events (
      id,
      business_id,
      location_id,
      session_id,
      customer_id,
      cart_id,
      order_id,
      acquisition_source_id,
      event_name,
      metadata,
      occurred_at
    )
    select input.id,
           input.business_id,
           input.location_id,
           input.session_id,
           input.customer_id,
           input.cart_id,
           input.order_id,
           input.acquisition_source_id,
           input.event_name,
           coalesce(input.metadata, '{}'::jsonb),
           greatest(
             now() - interval '5 minutes',
             least(coalesce(input.occurred_at, now()), now() + interval '1 minute')
           )
    from input
    on conflict (id) do nothing
    returning id
  )
  select count(*) into v_inserted_count from inserted;

  return jsonb_build_object(
    'received', v_input_count,
    'inserted', v_inserted_count,
    'ignored_duplicate', v_input_count - v_inserted_count
  );
end;
$function$;

create or replace function ordering.list_customer_orders (
  p_business_id uuid,
  p_location_id uuid,
  p_limit       integer default 20
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_customer_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  select customer.id into v_customer_id
  from core.customers as customer
  where customer.auth_user_id = (select auth.uid());

  if v_customer_id is null then
    return jsonb_build_object('schemaVersion', 1, 'orders', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'orders', coalesce((
      select jsonb_agg(entry order by entry ->> 'placedAt' desc nulls last)
      from (
        select jsonb_build_object(
          'id', o.id,
          'orderNumber', o.order_number,
          'status', o.status,
          'paymentStatus', o.payment_status,
          'paymentMethod', o.payment_method,
          'fulfillmentType', o.fulfillment_type,
          'currency', o.currency,
          'foodSubtotal', o.food_subtotal,
          'discountTotal', o.discount_total,
          'taxTotal', o.tax_total,
          'deliveryFee', o.delivery_fee,
          'grandTotal', o.grand_total,
          'couponCode', o.coupon_code_snapshot,
          'customerNote', o.customer_note,
          'cancelReason', o.cancel_reason,
          'deliveryAddress', o.delivery_address_snapshot,
          'deliveryContact', case when o.fulfillment_type = 'delivery' then jsonb_build_object(
            'method', coalesce(o.delivery_contact_method_snapshot, 'phone'),
            'phone', coalesce(o.delivery_contact_phone_snapshot, o.customer_phone_snapshot),
            'telegramUsername', o.delivery_contact_telegram_username_snapshot
          ) else null end,
          'estimatedDeliveryMinutes', o.estimated_delivery_minutes,
          'placedAt', o.placed_at,
          'acceptedAt', o.accepted_at,
          'outForDeliveryAt', o.out_for_delivery_at,
          'deliveredAt', o.delivered_at,
          'cancelledAt', o.cancelled_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', item.id,
              'productId', item.product_id,
              'productName', item.product_name,
              'quantity', item.quantity,
              'finalUnitPrice', item.final_unit_price,
              'lineTotal', item.line_total,
              'customerNote', item.customer_note,
              'options', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'optionName', opt.option_name,
                  'optionGroupName', opt.option_group_name,
                  'priceDelta', opt.price_delta
                ) order by opt.option_group_name, opt.option_name)
                from ordering.order_item_options as opt
                where opt.order_item_id = item.id
              ), '[]'::jsonb)
            ) order by item.created_at, item.id)
            from ordering.order_items as item
            where item.order_id = o.id
          ), '[]'::jsonb)
        ) as entry
        from ordering.orders as o
        where o.customer_id = v_customer_id
          and o.business_id = p_business_id
          and o.location_id = p_location_id
          and o.status <> 'payment_pending'
        order by o.placed_at desc nulls last
        limit v_limit
      ) as ordered_entries
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function ordering.list_orders (
  p_business_id       uuid,
  p_statuses          text[]                   default null::text[],
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_id         uuid                     default null::uuid,
  p_limit             integer                  default 50
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.can_operate_orders(p_business_id) then
    raise exception using errcode = '42501', message = 'order queue access denied';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'invalid page size';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception using errcode = '22023', message = 'complete cursor is required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', queue_order.id,
        'order_number', queue_order.order_number,
        'location_id', queue_order.location_id,
        'fulfillment_type', queue_order.fulfillment_type,
        'status', queue_order.status,
        'payment_status', queue_order.payment_status,
        'payment_method', queue_order.payment_method,
        'grand_total', queue_order.grand_total,
        'currency', queue_order.currency,
        'customer_name', queue_order.customer_name_snapshot,
        'customer_phone', queue_order.customer_phone_snapshot,
        'placed_at', queue_order.placed_at,
        'estimated_delivery_minutes', queue_order.estimated_delivery_minutes,
        'created_at', queue_order.created_at
      )
      order by queue_order.created_at desc, queue_order.id desc
    )
    from (
      select placed_order.*
      from ordering.orders as placed_order
      where placed_order.business_id = p_business_id
        and (p_statuses is null or placed_order.status = any(p_statuses))
        and (
          p_before_created_at is null
          or (placed_order.created_at, placed_order.id)
            < (p_before_created_at, p_before_id)
        )
      order by placed_order.created_at desc, placed_order.id desc
      limit p_limit
    ) as queue_order
  ), '[]'::jsonb);
end;
$function$;

create or replace function ordering.list_orders_for_location (
  p_business_id       uuid,
  p_location_id       uuid,
  p_statuses          text[]                   default null::text[],
  p_before_created_at timestamp with time zone default null::timestamp with time zone,
  p_before_id         uuid                     default null::uuid,
  p_limit             integer                  default 50,
  p_from              timestamp with time zone default null::timestamp with time zone,
  p_to                timestamp with time zone default null::timestamp with time zone
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  -- Mirrors backendStatusToDisplay() in the Admin client. Keep the two in
  -- step: a status here that the client cannot map will break the queue.
  v_operator_statuses constant text[] := array[
    'placed',
    'needs_attention',
    'accepted',
    'ready_for_pickup',
    'out_for_delivery',
    'delivered',
    'cancelled'
  ];
begin
  if not (select private.can_operate_orders(p_business_id)) then
    raise exception 'Order queue access denied.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid page size.' using errcode = '22023';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'A complete cursor is required.' using errcode = '22023';
  end if;

  if (p_from is null) <> (p_to is null) then
    raise exception 'A complete date window is required.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', queue_order.id,
        'order_number', queue_order.order_number,
        'fulfillment_type', queue_order.fulfillment_type,
        'status', queue_order.status,
        'payment_status', queue_order.payment_status,
        'payment_method', queue_order.payment_method,
        'currency', queue_order.currency,
        'food_subtotal', queue_order.food_subtotal,
        'discount_total', queue_order.discount_total,
        'tax_total', queue_order.tax_total,
        'delivery_fee', queue_order.delivery_fee,
        'grand_total', queue_order.grand_total,
        'customer_name', queue_order.customer_name_snapshot,
        'customer_phone', queue_order.customer_phone_snapshot,
        'delivery_address', queue_order.delivery_address_snapshot,
        'customer_note', queue_order.customer_note,
        'placed_at', queue_order.placed_at,
        'accepted_at', queue_order.accepted_at,
        'out_for_delivery_at', queue_order.out_for_delivery_at,
        'delivered_at', queue_order.delivered_at,
        'cancelled_at', queue_order.cancelled_at,
        'cancel_reason', queue_order.cancel_reason,
        'estimated_delivery_minutes', queue_order.estimated_delivery_minutes,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'product_name', item.product_name,
            'quantity', item.quantity,
            'customer_note', item.customer_note,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'option_name', option_item.option_name,
                'quantity', option_item.quantity
              ) order by option_item.id)
              from ordering.order_item_options as option_item
              where option_item.order_item_id = item.id
            ), '[]'::jsonb)
          ) order by item.created_at, item.id)
          from ordering.order_items as item
          where item.order_id = queue_order.id
        ), '[]'::jsonb),
        'events', coalesce((
          select jsonb_agg(jsonb_build_object(
            'event_type', event.event_type,
            'created_at', event.created_at
          ) order by event.created_at, event.id)
          from ordering.order_events as event
          where event.order_id = queue_order.id
        ), '[]'::jsonb)
      )
      order by queue_order.created_at desc, queue_order.id desc
    )
    from (
      select placed_order.*
      from ordering.orders as placed_order
      where placed_order.business_id = p_business_id
        and placed_order.location_id = p_location_id
        and placed_order.status = any(v_operator_statuses)
        and (p_statuses is null or placed_order.status = any(p_statuses))
        and (
          p_from is null
          or (placed_order.created_at >= p_from and placed_order.created_at < p_to)
        )
        and (
          p_before_created_at is null
          or (placed_order.created_at, placed_order.id) < (p_before_created_at, p_before_id)
        )
      order by placed_order.created_at desc, placed_order.id desc
      limit p_limit
    ) as queue_order
  ), '[]'::jsonb);
end;
$function$;

create or replace function ordering.list_stale_payment_attempts (
  p_before timestamp with time zone,
  p_limit  integer                  default 100
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_before is null or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'invalid reconciliation query';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'payment_id', payment.id,
        'order_id', payment.order_id,
        'provider', payment.provider,
        'provider_order_id', payment.provider_order_id,
        'provider_payment_id', payment.provider_payment_id,
        'status', payment.status,
        'amount', payment.amount,
        'currency', payment.currency,
        'updated_at', payment.updated_at
      )
      order by payment.updated_at, payment.id
    )
    from (
      select pending_payment.*
      from ordering.payments as pending_payment
      where pending_payment.status in ('created', 'pending', 'authorized')
        and pending_payment.updated_at < p_before
      order by pending_payment.updated_at, pending_payment.id
      limit p_limit
    ) as payment
  ), '[]'::jsonb);
end;
$function$;

create or replace function ordering.list_telegram_reconciliation_candidates (
  p_limit integer default 50
)
  returns table (
    order_id             uuid,
    business_id          uuid,
    telegram_user_id     bigint,
    telegram_chat_id     bigint,
    telegram_message_id  bigint,
    last_rendered_status text,
    current_status       text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram reconciliation requires the trusted backend';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'Telegram reconciliation limit must be between 1 and 100';
  end if;

  return query
  select order_row.id,
         order_row.business_id,
         staff.telegram_user_id,
         coalesce(message.telegram_chat_id, staff.telegram_user_id),
         message.telegram_message_id,
         message.last_rendered_status,
         order_row.status
  from ordering.orders as order_row
  join ordering.telegram_staff as staff
    on staff.business_id = order_row.business_id
   and staff.is_authorized
  left join ordering.telegram_order_messages as message
    on message.order_id = order_row.id
   and message.telegram_chat_id = staff.telegram_user_id
  where order_row.payment_status in ('paid', 'not_required')
    and order_row.status <> 'payment_pending'
    and (
      message.id is null
      or message.last_rendered_status is distinct from order_row.status
    )
  order by order_row.created_at, order_row.id, staff.id
  limit p_limit;
end;
$function$;

create or replace function ordering.list_telegram_staff (
  p_business_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'Telegram staff administration denied';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', staff.id,
        'telegram_user_id', staff.telegram_user_id,
        'display_name', staff.display_name,
        'is_authorized', staff.is_authorized,
        'created_at', staff.created_at
      ) order by staff.display_name, staff.id
    )
    from ordering.telegram_staff as staff
    where staff.business_id = p_business_id
  ), '[]'::jsonb);
end;
$function$;

create or replace function ordering.maintain_cart_lifecycle (
  p_abandon_before timestamp with time zone default (now() - '7 days'::interval),
  p_expire_before  timestamp with time zone default now(),
  p_batch_size     integer                  default 500
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_expired_count integer := 0;
  v_abandoned_count integer := 0;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 5000 then
    raise exception using errcode = '22023', message = 'invalid batch size';
  end if;

  with candidates as (
    select cart.id
    from ordering.carts as cart
    where cart.status in ('active', 'abandoned')
      and cart.expires_at <= p_expire_before
    order by cart.expires_at, cart.id
    for update skip locked
    limit p_batch_size
  )
  update ordering.carts as cart
  set status = 'expired'
  from candidates
  where cart.id = candidates.id;

  get diagnostics v_expired_count = row_count;

  with candidates as (
    select cart.id
    from ordering.carts as cart
    where cart.status = 'active'
      and cart.updated_at < p_abandon_before
      and cart.expires_at > p_expire_before
    order by cart.updated_at, cart.id
    for update skip locked
    limit p_batch_size
  )
  update ordering.carts as cart
  set status = 'abandoned'
  from candidates
  where cart.id = candidates.id;

  get diagnostics v_abandoned_count = row_count;

  return jsonb_build_object(
    'expired', v_expired_count,
    'abandoned', v_abandoned_count
  );
end;
$function$;

create or replace function ordering.mark_payment_pending (
  p_payment_id        uuid,
  p_provider_order_id text,
  p_gateway_payload   jsonb default '{}'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_provider_order_id is null or btrim(p_provider_order_id) = '' then
    raise exception using errcode = '22023', message = 'provider order id is required';
  end if;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment was not found';
  end if;

  if v_payment.status = 'paid' then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'provider_order_id', v_payment.provider_order_id
    );
  end if;

  if v_payment.status = 'pending' then
    if v_payment.provider_order_id = btrim(p_provider_order_id) then
      return jsonb_build_object(
        'payment_id', v_payment.id,
        'status', v_payment.status,
        'provider_order_id', v_payment.provider_order_id
      );
    end if;

    raise exception using
      errcode = '55000',
      message = 'payment is already pending under a different provider order id';
  end if;

  if v_payment.status <> 'created' then
    raise exception using errcode = '55000', message = 'payment is not awaiting provider creation';
  end if;

  update ordering.payments
  set provider_order_id = btrim(p_provider_order_id),
      status = 'pending',
      gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb)
  where id = p_payment_id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'pending',
    'provider_order_id', btrim(p_provider_order_id)
  );
end;
$function$;

create or replace function ordering.open_anonymous_cart (
  p_cart_id               uuid,
  p_business_id           uuid,
  p_location_id           uuid,
  p_anonymous_session_id  uuid,
  p_acquisition_source_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_source_id uuid;
  v_cart_id uuid;
begin
  if p_cart_id is null or p_anonymous_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'stable cart and anonymous session identifiers are required';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    join ordering.restaurant_settings as settings
      on settings.location_id = location.id
    where business.id = p_business_id
      and business.status = 'active'
      and location.id = p_location_id
      and location.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'business location is unavailable';
  end if;

  select source.id
  into v_source_id
  from ordering.acquisition_sources as source
  left join ordering.campaigns as campaign
    on campaign.business_id = source.business_id
   and campaign.id = source.campaign_id
  where source.business_id = p_business_id
    and source.is_active
    and (
      source.id = p_acquisition_source_id
      or (p_acquisition_source_id is null and source.code = 'DIRECT')
    )
    and (
      source.campaign_id is null
      or (
        campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= v_now)
        and (campaign.ends_at is null or v_now < campaign.ends_at)
      )
    );

  if v_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'acquisition source is unavailable';
  end if;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.anonymous_session_id = p_anonymous_session_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now;

  select cart.id
  into v_cart_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.anonymous_session_id = p_anonymous_session_id
    and cart.status = 'abandoned'
    and cart.expires_at > v_now
  order by cart.updated_at desc, cart.id
  limit 1
  for update;

  if v_cart_id is not null then
    update ordering.carts
    set status = 'active',
        acquisition_source_id = v_source_id,
        expires_at = v_now + interval '30 days'
    where id = v_cart_id;
  else
    insert into ordering.carts (
      id,
      business_id,
      location_id,
      anonymous_session_id,
      status,
      acquisition_source_id,
      expires_at
    )
    values (
      p_cart_id,
      p_business_id,
      p_location_id,
      p_anonymous_session_id,
      'active',
      v_source_id,
      v_now + interval '30 days'
    )
    on conflict (business_id, location_id, anonymous_session_id)
      where status = 'active' and anonymous_session_id is not null
    do update
      set acquisition_source_id = excluded.acquisition_source_id,
          expires_at = v_now + interval '30 days'
    returning ordering.carts.id into v_cart_id;
  end if;

  return ordering.get_cart(v_cart_id, p_anonymous_session_id);
end;
$function$;

create or replace function ordering.open_customer_cart (
  p_cart_id               uuid,
  p_business_id           uuid,
  p_location_id           uuid,
  p_customer_business_id  uuid,
  p_acquisition_source_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
  v_customer_id uuid;
  v_source_id uuid;
  v_cart_id uuid;
begin
  select relationship.customer_id
  into v_customer_id
  from core.customer_businesses as relationship
  join core.customers as customer
    on customer.id = relationship.customer_id
  join core.business_locations as location
    on location.business_id = relationship.business_id
  join core.businesses as business
    on business.id = relationship.business_id
  where relationship.id = p_customer_business_id
    and relationship.business_id = p_business_id
    and relationship.status = 'active'
    and customer.auth_user_id = (select auth.uid())
    and location.id = p_location_id
    and location.is_active
    and business.status = 'active';

  if v_customer_id is null then
    raise exception using
      errcode = '42501',
      message = 'active customer relationship is required';
  end if;

  select source.id
  into v_source_id
  from ordering.acquisition_sources as source
  left join ordering.campaigns as campaign
    on campaign.business_id = source.business_id
   and campaign.id = source.campaign_id
  where source.business_id = p_business_id
    and source.is_active
    and (
      source.id = p_acquisition_source_id
      or (p_acquisition_source_id is null and source.code = 'DIRECT')
    )
    and (
      source.campaign_id is null
      or (
        campaign.status = 'active'
        and (campaign.starts_at is null or campaign.starts_at <= v_now)
        and (campaign.ends_at is null or v_now < campaign.ends_at)
      )
    );

  if v_source_id is null then
    raise exception using
      errcode = '22023',
      message = 'acquisition source is unavailable';
  end if;

  -- Locking the customer-business relationship serializes same-customer cart
  -- creation without locking the whole location.
  perform 1
  from core.customer_businesses
  where id = p_customer_business_id
  for update;

  update ordering.carts as expired_cart
  set status = 'expired'
  where expired_cart.business_id = p_business_id
    and expired_cart.location_id = p_location_id
    and expired_cart.customer_id = v_customer_id
    and expired_cart.status in ('active', 'abandoned')
    and expired_cart.expires_at <= v_now;

  select cart.id
  into v_cart_id
  from ordering.carts as cart
  where cart.business_id = p_business_id
    and cart.location_id = p_location_id
    and cart.customer_id = v_customer_id
    and cart.status in ('active', 'abandoned')
    and cart.expires_at > v_now
  order by (cart.status = 'active') desc, cart.updated_at desc, cart.id
  limit 1
  for update;

  if v_cart_id is not null then
    update ordering.carts
    set status = 'active',
        anonymous_session_id = null,
        customer_id = v_customer_id,
        customer_business_id = p_customer_business_id,
        acquisition_source_id = v_source_id,
        expires_at = v_now + interval '30 days'
    where id = v_cart_id;
  else
    insert into ordering.carts (
      id,
      business_id,
      location_id,
      customer_id,
      customer_business_id,
      status,
      acquisition_source_id,
      expires_at
    ) values (
      p_cart_id,
      p_business_id,
      p_location_id,
      v_customer_id,
      p_customer_business_id,
      'active',
      v_source_id,
      v_now + interval '30 days'
    )
    returning id into v_cart_id;
  end if;

  return ordering.get_cart(v_cart_id, null);
end;
$function$;

create or replace function ordering.quote_cart (
  p_cart_id                      uuid,
  p_anonymous_session_id         uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid     default null::uuid,
  p_trusted_delivery_minutes     smallint default null::smallint
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_quote jsonb;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  v_quote := private.calculate_order_quote(
    p_cart_id,
    p_fulfillment_type,
    p_customer_business_address_id,
    p_trusted_delivery_minutes,
    now()
  );

  -- Remove internal economics and raw tax configuration from the customer
  -- response while retaining the payable components.
  return v_quote
    - 'estimated_delivery_cost'
    - 'aggregator_benchmark_rate_snapshot'
    - 'skrowia_commission_rate_snapshot'
    - 'skrowia_commissionable_amount'
    - 'tax_mode'
    - 'tax_rate';
end;
$function$;

create or replace function ordering.record_payment_result (
  p_payment_id          uuid,
  p_result_status       text,
  p_provider_event_id   text,
  p_provider_payment_id text                     default null::text,
  p_method              text                     default null::text,
  p_gateway_payload     jsonb                    default '{}'::jsonb,
  p_gateway_fee         numeric                  default null::numeric,
  p_gateway_tax         numeric                  default null::numeric,
  p_occurred_at         timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_existing_order_id uuid;
  v_order_was_placed boolean := false;
  v_new_order_payment_status text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_result_status not in ('authorized', 'paid', 'failed', 'cancelled')
     or p_provider_event_id is null
     or btrim(p_provider_event_id) = ''
     or char_length(btrim(p_provider_event_id)) > 255
     or (p_gateway_fee is not null and p_gateway_fee < 0)
     or (p_gateway_tax is not null and p_gateway_tax < 0) then
    raise exception using errcode = '22023', message = 'invalid verified payment result';
  end if;

  select event.order_id
  into v_existing_order_id
  from ordering.order_events as event
  join ordering.payments as existing_payment
    on existing_payment.order_id = event.order_id
   and existing_payment.id = p_payment_id
  where event.event_type = 'payment_status_changed'
    and event.metadata ->> 'provider' = existing_payment.provider
    and event.metadata ->> 'provider_event_id' = btrim(p_provider_event_id)
  limit 1;

  if v_existing_order_id is not null then
    return ordering.get_order(v_existing_order_id);
  end if;

  -- Lock order is always payment -> order for webhook/refund consistency.
  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = p_payment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment was not found';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = v_payment.order_id
  for update;

  if v_payment.status = 'paid' then
    return ordering.get_order(v_order.id);
  end if;

  if p_result_status in ('authorized', 'paid')
     and (p_provider_payment_id is null or btrim(p_provider_payment_id) = '') then
    raise exception using
      errcode = '22023',
      message = 'provider payment id is required for authorization or capture';
  end if;

  if p_result_status = 'paid' then
    update ordering.payments
    set provider_payment_id = btrim(p_provider_payment_id),
        status = 'paid',
        method = coalesce(nullif(lower(btrim(p_method)), ''), method),
        gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb),
        gateway_fee = case
          when p_gateway_fee is null then null else round(p_gateway_fee, 2)
        end,
        gateway_tax = case
          when p_gateway_tax is null then null else round(p_gateway_tax, 2)
        end,
        paid_at = coalesce(p_occurred_at, now()),
        failed_at = null
    where id = p_payment_id;

    v_order_was_placed := v_order.status = 'payment_pending';

    update ordering.orders
    set payment_status = 'paid',
        status = case
          when status = 'payment_pending' then 'placed'
          else status
        end,
        placed_at = case
          when status = 'payment_pending' then coalesce(placed_at, p_occurred_at, now())
          else placed_at
        end
    where id = v_order.id;

    v_new_order_payment_status := 'paid';
  else
    update ordering.payments
    set provider_payment_id = coalesce(
          nullif(btrim(p_provider_payment_id), ''),
          provider_payment_id
        ),
        status = p_result_status,
        method = coalesce(nullif(lower(btrim(p_method)), ''), method),
        gateway_payload = coalesce(p_gateway_payload, '{}'::jsonb),
        failed_at = case
          when p_result_status = 'failed' then coalesce(p_occurred_at, now())
          else null
        end
    where id = p_payment_id;

    if p_result_status = 'authorized' then
      v_new_order_payment_status := 'pending';
    elsif exists (
      select 1
      from ordering.payments as other_payment
      where other_payment.order_id = v_order.id
        and other_payment.id <> p_payment_id
        and other_payment.status in ('created', 'pending', 'authorized')
    ) then
      v_new_order_payment_status := 'pending';
    else
      v_new_order_payment_status := 'failed';
    end if;

    update ordering.orders
    set payment_status = v_new_order_payment_status
    where id = v_order.id;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    metadata,
    created_at
  ) values (
    v_order.id,
    v_order.business_id,
    'payment_status_changed',
    v_order.status,
    case when v_order_was_placed then 'placed' else v_order.status end,
    'system',
    jsonb_build_object(
      'schema_version', 1,
      'payment_id', p_payment_id,
      'provider', v_payment.provider,
      'provider_event_id', btrim(p_provider_event_id),
      'from_payment_status', v_order.payment_status,
      'to_payment_status', v_new_order_payment_status,
      'payment_result', p_result_status
    ),
    coalesce(p_occurred_at, now())
  );

  if v_order_was_placed then
    insert into ordering.order_events (
      order_id,
      business_id,
      event_type,
      from_status,
      to_status,
      actor_type,
      metadata,
      created_at
    ) values (
      v_order.id,
      v_order.business_id,
      'order_placed',
      'payment_pending',
      'placed',
      'system',
      jsonb_build_object('schema_version', 1, 'payment_id', p_payment_id),
      coalesce(p_occurred_at, now())
    );
  end if;

  return ordering.get_order(v_order.id);
end;
$function$;

create or replace function ordering.record_trusted_order_placed_event (
  p_order_id   uuid,
  p_session_id uuid,
  p_metadata   jsonb default '{}'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_event_id uuid;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'trusted order analytics requires the trusted backend';
  end if;

  if p_session_id is null then
    raise exception using errcode = '22023', message = 'order analytics requires the checkout session identifier';
  end if;

  select order_row.*
  into v_order
  from ordering.orders as order_row
  where order_row.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_status not in ('paid', 'not_required')
     or v_order.status = 'payment_pending' then
    raise exception using
      errcode = '22023',
      message = 'trusted order analytics requires a paid or no-payment placed order';
  end if;

  select event.id
  into v_event_id
  from ordering.analytics_events as event
  where event.order_id = p_order_id
    and event.event_name = 'order_placed'
  limit 1;

  if v_event_id is not null then
    return jsonb_build_object('id', v_event_id, 'inserted', false);
  end if;

  insert into ordering.analytics_events (
    business_id,
    location_id,
    session_id,
    customer_id,
    order_id,
    acquisition_source_id,
    event_name,
    metadata,
    occurred_at
  ) values (
    v_order.business_id,
    v_order.location_id,
    p_session_id,
    v_order.customer_id,
    v_order.id,
    v_order.acquisition_source_id,
    'order_placed',
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('schema_version', 1),
    now()
  )
  returning id into v_event_id;

  return jsonb_build_object('id', v_event_id, 'inserted', true);
end;
$function$;

create or replace function ordering.remove_cart_item (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_cart_item_id         uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_now timestamptz := now();
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  perform 1
  from ordering.carts as cart
  where cart.id = p_cart_id
    and cart.status = 'active'
    and cart.expires_at > v_now
  for update;

  if not found then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  delete from ordering.cart_items
  where id = p_cart_item_id
    and cart_id = p_cart_id;

  update ordering.carts
  set expires_at = v_now + interval '30 days'
  where id = p_cart_id;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

create or replace function ordering.resolve_storefront_context (
  p_hostname text
)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select jsonb_build_object(
    'businessId', business.id,
    'locationId', location.id,
    'businessName', business.name,
    'locationName', location.name
  )
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  where lower(location.storefront_domain) = rtrim(lower(btrim(p_hostname)), '.')
    and location.is_active
    and business.status = 'active'
  limit 1;
$function$;

create or replace function ordering.save_business_settings (
  p_business_id uuid,
  p_location_id uuid,
  p_baseline    jsonb,
  p_settings    jsonb
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
  v_restaurant_settings ordering.restaurant_settings%rowtype;
  v_current_opening_hours jsonb;
  v_current_delivery_zones jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save business settings.' using errcode = '42501';
  end if;

  if p_baseline is null
    or jsonb_typeof(p_baseline) <> 'object'
    or jsonb_typeof(p_baseline -> 'opening_hours') <> 'array'
    or jsonb_typeof(p_baseline -> 'delivery_zones') <> 'array' then
    raise exception 'The settings baseline is incomplete. Reload and try again.' using errcode = '22023';
  end if;

  if p_settings is null
    or jsonb_typeof(p_settings) <> 'object'
    or jsonb_typeof(p_settings -> 'general') <> 'object'
    or jsonb_typeof(p_settings -> 'restaurant') <> 'object'
    or jsonb_typeof(p_settings -> 'opening_hours') <> 'array'
    or jsonb_typeof(p_settings -> 'delivery_zones') <> 'array' then
    raise exception 'The settings save payload is incomplete.' using errcode = '22023';
  end if;

  select *
  into v_location
  from core.business_locations
  where id = p_location_id
    and business_id = p_business_id
    and is_active
  for update;

  if not found then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception 'You do not have permission to edit business settings for this outlet.' using errcode = '42501';
  end if;

  select *
  into v_business
  from core.businesses
  where id = p_business_id
  for update;

  select *
  into v_restaurant_settings
  from ordering.restaurant_settings
  where location_id = p_location_id
  for update;

  if not found then
    raise exception 'Restaurant settings are not configured for this outlet.' using errcode = '22023';
  end if;

  perform 1
  from ordering.opening_hours
  where location_id = p_location_id
  for update;

  perform 1
  from ordering.delivery_zones
  where location_id = p_location_id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'day_of_week', day_of_week,
        'is_closed', is_closed,
        'opens_at', opens_at,
        'closes_at', closes_at
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_current_opening_hours
  from ordering.opening_hours
  where location_id = p_location_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'name', name,
        'min_distance_km', min_distance_km,
        'max_distance_km', max_distance_km,
        'delivery_fee', delivery_fee,
        'free_delivery_threshold', free_delivery_threshold,
        'minimum_order_value', minimum_order_value,
        'estimated_delivery_cost', estimated_delivery_cost,
        'is_active', is_active,
        'sort_order', sort_order
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_current_delivery_zones
  from ordering.delivery_zones
  where location_id = p_location_id;

  if (p_baseline ->> 'business_updated_at')::timestamptz is distinct from v_business.updated_at
    or (p_baseline ->> 'restaurant_settings_updated_at')::timestamptz is distinct from v_restaurant_settings.updated_at
    or (p_baseline -> 'opening_hours') is distinct from v_current_opening_hours
    or (p_baseline -> 'delivery_zones') is distinct from v_current_delivery_zones then
    raise exception 'Business settings changed in another session. Reload and review the latest values.' using errcode = '40001';
  end if;

  if jsonb_array_length(p_settings -> 'opening_hours') <> 7
    or exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'opening_hours') as item(day_of_week integer)
      where item.day_of_week is null
         or item.day_of_week < 1
         or item.day_of_week > 7
    )
    or exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'opening_hours') as item(day_of_week integer)
      group by day_of_week
      having count(*) <> 1
    ) then
    raise exception 'Opening hours must contain exactly one entry for each day.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Each delivery zone must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
    join ordering.delivery_zones as zone on zone.id = item.id
    where zone.location_id <> p_location_id
  ) then
    raise exception 'A delivery zone belongs to a different outlet.' using errcode = '22023';
  end if;

  update core.businesses
  set
    name = btrim(p_settings -> 'general' ->> 'business_name'),
    updated_at = now()
  where id = p_business_id;

  update core.business_locations
  set
    name = btrim(p_settings -> 'general' ->> 'location_name'),
    phone = nullif(btrim(p_settings -> 'general' ->> 'phone'), ''),
    address_line_1 = btrim(p_settings -> 'general' ->> 'address_line_1'),
    locality = nullif(btrim(p_settings -> 'general' ->> 'locality'), ''),
    city = btrim(p_settings -> 'general' ->> 'city'),
    state = btrim(p_settings -> 'general' ->> 'state'),
    postal_code = nullif(btrim(p_settings -> 'general' ->> 'postal_code'), '')
  where id = p_location_id;

  update ordering.restaurant_settings
  set
    currency = (select currency from core.businesses where id = p_business_id),
    ordering_mode = btrim(p_settings -> 'restaurant' ->> 'ordering_mode'),
    minimum_order_value = (p_settings -> 'restaurant' ->> 'minimum_order_value')::numeric,
    default_prep_minutes = (p_settings -> 'restaurant' ->> 'default_prep_minutes')::smallint,
    accept_orders_when_closed = (p_settings -> 'restaurant' ->> 'accept_orders_when_closed')::boolean,
    tax_mode = btrim(p_settings -> 'restaurant' ->> 'tax_mode'),
    tax_rate = (p_settings -> 'restaurant' ->> 'tax_rate')::numeric
  where location_id = p_location_id;

  delete from ordering.opening_hours
  where location_id = p_location_id;

  insert into ordering.opening_hours (
    location_id,
    day_of_week,
    is_closed,
    opens_at,
    closes_at
  )
  select
    p_location_id,
    item.day_of_week,
    item.is_closed,
    case when item.is_closed then null else item.opens_at end,
    case when item.is_closed then null else item.closes_at end
  from jsonb_to_recordset(p_settings -> 'opening_hours') as item(
    day_of_week integer,
    is_closed boolean,
    opens_at time,
    closes_at time
  );

  -- Temporarily deactivate current zones before applying their replacement
  -- ranges. The existing validation trigger then rejects any final overlap.
  update ordering.delivery_zones
  set is_active = false
  where location_id = p_location_id
    and is_active;

  insert into ordering.delivery_zones as zone (
    id,
    location_id,
    name,
    min_distance_km,
    max_distance_km,
    delivery_fee,
    free_delivery_threshold,
    minimum_order_value,
    estimated_delivery_cost,
    is_active,
    sort_order
  )
  select
    item.id,
    p_location_id,
    btrim(item.name),
    item.min_distance_km,
    item.max_distance_km,
    item.delivery_fee,
    item.free_delivery_threshold,
    item.minimum_order_value,
    item.estimated_delivery_cost,
    item.is_active,
    item.sort_order
  from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(
    id uuid,
    name text,
    min_distance_km numeric,
    max_distance_km numeric,
    delivery_fee numeric,
    free_delivery_threshold numeric,
    minimum_order_value numeric,
    estimated_delivery_cost numeric,
    is_active boolean,
    sort_order integer
  )
  on conflict (id) do update
  set
    name = excluded.name,
    min_distance_km = excluded.min_distance_km,
    max_distance_km = excluded.max_distance_km,
    delivery_fee = excluded.delivery_fee,
    free_delivery_threshold = excluded.free_delivery_threshold,
    minimum_order_value = excluded.minimum_order_value,
    estimated_delivery_cost = excluded.estimated_delivery_cost,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order
  where zone.location_id = p_location_id;

  -- Zones retained by historical orders are deactivated; unused removed zones
  -- are deleted, so the Admin screen no longer shows them.
  update ordering.delivery_zones as zone
  set is_active = false
  where zone.location_id = p_location_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
      where item.id = zone.id
    )
    and exists (
      select 1
      from ordering.orders as order_record
      where order_record.location_id = p_location_id
        and order_record.delivery_zone_id = zone.id
    );

  delete from ordering.delivery_zones as zone
  where zone.location_id = p_location_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_settings -> 'delivery_zones') as item(id uuid)
      where item.id = zone.id
    )
    and not exists (
      select 1
      from ordering.orders as order_record
      where order_record.location_id = p_location_id
        and order_record.delivery_zone_id = zone.id
    );
end;
$function$;

create or replace function ordering.save_featured_product_ids (
  p_business_id uuid,
  p_location_id uuid,
  p_product_ids uuid[]
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save featured products.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to manage featured products.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_product_ids, '{}'::uuid[])) as submitted(product_id)
    left join ordering.product_locations as product_location
      on product_location.product_id = submitted.product_id
     and product_location.location_id = p_location_id
    left join ordering.products as product
      on product.id = submitted.product_id
     and product.business_id = p_business_id
     and product.is_active
    where product_location.product_id is null
      or product.id is null
  ) then
    raise exception 'Every featured product must belong to the selected business and outlet.' using errcode = '22023';
  end if;

  delete from ordering.location_featured_products as featured
  where featured.location_id = p_location_id
    and not (featured.product_id = any(coalesce(p_product_ids, '{}'::uuid[])));

  insert into ordering.location_featured_products as featured (
    product_id,
    location_id,
    sort_order,
    is_active
  )
  select submitted.product_id, p_location_id, submitted.sort_order, true
  from unnest(coalesce(p_product_ids, '{}'::uuid[])) with ordinality as submitted(product_id, sort_order)
  on conflict (product_id, location_id) do update
  set sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now();
end;
$function$;

create or replace function ordering.save_location_payment_methods (
  p_business_id              uuid,
  p_location_id              uuid,
  p_cash_on_delivery_enabled boolean,
  p_online_payments_enabled  boolean
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_current_default text;
  v_default text;
begin
  select settings.default_payment_method
  into v_current_default
  from ordering.restaurant_settings as settings
  where settings.location_id = p_location_id;

  if v_current_default is not null
     and ((v_current_default = 'cash' and p_cash_on_delivery_enabled)
       or (v_current_default = 'online' and p_online_payments_enabled)) then
    v_default := v_current_default;
  elsif p_cash_on_delivery_enabled then
    v_default := 'cash';
  else
    v_default := 'online';
  end if;

  return ordering.save_location_payment_methods(
    p_business_id,
    p_location_id,
    p_cash_on_delivery_enabled,
    p_online_payments_enabled,
    v_default
  );
end;
$function$;

create or replace function ordering.save_location_payment_methods (
  p_business_id              uuid,
  p_location_id              uuid,
  p_cash_on_delivery_enabled boolean,
  p_online_payments_enabled  boolean,
  p_default_payment_method   text
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_default text := lower(btrim(coalesce(p_default_payment_method, '')));
begin
  if p_cash_on_delivery_enabled is null or p_online_payments_enabled is null then
    raise exception using errcode = '22023', message = 'payment method settings are required';
  end if;

  if not p_cash_on_delivery_enabled and not p_online_payments_enabled then
    raise exception using errcode = '22023', message = 'at least one payment method must remain enabled';
  end if;

  if v_default not in ('cash','online') then
    raise exception using errcode = '22023', message = 'default payment method is invalid';
  end if;

  if (v_default = 'cash' and not p_cash_on_delivery_enabled)
     or (v_default = 'online' and not p_online_payments_enabled) then
    raise exception using errcode = '22023', message = 'default payment method must be enabled';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception using errcode = '22023', message = 'selected outlet is unavailable';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception using errcode = '42501', message = 'payment configuration update denied';
  end if;

  if p_online_payments_enabled and not exists (
    select 1
    from ordering.location_payment_providers as provider
    where provider.location_id = p_location_id
      and provider.is_active
      and provider.configuration_status = 'ready'
  ) then
    raise exception using errcode = '22023', message = 'online payments require a ready payment provider for this outlet';
  end if;

  update ordering.restaurant_settings
  set cash_on_delivery_enabled = p_cash_on_delivery_enabled,
      online_payments_enabled = p_online_payments_enabled,
      default_payment_method = v_default
  where location_id = p_location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  return ordering.get_location_payment_configuration(p_business_id, p_location_id);
end;
$function$;

create or replace function ordering.save_menu_changes (
  p_business_id uuid,
  p_location_id uuid,
  p_baseline    jsonb,
  p_menu        jsonb
)
  returns void
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save a menu.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to manage this menu.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if p_menu is null
    or jsonb_typeof(p_menu) <> 'object'
    or jsonb_typeof(p_menu -> 'categories') <> 'array'
    or jsonb_typeof(p_menu -> 'products') <> 'array'
    or jsonb_typeof(p_menu -> 'option_groups') <> 'array'
    or jsonb_typeof(p_menu -> 'product_option_groups') <> 'array'
    or jsonb_typeof(p_menu -> 'category_availability_windows') <> 'array'
    or jsonb_typeof(p_menu -> 'product_availability_windows') <> 'array'
    or jsonb_typeof(p_menu -> 'removed_product_ids') <> 'array' then
    raise exception 'The menu save payload is incomplete.' using errcode = '22023';
  end if;

  if p_baseline is null
    or jsonb_typeof(p_baseline) <> 'object'
    or jsonb_typeof(p_baseline -> 'categories') <> 'array'
    or jsonb_typeof(p_baseline -> 'products') <> 'array' then
    raise exception 'The menu baseline is incomplete.' using errcode = '22023';
  end if;

  if octet_length(p_menu::text) > 1048576 then
    raise exception 'The menu save payload is too large.' using errcode = '54000';
  end if;

  -- Lock the current scope before comparing the client snapshot. Every save
  -- updates these revisions, including option and schedule changes.
  perform 1
  from ordering.menu_categories as category
  where category.business_id = p_business_id
    and category.location_id = p_location_id
  for update;

  perform 1
  from ordering.products as product
  join ordering.menu_categories as category
    on category.id = product.category_id
   and category.business_id = product.business_id
  where product.business_id = p_business_id
    and category.location_id = p_location_id
  for update;

  if exists (
    with baseline as (
      select item.id, item.updated_at
      from jsonb_to_recordset(p_baseline -> 'categories') as item(id uuid, updated_at timestamptz)
    ), current as (
      select category.id, category.updated_at
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    )
    select 1
    from baseline
    full join current using (id)
    where baseline.id is null
      or current.id is null
      or baseline.updated_at is distinct from current.updated_at
  ) then
    raise exception 'The menu changed in another session. Reload and review the latest version.' using errcode = '40001';
  end if;

  if exists (
    with baseline as (
      select item.id, item.updated_at
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), current as (
      select product.id, product.updated_at
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      where product.business_id = p_business_id
        and category.location_id = p_location_id
        and product.is_active
    )
    select 1
    from baseline
    full join current using (id)
    where baseline.id is null
      or current.id is null
      or baseline.updated_at is distinct from current.updated_at
  ) then
    raise exception 'The menu changed in another session. Reload and review the latest version.' using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each category must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each product must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with baseline_products as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), removed_products as (
      select value::uuid as id
      from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
    )
    select 1
    from baseline_products as baseline
    left join incoming_products as incoming on incoming.id = baseline.id
    left join removed_products as removed on removed.id = baseline.id
    where (incoming.id is null and removed.id is null)
       or (incoming.id is not null and removed.id is not null)
  ) then
    raise exception 'Removed products must match the submitted menu snapshot.' using errcode = '22023';
  end if;

  if exists (
    with baseline_products as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'products') as item(id uuid, updated_at timestamptz)
    ), removed_products as (
      select value::uuid as id
      from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
    )
    select 1
    from removed_products as removed
    left join baseline_products as baseline on baseline.id = removed.id
    where baseline.id is null
  ) then
    raise exception 'A removed product was not part of the loaded menu.' using errcode = '22023';
  end if;

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    )
    select 1
    from incoming_categories as incoming
    join ordering.menu_categories as category on category.id = incoming.id
    where category.business_id <> p_business_id
       or category.location_id is distinct from p_location_id
  ) then
    raise exception 'A category belongs to a different menu.' using errcode = '22023';
  end if;

  if exists (
    with baseline_categories as (
      select item.id
      from jsonb_to_recordset(p_baseline -> 'categories') as item(id uuid, updated_at timestamptz)
    ), incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    )
    select 1
    from baseline_categories as baseline
    left join incoming_categories as incoming on incoming.id = baseline.id
    where incoming.id is null
  ) then
    raise exception 'Deleting saved categories is not supported by this menu operation.' using errcode = '22023';
  end if;

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    ), incoming_products as (
      select item.id, item.category_id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    )
    select 1
    from incoming_products as product
    left join incoming_categories as category on category.id = product.category_id
    where category.id is null
  ) then
    raise exception 'Every product must belong to a category in this menu.' using errcode = '22023';
  end if;

  if exists (
    with incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    )
    select 1
    from incoming_products as incoming
    join ordering.products as product on product.id = incoming.id
    where product.business_id <> p_business_id
  ) then
    raise exception 'A product belongs to a different business.' using errcode = '22023';
  end if;

  with incoming_categories as (
    select
      item.id,
      btrim(item.name) as name,
      nullif(btrim(item.description), '') as description,
      item.sort_order,
      item.is_active
    from jsonb_to_recordset(p_menu -> 'categories') as item(
      id uuid,
      name text,
      description text,
      sort_order integer,
      is_active boolean
    )
  )
  insert into ordering.menu_categories as category (
    id,
    business_id,
    location_id,
    name,
    description,
    sort_order,
    is_active
  )
  select
    incoming.id,
    p_business_id,
    p_location_id,
    incoming.name,
    incoming.description,
    incoming.sort_order,
    incoming.is_active
  from incoming_categories as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now()
  where category.business_id = p_business_id
    and category.location_id = p_location_id;

  with incoming_products as (
    select
      item.id,
      item.category_id,
      btrim(item.name) as name,
      nullif(btrim(item.description), '') as description,
      item.base_price,
      nullif(btrim(item.image_url), '') as image_url,
      nullif(btrim(item.dietary_type), '') as dietary_type,
      item.is_available,
      item.sort_order,
      item.prep_time_minutes
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  insert into ordering.products as product (
    id,
    business_id,
    category_id,
    name,
    description,
    base_price,
    image_url,
    dietary_type,
    is_active,
    is_available,
    sort_order,
    prep_time_minutes
  )
  select
    incoming.id,
    p_business_id,
    incoming.category_id,
    incoming.name,
    incoming.description,
    incoming.base_price,
    incoming.image_url,
    incoming.dietary_type,
    true,
    incoming.is_available,
    incoming.sort_order,
    incoming.prep_time_minutes
  from incoming_products as incoming
  on conflict (id) do update
  set
    category_id = excluded.category_id,
    name = excluded.name,
    description = excluded.description,
    base_price = excluded.base_price,
    image_url = excluded.image_url,
    dietary_type = excluded.dietary_type,
    is_active = excluded.is_active,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order,
    prep_time_minutes = excluded.prep_time_minutes,
    updated_at = now()
  where product.business_id = p_business_id;

  with removed_products as (
    select value::uuid as id
    from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
  )
  update ordering.products as product
  set
    is_active = false,
    is_available = false,
    updated_at = now()
  from removed_products as removed,
    ordering.menu_categories as category
  where product.id = removed.id
    and product.business_id = p_business_id
    and category.id = product.category_id
    and category.business_id = product.business_id
    and category.location_id = p_location_id;

  with incoming_products as (
    select item.id, item.location_is_available
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      location_is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  insert into ordering.product_locations as product_location (
    product_id,
    location_id,
    is_available,
    price_override
  )
  select incoming.id, p_location_id, incoming.location_is_available, null
  from incoming_products as incoming
  on conflict (product_id, location_id) do update
  set is_available = excluded.is_available;

  with removed_products as (
    select value::uuid as id
    from jsonb_array_elements_text(p_menu -> 'removed_product_ids')
  )
  update ordering.product_locations as product_location
  set is_available = false
  from removed_products as removed
  where product_location.product_id = removed.id
    and product_location.location_id = p_location_id;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'Each option group must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), incoming_groups as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_links as (
      select item.product_id, item.option_group_id
      from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
        product_id uuid,
        option_group_id uuid,
        sort_order integer
      )
    )
    select 1
    from incoming_links as link
    left join incoming_products as product on product.id = link.product_id
    left join incoming_groups as option_group on option_group.id = link.option_group_id
    where product.id is null or option_group.id is null
  ) then
    raise exception 'Every option-group link must belong to submitted menu items.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
    group by item.product_id, item.option_group_id
    having count(*) > 1
  ) then
    raise exception 'Each product-option group link must be unique.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    )
    select 1
    from incoming_groups as incoming
    join ordering.option_groups as option_group on option_group.id = incoming.id
    where option_group.business_id <> p_business_id
  ) then
    raise exception 'An option group belongs to a different business.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id as option_group_id, item.options
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_options as (
      select option_group.option_group_id, option.id
      from incoming_groups as option_group
      cross join lateral jsonb_to_recordset(option_group.options) as option(
        id uuid,
        name text,
        price_delta numeric,
        is_available boolean,
        sort_order integer
      )
    )
    select 1
    from incoming_options
    group by id
    having count(*) > 1
  ) then
    raise exception 'Each option must have a unique ID.' using errcode = '22023';
  end if;

  if exists (
    with incoming_groups as (
      select item.id as option_group_id, item.options
      from jsonb_to_recordset(p_menu -> 'option_groups') as item(
        id uuid,
        product_id uuid,
        name text,
        selection_type text,
        min_selections smallint,
        max_selections smallint,
        sort_order integer,
        options jsonb
      )
    ), incoming_options as (
      select option_group.option_group_id, option.id
      from incoming_groups as option_group
      cross join lateral jsonb_to_recordset(option_group.options) as option(
        id uuid,
        name text,
        price_delta numeric,
        is_available boolean,
        sort_order integer
      )
    )
    select 1
    from incoming_options as incoming
    join ordering.options as option on option.id = incoming.id
    where option.option_group_id <> incoming.option_group_id
  ) then
    raise exception 'An option belongs to a different option group.' using errcode = '22023';
  end if;

  with incoming_groups as (
    select
      item.id,
      item.product_id,
      btrim(item.name) as name,
      item.selection_type,
      item.min_selections,
      item.max_selections,
      item.sort_order,
      item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  )
  insert into ordering.option_groups as option_group (
    id,
    business_id,
    name,
    selection_type,
    min_selections,
    max_selections,
    sort_order,
    is_active
  )
  select
    incoming.id,
    p_business_id,
    incoming.name,
    incoming.selection_type,
    incoming.min_selections,
    incoming.max_selections,
    incoming.sort_order,
    true
  from incoming_groups as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    selection_type = excluded.selection_type,
    min_selections = excluded.min_selections,
    max_selections = excluded.max_selections,
    sort_order = excluded.sort_order,
    is_active = true
  where option_group.business_id = p_business_id;

  with incoming_links as (
    select item.product_id, item.option_group_id, item.sort_order
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
  )
  insert into ordering.product_option_groups as product_option_group (
    product_id,
    option_group_id,
    sort_order
  )
  select incoming.product_id, incoming.option_group_id, incoming.sort_order
  from incoming_links as incoming
  on conflict (product_id, option_group_id) do update
  set sort_order = excluded.sort_order;

  with incoming_products as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  ), incoming_links as (
    select item.product_id, item.option_group_id
    from jsonb_to_recordset(p_menu -> 'product_option_groups') as item(
      product_id uuid,
      option_group_id uuid,
      sort_order integer
    )
  )
  delete from ordering.product_option_groups as product_option_group
  where product_option_group.product_id in (select id from incoming_products)
    and not exists (
      select 1
      from incoming_links as incoming
      where incoming.option_group_id = product_option_group.option_group_id
        and incoming.product_id = product_option_group.product_id
    );

  with incoming_groups as (
    select item.id, item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  ), incoming_options as (
    select
      option_group.id as option_group_id,
      option.id,
      btrim(option.name) as name,
      option.price_delta,
      option.is_available,
      option.sort_order
    from incoming_groups as option_group
    cross join lateral jsonb_to_recordset(option_group.options) as option(
      id uuid,
      name text,
      price_delta numeric,
      is_available boolean,
      sort_order integer
    )
  )
  insert into ordering.options as option (
    id,
    option_group_id,
    name,
    price_delta,
    is_active,
    is_available,
    sort_order
  )
  select
    incoming.id,
    incoming.option_group_id,
    incoming.name,
    incoming.price_delta,
    true,
    incoming.is_available,
    incoming.sort_order
  from incoming_options as incoming
  on conflict (id) do update
  set
    name = excluded.name,
    price_delta = excluded.price_delta,
    is_active = true,
    is_available = excluded.is_available,
    sort_order = excluded.sort_order
  where option.option_group_id = excluded.option_group_id;

  with incoming_groups as (
    select item.id, item.options
    from jsonb_to_recordset(p_menu -> 'option_groups') as item(
      id uuid,
      product_id uuid,
      name text,
      selection_type text,
      min_selections smallint,
      max_selections smallint,
      sort_order integer,
      options jsonb
    )
  ), incoming_options as (
    select option_group.id as option_group_id, option.id
    from incoming_groups as option_group
    cross join lateral jsonb_to_recordset(option_group.options) as option(
      id uuid,
      name text,
      price_delta numeric,
      is_available boolean,
      sort_order integer
    )
  )
  update ordering.options as option
  set
    is_active = false,
    is_available = false
  where option.option_group_id in (select id from incoming_groups)
    and not exists (
      select 1
      from incoming_options as incoming
      where incoming.id = option.id
        and incoming.option_group_id = option.option_group_id
    );

  if exists (
    with incoming_categories as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
    ), incoming_products as (
      select item.id
      from jsonb_to_recordset(p_menu -> 'products') as item(
        id uuid,
        category_id uuid,
        name text,
        description text,
        base_price numeric,
        image_url text,
        dietary_type text,
        is_available boolean,
        sort_order integer,
        prep_time_minutes smallint
      )
    ), incoming_windows as (
      select item.category_id as target_id, 'category'::text as target_type, item.day_of_week, item.starts_at, item.ends_at
      from jsonb_to_recordset(p_menu -> 'category_availability_windows') as item(
        category_id uuid,
        day_of_week smallint,
        starts_at time,
        ends_at time
      )
      union all
      select item.product_id, 'product'::text, item.day_of_week, item.starts_at, item.ends_at
      from jsonb_to_recordset(p_menu -> 'product_availability_windows') as item(
        product_id uuid,
        day_of_week smallint,
        starts_at time,
        ends_at time
      )
    )
    select 1
    from incoming_windows as availability_window
    where availability_window.target_id is null
       or availability_window.day_of_week not between 1 and 7
       or availability_window.starts_at >= availability_window.ends_at
       or (availability_window.target_type = 'category' and not exists (select 1 from incoming_categories as category where category.id = availability_window.target_id))
       or (availability_window.target_type = 'product' and not exists (select 1 from incoming_products as product where product.id = availability_window.target_id))
  ) then
    raise exception 'Availability windows must belong to submitted menu items and use a valid time range.' using errcode = '22023';
  end if;

  with incoming_categories as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
  ), incoming_products as (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  )
  delete from ordering.catalog_availability_windows as availability_window
  where availability_window.location_id = p_location_id
    and (
      availability_window.category_id in (select id from incoming_categories)
      or availability_window.product_id in (select id from incoming_products)
    );

  insert into ordering.catalog_availability_windows as availability_window (
    location_id,
    category_id,
    product_id,
    day_of_week,
    starts_at,
    ends_at
  )
  select
    p_location_id,
    item.category_id,
    null,
    item.day_of_week,
    item.starts_at,
    item.ends_at
  from jsonb_to_recordset(p_menu -> 'category_availability_windows') as item(
    category_id uuid,
    day_of_week smallint,
    starts_at time,
    ends_at time
  )
  union all
  select
    p_location_id,
    null,
    item.product_id,
    item.day_of_week,
    item.starts_at,
    item.ends_at
  from jsonb_to_recordset(p_menu -> 'product_availability_windows') as item(
    product_id uuid,
    day_of_week smallint,
    starts_at time,
    ends_at time
  );

  -- Option and schedule tables have no revision fields. Touching the parent
  -- records makes their changes part of the next optimistic-concurrency check.
  update ordering.menu_categories as category
  set updated_at = now()
  where category.id in (
    select item.id
    from jsonb_to_recordset(p_menu -> 'categories') as item(id uuid, name text, description text, sort_order integer, is_active boolean)
  );

  update ordering.products as product
  set updated_at = now()
  where product.id in (
    select item.id
    from jsonb_to_recordset(p_menu -> 'products') as item(
      id uuid,
      category_id uuid,
      name text,
      description text,
      base_price numeric,
      image_url text,
      dietary_type text,
      is_available boolean,
      sort_order integer,
      prep_time_minutes smallint
    )
  );
end;
$function$;

create or replace function ordering.save_menu_changes_with_baseline (
  p_business_id          uuid,
  p_location_id          uuid,
  p_baseline             jsonb,
  p_menu                 jsonb,
  p_featured_product_ids uuid[] default null::uuid[]
)
  returns jsonb
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_menu_for_save jsonb;
  v_removed_category_ids uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to save a menu.' using errcode = '42501';
  end if;

  if not (select private.can_manage_catalog(p_business_id))
    or not (select private.can_manage_catalog_at_location(p_location_id)) then
    raise exception 'You do not have permission to manage this menu.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if p_menu is null
    or jsonb_typeof(p_menu) <> 'object'
    or jsonb_typeof(p_menu -> 'removed_category_ids') <> 'array' then
    raise exception 'The menu save payload is incomplete.' using errcode = '22023';
  end if;

  select coalesce(array_agg(item.id), '{}'::uuid[])
  into v_removed_category_ids
  from jsonb_to_recordset(p_menu -> 'removed_category_ids') as item(id uuid);

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'removed_category_ids') as item(id uuid)
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'A category can only be removed once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_removed_category_ids) as removed(id)
    left join jsonb_to_recordset(p_baseline -> 'categories') as baseline(id uuid, updated_at timestamptz)
      on baseline.id = removed.id
    where baseline.id is null
  ) then
    raise exception 'Only categories from the current menu can be removed.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_menu -> 'categories') as category(id uuid, name text, description text, sort_order integer, is_active boolean)
    join unnest(v_removed_category_ids) as removed(id)
      on removed.id = category.id
  ) then
    raise exception 'A removed category cannot also be saved.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_baseline -> 'categories') as baseline(id uuid, updated_at timestamptz)
    left join jsonb_to_recordset(p_menu -> 'categories') as category(id uuid, name text, description text, sort_order integer, is_active boolean)
      on category.id = baseline.id
    left join unnest(v_removed_category_ids) as removed(id)
      on removed.id = baseline.id
    where category.id is null
      and removed.id is null
  ) then
    raise exception 'Categories must be saved or explicitly removed.' using errcode = '22023';
  end if;

  v_menu_for_save := jsonb_set(
    p_menu,
    '{categories}',
    (p_menu -> 'categories') || coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'name', category.name,
        'description', category.description,
        'sort_order', category.sort_order,
        'is_active', category.is_active
      ) order by category.sort_order, category.id)
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
        and category.id = any(v_removed_category_ids)
    ), '[]'::jsonb)
  );

  perform ordering.save_menu_changes(
    p_business_id,
    p_location_id,
    p_baseline,
    v_menu_for_save
  );

  if exists (
    select 1
    from ordering.products as product
    where product.business_id = p_business_id
      and product.category_id = any(v_removed_category_ids)
  ) then
    raise exception 'A category with products cannot be deleted. Move or remove its products first.' using errcode = '23503';
  end if;

delete from ordering.catalog_availability_windows as availability_window
where availability_window.category_id = any(v_removed_category_ids);

  delete from ordering.menu_categories as category
  where category.business_id = p_business_id
    and category.location_id = p_location_id
    and category.id = any(v_removed_category_ids);

  if p_featured_product_ids is not null then
    perform ordering.save_featured_product_ids(
      p_business_id,
      p_location_id,
      p_featured_product_ids
    );
  end if;

  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id,
        'updated_at', category.updated_at
      ) order by category.sort_order, category.id)
      from ordering.menu_categories as category
      where category.business_id = p_business_id
        and category.location_id = p_location_id
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'updated_at', product.updated_at
      ) order by product.sort_order, product.id)
      from ordering.products as product
      join ordering.menu_categories as category
        on category.id = product.category_id
       and category.business_id = product.business_id
      where product.business_id = p_business_id
        and category.location_id = p_location_id
        and product.is_active
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function ordering.set_cart_coupon (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_code                 text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_validation jsonb;
  v_subtotal numeric(14, 2);
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status <> 'active' or v_cart.expires_at <= now() then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if p_code is null or btrim(p_code) = '' then
    update ordering.carts
    set coupon_id = null,
        expires_at = now() + interval '30 days'
    where id = p_cart_id;
  else
    v_subtotal := private.current_cart_subtotal(p_cart_id);
    v_validation := ordering.validate_coupon(
      v_cart.business_id,
      v_cart.location_id,
      p_code,
      v_subtotal,
      now()
    );

    if not coalesce((v_validation ->> 'valid')::boolean, false) then
      raise exception using errcode = '22023', message = 'coupon is unavailable';
    end if;

    update ordering.carts
    set coupon_id = (v_validation ->> 'coupon_id')::uuid,
        expires_at = now() + interval '30 days'
    where id = p_cart_id;
  end if;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

create or replace function ordering.set_cart_item (
  p_cart_id              uuid,
  p_anonymous_session_id uuid,
  p_cart_item_id         uuid,
  p_product_id           uuid,
  p_quantity             integer,
  p_customer_note        text    default null::text,
  p_options              jsonb   default '[]'::jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_now timestamptz := now();
  v_written_id uuid;
begin
  if not (select private.can_access_cart(
    p_cart_id,
    p_anonymous_session_id
  )) then
    raise exception using errcode = '42501', message = 'cart access denied';
  end if;

  if p_cart_item_id is null
     or p_product_id is null
     or p_quantity is null
     or p_quantity <= 0
     or p_options is null
     or jsonb_typeof(p_options) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'valid item, product, quantity, and option array are required';
  end if;

  select cart.*
  into v_cart
  from ordering.carts as cart
  where cart.id = p_cart_id
  for update;

  if v_cart.status <> 'active' or v_cart.expires_at <= v_now then
    if v_cart.status = 'active' and v_cart.expires_at <= v_now then
      update ordering.carts set status = 'expired' where id = p_cart_id;
    end if;
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if not exists (
    select 1
    from ordering.products as product
    join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = product.business_id
    join ordering.restaurant_settings as settings
      on settings.location_id = v_cart.location_id
    left join ordering.product_locations as location_override
      on location_override.product_id = product.id
     and location_override.location_id = v_cart.location_id
    where product.id = p_product_id
      and product.business_id = v_cart.business_id
      and product.is_active
      and product.is_available
      and coalesce(location_override.is_available, true)
      and category.is_active
      and (category.location_id is null or category.location_id = v_cart.location_id)
      and settings.ordering_enabled
      and (
        settings.accept_orders_when_closed
        or private.is_location_open_at(v_cart.location_id, v_now)
      )
      and private.catalog_target_available_at(
        v_cart.location_id,
        category.id,
        null,
        v_now
      )
      and private.catalog_target_available_at(
        v_cart.location_id,
        null,
        product.id,
        v_now
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'product is unavailable for this cart';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value ->> 'option_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception using
      errcode = '22023',
      message = 'each option requires a UUID option_id and positive quantity';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_options) as entry(value)
    group by (entry.value ->> 'option_id')::uuid
    having count(*) > 1
  ) then
    raise exception using
      errcode = '22023',
      message = 'duplicate option selections are not allowed';
  end if;

  if exists (
    with selected as (
      select
        (entry.value ->> 'option_id')::uuid as option_id,
        (entry.value ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_options) as entry(value)
    )
    select 1
    from selected
    left join ordering.options as option_item
      on option_item.id = selected.option_id
    left join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
    left join ordering.product_option_groups as attachment
      on attachment.product_id = p_product_id
     and attachment.option_group_id = option_group.id
    where option_item.id is null
      or not option_item.is_active
      or not option_item.is_available
      or not option_group.is_active
      or attachment.product_id is null
      or selected.quantity <= 0
  ) then
    raise exception using
      errcode = '22023',
      message = 'one or more selected options are unavailable or unattached';
  end if;

  if exists (
    with selected as (
      select
        option_item.option_group_id,
        sum((entry.value ->> 'quantity')::integer) as selected_count
      from jsonb_array_elements(p_options) as entry(value)
      join ordering.options as option_item
        on option_item.id = (entry.value ->> 'option_id')::uuid
      group by option_item.option_group_id
    )
    select 1
    from ordering.product_option_groups as attachment
    join ordering.option_groups as option_group
      on option_group.id = attachment.option_group_id
    left join selected
      on selected.option_group_id = option_group.id
    where attachment.product_id = p_product_id
      and option_group.is_active
      and coalesce(selected.selected_count, 0)
        not between option_group.min_selections and option_group.max_selections
  ) then
    raise exception using
      errcode = '22023',
      message = 'option selection count violates a product option group';
  end if;

  insert into ordering.cart_items as existing_item (
    id,
    cart_id,
    product_id,
    quantity,
    customer_note
  ) values (
    p_cart_item_id,
    p_cart_id,
    p_product_id,
    p_quantity,
    nullif(btrim(p_customer_note), '')
  )
  on conflict (id)
  do update
    set quantity = excluded.quantity,
        customer_note = excluded.customer_note
    where existing_item.cart_id = p_cart_id
      and existing_item.product_id = p_product_id
  returning existing_item.id into v_written_id;

  if v_written_id is null then
    raise exception using
      errcode = '23505',
      message = 'cart item identifier belongs to a different line';
  end if;

  delete from ordering.cart_item_options
  where cart_item_id = p_cart_item_id;

  insert into ordering.cart_item_options (cart_item_id, option_id, quantity)
  select
    p_cart_item_id,
    (entry.value ->> 'option_id')::uuid,
    (entry.value ->> 'quantity')::integer
  from jsonb_array_elements(p_options) as entry(value);

  update ordering.carts
  set expires_at = v_now + interval '30 days'
  where id = p_cart_id;

  return ordering.get_cart(p_cart_id, p_anonymous_session_id);
end;
$function$;

create or replace function ordering.set_manual_refund_status (
  p_refund_id          uuid,
  p_new_status         text,
  p_external_reference text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_refund ordering.refunds%rowtype;
  v_payment ordering.payments%rowtype;
  v_order ordering.orders%rowtype;
  v_operator_id uuid;
  v_completed_total numeric(14, 2);
  v_old_status text;
begin
  if p_new_status not in ('processing', 'completed', 'failed', 'cancelled') then
    raise exception using errcode = '22023', message = 'invalid refund status';
  end if;

  select refund.*
  into v_refund
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'refund was not found';
  end if;

  select payment.*
  into v_payment
  from ordering.payments as payment
  where payment.id = v_refund.payment_id
  for update;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = v_refund.order_id
  for update;

  select operator_user.id
  into v_operator_id
  from core.business_users as membership
  join core.users as operator_user
    on operator_user.id = membership.user_id
  where membership.business_id = v_order.business_id
    and membership.is_active
    and membership.role in ('owner', 'admin')
    and operator_user.auth_user_id = (select auth.uid());

  if v_operator_id is null then
    raise exception using errcode = '42501', message = 'owner or admin is required';
  end if;

  perform refund.id
  from ordering.refunds as refund
  where refund.payment_id = v_refund.payment_id
  order by refund.id
  for update;

  select refund.*
  into v_refund
  from ordering.refunds as refund
  where refund.id = p_refund_id;

  if v_refund.status = p_new_status then
    return ordering.get_order_finance(v_refund.order_id);
  end if;

  if v_refund.status in ('completed', 'cancelled')
     or (
       v_refund.status = 'pending'
       and p_new_status not in ('processing', 'completed', 'failed', 'cancelled')
     )
     or (
       v_refund.status = 'processing'
       and p_new_status not in ('completed', 'failed', 'cancelled')
     )
     or (
       v_refund.status = 'failed'
       and p_new_status not in ('processing', 'completed', 'cancelled')
     ) then
    raise exception using errcode = '22023', message = 'invalid refund transition';
  end if;

  if p_new_status = 'completed'
     and (p_external_reference is null or btrim(p_external_reference) = '') then
    raise exception using
      errcode = '22023',
      message = 'external refund reference is required for completion';
  end if;

  v_old_status := v_refund.status;

  update ordering.refunds
  set status = p_new_status,
      processed_by = case
        when p_new_status = 'completed' then v_operator_id
        else processed_by
      end,
      external_reference = case
        when p_external_reference is null then external_reference
        else btrim(p_external_reference)
      end,
      processed_at = case
        when p_new_status = 'completed' then now()
        else null
      end
  where id = p_refund_id;

  select coalesce(sum(refund.amount), 0)
  into v_completed_total
  from ordering.refunds as refund
  where refund.payment_id = v_refund.payment_id
    and refund.status = 'completed';

  update ordering.orders
  set payment_status = case
    when v_completed_total >= v_payment.amount then 'refunded'
    when v_completed_total > 0 then 'partially_refunded'
    else 'paid'
  end
  where id = v_order.id;

  if p_new_status = 'completed'
     and v_old_status <> 'completed'
     and v_order.status = 'delivered' then
    update core.customer_businesses
    set lifetime_order_value = greatest(
      lifetime_order_value - v_refund.amount,
      0
    )
    where id = v_order.customer_business_id
      and business_id = v_order.business_id
      and customer_id = v_order.customer_id;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  ) values (
    v_order.id,
    v_order.business_id,
    'refund_recorded',
    'admin',
    v_operator_id,
    jsonb_build_object(
      'schema_version', 1,
      'refund_id', p_refund_id,
      'payment_id', v_refund.payment_id,
      'from_refund_status', v_old_status,
      'to_refund_status', p_new_status,
      'amount', v_refund.amount
    )
  );

  return ordering.get_order_finance(v_order.id);
end;
$function$;

create or replace function ordering.set_new_order_alert_duration (
  p_business_id         uuid,
  p_location_id         uuid,
  p_expected_updated_at timestamp with time zone,
  p_duration_seconds    smallint
)
  returns timestamp with time zone
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_updated_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required to change the new-order alert.' using errcode = '42501';
  end if;

  if p_duration_seconds is null or p_duration_seconds not between 1 and 60 then
    raise exception 'The new-order alert duration must be between 1 and 60 seconds.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from core.business_locations as location
    where location.id = p_location_id
      and location.business_id = p_business_id
      and location.is_active
  ) then
    raise exception 'The selected outlet is not active for this business.' using errcode = '22023';
  end if;

  if not (select private.can_manage_sensitive_location_configuration(p_location_id)) then
    raise exception 'You do not have permission to change this outlet setting.' using errcode = '42501';
  end if;

  update ordering.restaurant_settings
  set new_order_alert_duration_seconds = p_duration_seconds
  where location_id = p_location_id
    and updated_at = p_expected_updated_at
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception 'Business settings changed in another session. Reload and review the latest values.' using errcode = '40001';
  end if;

  return v_updated_at;
end;
$function$;

create or replace function ordering.set_order_restaurant_note (
  p_order_id        uuid,
  p_restaurant_note text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_business_id uuid;
begin
  select placed_order.business_id
  into v_business_id
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if v_business_id is null
     or not private.can_operate_orders(v_business_id) then
    raise exception using errcode = '42501', message = 'order note access denied';
  end if;

  update ordering.orders
  set restaurant_note = nullif(btrim(p_restaurant_note), '')
  where id = p_order_id;

  return ordering.get_order(p_order_id);
end;
$function$;

create or replace function ordering.transition_order (
  p_order_id        uuid,
  p_expected_status text,
  p_new_status      text,
  p_cancel_reason   text default null::text
)
  returns jsonb
  language sql
  security definer
  set search_path to ''
  AS $function$
  select private.transition_order_internal(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason,
    'request',
    null
  );
$function$;

create or replace function ordering.transition_order_at_location (
  p_business_id     uuid,
  p_location_id     uuid,
  p_order_id        uuid,
  p_expected_status text,
  p_new_status      text,
  p_cancel_reason   text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.can_operate_orders(p_business_id)) then
    raise exception 'Order update access denied.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from ordering.orders as placed_order
    join core.business_locations as location
      on location.id = placed_order.location_id
     and location.business_id = placed_order.business_id
    where placed_order.id = p_order_id
      and placed_order.business_id = p_business_id
      and placed_order.location_id = p_location_id
      and location.is_active
  ) then
    raise exception 'The order does not belong to the selected outlet.' using errcode = '22023';
  end if;

  return ordering.transition_order(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason
  );
end;
$function$;

create or replace function ordering.transition_order_from_telegram (
  p_order_id         uuid,
  p_expected_status  text,
  p_new_status       text,
  p_telegram_user_id bigint,
  p_cancel_reason    text   default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram transitions require the trusted backend';
  end if;

  return private.transition_order_internal(
    p_order_id,
    p_expected_status,
    p_new_status,
    p_cancel_reason,
    'telegram',
    p_telegram_user_id
  );
end;
$function$;

create or replace function ordering.upsert_telegram_order_message (
  p_order_id             uuid,
  p_telegram_chat_id     bigint,
  p_telegram_message_id  bigint,
  p_last_rendered_status text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order_status text;
  v_message ordering.telegram_order_messages%rowtype;
begin
  if not private.request_is_service_role() then
    raise exception using errcode = '42501', message = 'Telegram message writes require the trusted backend';
  end if;

  select order_row.status
  into v_order_status
  from ordering.orders as order_row
  where order_row.id = p_order_id;

  if v_order_status is null then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if p_last_rendered_status <> v_order_status then
    raise exception using
      errcode = '40001',
      message = 'rendered status is stale; fetch the current order and retry';
  end if;

  insert into ordering.telegram_order_messages (
    order_id,
    telegram_chat_id,
    telegram_message_id,
    last_rendered_status
  ) values (
    p_order_id,
    p_telegram_chat_id,
    p_telegram_message_id,
    p_last_rendered_status
  )
  on conflict (order_id, telegram_chat_id) do update
  set telegram_message_id = excluded.telegram_message_id,
      last_rendered_status = excluded.last_rendered_status
  returning * into v_message;

  return jsonb_build_object(
    'id', v_message.id,
    'order_id', v_message.order_id,
    'telegram_chat_id', v_message.telegram_chat_id,
    'telegram_message_id', v_message.telegram_message_id,
    'last_rendered_status', v_message.last_rendered_status,
    'updated_at', v_message.updated_at
  );
end;
$function$;

create or replace function ordering.upsert_telegram_staff (
  p_business_id      uuid,
  p_telegram_user_id bigint,
  p_display_name     text,
  p_is_authorized    boolean default true
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_staff ordering.telegram_staff%rowtype;
begin
  if not private.can_view_order_finance(p_business_id) then
    raise exception using errcode = '42501', message = 'Telegram staff administration denied';
  end if;

  insert into ordering.telegram_staff (
    business_id,
    telegram_user_id,
    display_name,
    is_authorized
  ) values (
    p_business_id,
    p_telegram_user_id,
    btrim(p_display_name),
    p_is_authorized
  )
  on conflict (business_id, telegram_user_id) do update
  set display_name = excluded.display_name,
      is_authorized = excluded.is_authorized
  returning * into v_staff;

  return jsonb_build_object(
    'id', v_staff.id,
    'business_id', v_staff.business_id,
    'telegram_user_id', v_staff.telegram_user_id,
    'display_name', v_staff.display_name,
    'is_authorized', v_staff.is_authorized,
    'created_at', v_staff.created_at
  );
end;
$function$;

create or replace function ordering.validate_coupon (
  p_business_id            uuid,
  p_location_id            uuid,
  p_code                   text,
  p_eligible_food_subtotal numeric,
  p_at                     timestamp with time zone default now()
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_coupon_id uuid;
  v_code text;
  v_discount_type text;
  v_discount_value numeric(14, 4);
  v_max_discount_amount numeric(14, 2);
  v_discount_amount numeric(14, 2);
begin
  if p_business_id is null
     or p_location_id is null
     or p_code is null
     or btrim(p_code) = ''
     or p_eligible_food_subtotal is null
     or p_eligible_food_subtotal < 0 then
    return jsonb_build_object('valid', false, 'reason', 'invalid_request');
  end if;

  select
    coupon.id,
    coupon.code,
    coupon.discount_type,
    coupon.discount_value,
    coupon.max_discount_amount
  into
    v_coupon_id,
    v_code,
    v_discount_type,
    v_discount_value,
    v_max_discount_amount
  from ordering.coupons as coupon
  join core.business_locations as location
    on location.business_id = coupon.business_id
   and location.id = p_location_id
   and location.is_active
  join core.businesses as business
    on business.id = coupon.business_id
   and business.status = 'active'
  where coupon.business_id = p_business_id
    and coupon.code = upper(btrim(p_code))
    and coupon.is_active
    and (coupon.starts_at is null or coupon.starts_at <= p_at)
    and (coupon.ends_at is null or p_at < coupon.ends_at)
    and p_eligible_food_subtotal >= coupon.minimum_order_value
    and (
      not exists (
        select 1
        from ordering.coupon_locations as any_mapping
        where any_mapping.coupon_id = coupon.id
      )
      or exists (
        select 1
        from ordering.coupon_locations as allowed_location
        where allowed_location.coupon_id = coupon.id
          and allowed_location.location_id = p_location_id
      )
    )
  limit 1;

  if v_coupon_id is null then
    return jsonb_build_object('valid', false, 'reason', 'unavailable');
  end if;

  v_discount_amount := case
    when v_discount_type = 'fixed' then
      round(least(v_discount_value, p_eligible_food_subtotal), 2)
    else
      round(
        least(
          p_eligible_food_subtotal,
          p_eligible_food_subtotal * v_discount_value / 100,
          coalesce(v_max_discount_amount, p_eligible_food_subtotal)
        ),
        2
      )
  end;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon_id,
    'code', v_code,
    'discount_amount', v_discount_amount
  );
end;
$function$;

create or replace function private.analytics_metadata_has_forbidden_key (
  p_value jsonb
)
  returns boolean
  language plpgsql
  immutable
  set search_path to ''
  AS $function$
declare
  v_key text;
  v_child jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in
      select entry.key, entry.value
      from jsonb_each(p_value) as entry
    loop
      -- Hashes and raw identifiers are deliberately excluded too. Analytics
      -- needs funnel counts, not customer identity or payment payloads.
      if lower(v_key) ~ '(email|phone|address|payment|gateway|card|token|secret|otp|customer_name|customer_id)' then
        return true;
      end if;

      if private.analytics_metadata_has_forbidden_key(v_child) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in
      select value
      from jsonb_array_elements(p_value)
    loop
      if private.analytics_metadata_has_forbidden_key(v_child) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$function$;

create or replace function private.calculate_order_quote (
  p_cart_id                      uuid,
  p_fulfillment_type             text,
  p_customer_business_address_id uuid,
  p_trusted_delivery_minutes     smallint,
  p_at                           timestamp with time zone
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_cart ordering.carts%rowtype;
  v_ordering_mode text;
  v_ordering_enabled boolean;
  v_accept_when_closed boolean;
  v_restaurant_minimum numeric(14, 2);
  v_tax_mode text;
  v_tax_rate numeric(7, 4);
  v_currency text;
  v_default_prep_minutes smallint;
  v_aggregator_rate numeric(7, 4);
  v_skrowia_rate numeric(7, 4);
  v_origin_latitude numeric;
  v_origin_longitude numeric;
  v_food_subtotal numeric(14, 2);
  v_coupon_validation jsonb;
  v_coupon_id uuid;
  v_coupon_code text;
  v_coupon_discount numeric(14, 2) := 0;
  v_net_food numeric(14, 2);
  v_tax_total numeric(14, 2);
  v_grand_total numeric(14, 2);
  v_address jsonb;
  v_destination_latitude numeric;
  v_destination_longitude numeric;
  v_distance double precision;
  v_delivery_zone_id uuid;
  v_zone_minimum numeric(14, 2);
  v_normal_delivery_fee numeric(14, 2) := 0;
  v_free_delivery_threshold numeric(14, 2);
  v_delivery_fee numeric(14, 2) := 0;
  v_estimated_delivery_cost numeric(14, 2) := 0;
  v_kitchen_minutes smallint;
  v_estimated_minutes smallint;
begin
  select cart.*
  into v_cart
  from ordering.carts as cart
  join core.businesses as business
    on business.id = cart.business_id
   and business.status = 'active'
  join core.business_locations as location
    on location.business_id = cart.business_id
   and location.id = cart.location_id
   and location.is_active
  where cart.id = p_cart_id;

  if not found then
    raise exception using errcode = '22023', message = 'cart location is unavailable';
  end if;

  select
    settings.ordering_mode,
    settings.ordering_enabled,
    settings.accept_orders_when_closed,
    settings.minimum_order_value,
    settings.tax_mode,
    settings.tax_rate,
    settings.currency,
    settings.default_prep_minutes,
    settings.aggregator_benchmark_rate,
    settings.skrowia_commission_rate,
    location.latitude,
    location.longitude
  into
    v_ordering_mode,
    v_ordering_enabled,
    v_accept_when_closed,
    v_restaurant_minimum,
    v_tax_mode,
    v_tax_rate,
    v_currency,
    v_default_prep_minutes,
    v_aggregator_rate,
    v_skrowia_rate,
    v_origin_latitude,
    v_origin_longitude
  from core.business_locations as location
  join ordering.restaurant_settings as settings
    on settings.location_id = location.id
  where location.id = v_cart.location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant settings are unavailable';
  end if;

  if v_cart.status <> 'active' or v_cart.expires_at <= p_at then
    raise exception using errcode = '55000', message = 'cart is not active';
  end if;

  if v_cart.customer_id is null or v_cart.customer_business_id is null then
    raise exception using errcode = '42501', message = 'checkout requires authentication';
  end if;

  if not v_ordering_enabled
     or (
       not v_accept_when_closed
       and not private.is_location_open_at(v_cart.location_id, p_at)
     ) then
    raise exception using errcode = '55000', message = 'restaurant is not accepting orders';
  end if;

  if p_fulfillment_type not in ('delivery', 'pickup')
     or (p_fulfillment_type = 'delivery' and v_ordering_mode not in ('delivery', 'both'))
     or (p_fulfillment_type = 'pickup' and v_ordering_mode not in ('pickup', 'both')) then
    raise exception using errcode = '22023', message = 'fulfillment type is unavailable';
  end if;

  if v_aggregator_rate is null then
    raise exception using
      errcode = '55000',
      message = 'aggregator benchmark rate must be configured before checkout';
  end if;

  if not exists (
    select 1 from ordering.cart_items as item where item.cart_id = p_cart_id
  ) then
    raise exception using errcode = '22023', message = 'cart is empty';
  end if;

  if exists (
    select 1
    from ordering.cart_items as item
    left join ordering.products as product
      on product.id = item.product_id
    left join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = product.business_id
    left join ordering.product_locations as location_override
      on location_override.product_id = product.id
     and location_override.location_id = v_cart.location_id
    where item.cart_id = p_cart_id
      and (
        product.id is null
        or product.business_id <> v_cart.business_id
        or not product.is_active
        or not product.is_available
        or not coalesce(location_override.is_available, true)
        or category.id is null
        or not category.is_active
        or (category.location_id is not null
            and category.location_id <> v_cart.location_id)
        or not private.catalog_target_available_at(
          v_cart.location_id, category.id, null, p_at
        )
        or not private.catalog_target_available_at(
          v_cart.location_id, null, product.id, p_at
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'cart contains an unavailable product';
  end if;

  if exists (
    select 1
    from ordering.cart_item_options as selection
    join ordering.cart_items as item
      on item.id = selection.cart_item_id
    left join ordering.options as option_item
      on option_item.id = selection.option_id
    left join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
    left join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
     and attachment.option_group_id = option_group.id
    where item.cart_id = p_cart_id
      and (
        option_item.id is null
        or not option_item.is_active
        or not option_item.is_available
        or not option_group.is_active
        or attachment.product_id is null
      )
  ) then
    raise exception using errcode = '22023', message = 'cart contains an unavailable option';
  end if;

  if exists (
    with selected as (
      select
        item.id as cart_item_id,
        option_item.option_group_id,
        sum(selection.quantity) as selected_count
      from ordering.cart_items as item
      join ordering.cart_item_options as selection
        on selection.cart_item_id = item.id
      join ordering.options as option_item
        on option_item.id = selection.option_id
      where item.cart_id = p_cart_id
      group by item.id, option_item.option_group_id
    )
    select 1
    from ordering.cart_items as item
    join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
    join ordering.option_groups as option_group
      on option_group.id = attachment.option_group_id
     and option_group.is_active
    left join selected
      on selected.cart_item_id = item.id
     and selected.option_group_id = option_group.id
    where item.cart_id = p_cart_id
      and coalesce(selected.selected_count, 0)
        not between option_group.min_selections and option_group.max_selections
  ) then
    raise exception using errcode = '22023', message = 'cart option selections are incomplete';
  end if;

  v_food_subtotal := private.current_cart_subtotal(p_cart_id);

  if v_food_subtotal < v_restaurant_minimum then
    raise exception using errcode = '22023', message = 'restaurant minimum order value is not met';
  end if;

  if v_cart.coupon_id is not null then
    select coupon.code
    into v_coupon_code
    from ordering.coupons as coupon
    where coupon.business_id = v_cart.business_id
      and coupon.id = v_cart.coupon_id;

    v_coupon_validation := ordering.validate_coupon(
      v_cart.business_id,
      v_cart.location_id,
      v_coupon_code,
      v_food_subtotal,
      p_at
    );

    if not coalesce((v_coupon_validation ->> 'valid')::boolean, false) then
      raise exception using errcode = '22023', message = 'attached coupon is unavailable';
    end if;

    v_coupon_id := (v_coupon_validation ->> 'coupon_id')::uuid;
    v_coupon_code := v_coupon_validation ->> 'code';
    v_coupon_discount := (v_coupon_validation ->> 'discount_amount')::numeric;
  end if;

  v_net_food := round(v_food_subtotal - v_coupon_discount, 2);

  select max(coalesce(product.prep_time_minutes, v_default_prep_minutes))
  into v_kitchen_minutes
  from ordering.cart_items as item
  join ordering.products as product
    on product.id = item.product_id
  where item.cart_id = p_cart_id;

  if p_fulfillment_type = 'delivery' then
    select
      jsonb_build_object(
        'schema_version', 1,
        'label', address.label,
        'recipient_name', address.recipient_name,
        'recipient_phone', address.recipient_phone,
        'address_line_1', address.address_line_1,
        'address_line_2', address.address_line_2,
        'landmark', address.landmark,
        'locality', address.locality,
        'city', address.city,
        'state', address.state,
        'postal_code', address.postal_code,
        'delivery_instructions', address.delivery_instructions
      ),
      address.latitude,
      address.longitude
    into v_address, v_destination_latitude, v_destination_longitude
    from core.customer_business_addresses as address
    where address.id = p_customer_business_address_id
      and address.customer_business_id = v_cart.customer_business_id
      and address.business_id = v_cart.business_id
      and address.customer_id = v_cart.customer_id;

    if v_address is null then
      raise exception using errcode = '22023', message = 'owned delivery address is required';
    end if;

    v_distance := private.haversine_distance_km(
      v_origin_latitude,
      v_origin_longitude,
      v_destination_latitude,
      v_destination_longitude
    );

    select
      zone.id,
      zone.minimum_order_value,
      zone.delivery_fee,
      zone.free_delivery_threshold,
      zone.estimated_delivery_cost
    into
      v_delivery_zone_id,
      v_zone_minimum,
      v_normal_delivery_fee,
      v_free_delivery_threshold,
      v_estimated_delivery_cost
    from ordering.delivery_zones as zone
    where zone.location_id = v_cart.location_id
      and zone.is_active
      and v_distance >= zone.min_distance_km::double precision
      and v_distance < zone.max_distance_km::double precision
    order by zone.min_distance_km, zone.id
    limit 1;

    if v_delivery_zone_id is null then
      raise exception using errcode = '22023', message = 'delivery address is unserviceable';
    end if;

    if v_food_subtotal < v_zone_minimum then
      raise exception using errcode = '22023', message = 'delivery-zone minimum is not met';
    end if;

    v_delivery_fee := case
      when v_free_delivery_threshold is not null
       and v_net_food >= v_free_delivery_threshold then 0
      else v_normal_delivery_fee
    end;

    if p_trusted_delivery_minutes is null
       or p_trusted_delivery_minutes < v_kitchen_minutes
       or p_trusted_delivery_minutes > 1440 then
      raise exception using
        errcode = '22023',
        message = 'trusted delivery estimate must include kitchen preparation time';
    end if;

    v_estimated_minutes := p_trusted_delivery_minutes;
  else
    if p_customer_business_address_id is not null then
      raise exception using errcode = '22023', message = 'pickup does not accept a delivery address';
    end if;

    v_estimated_minutes := v_kitchen_minutes;
  end if;

  v_tax_total := case
    when v_tax_mode = 'none' then 0
    when v_tax_mode = 'inclusive' then
      round(v_net_food * v_tax_rate / (100 + v_tax_rate), 2)
    else
      round(v_net_food * v_tax_rate / 100, 2)
  end;

  v_grand_total := case
    when v_tax_mode = 'exclusive' then
      round(v_net_food + v_tax_total + v_delivery_fee, 2)
    else
      round(v_net_food + v_delivery_fee, 2)
  end;

  return jsonb_build_object(
    'business_id', v_cart.business_id,
    'location_id', v_cart.location_id,
    'customer_id', v_cart.customer_id,
    'customer_business_id', v_cart.customer_business_id,
    'acquisition_source_id', v_cart.acquisition_source_id,
    'fulfillment_type', p_fulfillment_type,
    'currency', v_currency,
    'food_subtotal', v_food_subtotal,
    'discount_total', v_coupon_discount,
    'coupon_id', v_coupon_id,
    'coupon_code', v_coupon_code,
    'coupon_discount_amount', v_coupon_discount,
    'loyalty_redeemed', 0,
    'tax_total', v_tax_total,
    'delivery_fee', v_delivery_fee,
    'grand_total', v_grand_total,
    'delivery_address_snapshot', v_address,
    'latitude', v_destination_latitude,
    'longitude', v_destination_longitude,
    'delivery_zone_id', v_delivery_zone_id,
    'delivery_distance_km', case
      when v_distance is null then null
      else round(v_distance::numeric, 3)
    end,
    'normal_delivery_fee', v_normal_delivery_fee,
    'estimated_delivery_cost', v_estimated_delivery_cost,
    'aggregator_benchmark_rate_snapshot', v_aggregator_rate,
    'skrowia_commission_rate_snapshot', v_skrowia_rate,
    'skrowia_commissionable_amount', greatest(v_net_food, 0),
    'estimated_delivery_minutes', v_estimated_minutes,
    'tax_mode', v_tax_mode,
    'tax_rate', v_tax_rate
  );
end;
$function$;

create or replace function private.can_access_cart (
  p_cart_id              uuid,
  p_anonymous_session_id uuid default null::uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from ordering.carts as cart
    left join core.customers as customer
      on customer.id = cart.customer_id
    where cart.id = p_cart_id
      and (
        (
          cart.customer_id is not null
          and customer.auth_user_id = (select auth.uid())
        )
        or
        (
          (select private.request_is_service_role())
          and (
            cart.customer_id is not null
            or cart.anonymous_session_id = p_anonymous_session_id
          )
        )
        or
        (
          cart.customer_id is null
          and cart.anonymous_session_id is not null
          and p_anonymous_session_id is not null
          and cart.anonymous_session_id = p_anonymous_session_id
        )
      )
  );
$function$;

create or replace function private.can_manage_attribution (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin', 'manager')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_manage_catalog (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin', 'manager')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_manage_catalog_at_location (
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_locations as location
      join core.business_users as membership
        on membership.business_id = location.business_id
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where location.id = p_location_id
        and membership.is_active
        and membership.role in ('owner', 'admin', 'manager')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_manage_coupon_mapping (
  p_coupon_id   uuid,
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from ordering.coupons as coupon
    join core.business_locations as location
      on location.business_id = coupon.business_id
    where coupon.id = p_coupon_id
      and location.id = p_location_id
      and (select private.can_manage_coupons(coupon.business_id))
  );
$function$;

create or replace function private.can_manage_coupons (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin', 'manager')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_manage_sensitive_business_configuration (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_manage_sensitive_location_configuration (
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_locations as location
      join core.business_users as membership
        on membership.business_id = location.business_id
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where location.id = p_location_id
        and membership.is_active
        and membership.role in ('owner', 'admin')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_operate_orders (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_view_order (
  p_business_id uuid,
  p_customer_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select private.request_is_service_role())
    or (select private.can_operate_orders(p_business_id))
    or exists (
      select 1
      from core.customers as customer
      where customer.id = p_customer_id
        and customer.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.can_view_order_finance (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select private.request_is_service_role())
    or exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and membership.role in ('owner', 'admin')
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.capture_daily_sales_summary_notification_events()
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'sales.daily_summary', 'location', l.id, l.business_id, l.id,
    'location:' || l.id::text || ':summary:' || to_char((now() at time zone b.timezone)::date, 'YYYY-MM-DD'),
    now(),
    jsonb_build_object('summaryDate', to_char((now() at time zone b.timezone)::date, 'YYYY-MM-DD'))
  from core.business_locations l
  join core.businesses b on b.id = l.business_id
  where l.is_active
    and extract(hour from (now() at time zone b.timezone))::int = 23
  on conflict (dedupe_key) do nothing;
end;
$function$;

create or replace function private.capture_notification_event_from_order_event()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_notification_event_type text;
  v_dedupe_key text;
  v_order ordering.orders%rowtype;
begin
  if new.event_type = 'order_placed'
     or (new.event_type = 'order_created' and new.to_status = 'placed') then
    v_notification_event_type := 'order.placed';
    v_dedupe_key := 'order:' || new.order_id::text || ':placed';
  elsif new.event_type = 'order_cancelled' then
    v_notification_event_type := 'order.cancelled';
    v_dedupe_key := 'order:' || new.order_id::text || ':cancelled';
  else
    return new;
  end if;

  select o.* into v_order from ordering.orders o where o.id = new.order_id;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'order not found while capturing notification event';
  end if;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id,
    source_event_id, dedupe_key, occurred_at, payload
  ) values (
    v_notification_event_type, 'order', new.order_id, new.business_id, v_order.location_id,
    new.id, v_dedupe_key, new.created_at,
    jsonb_build_object(
      'schemaVersion', 1,
      'orderId', new.order_id,
      'customerId', v_order.customer_id,
      'actorType', new.actor_type,
      'fromStatus', new.from_status,
      'toStatus', new.to_status
    )
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;

create or replace function private.capture_notification_event_from_ordering_status_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_business_id uuid;
  v_event_type text;
begin
  if new.ordering_enabled is not distinct from old.ordering_enabled then
    return new;
  end if;

  select l.business_id into v_business_id from core.business_locations l where l.id = new.location_id;
  v_event_type := case when new.ordering_enabled then 'store.resumed' else 'store.paused' end;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  ) values (
    v_event_type, 'location', new.location_id, v_business_id, new.location_id,
    'location:' || new.location_id::text || ':' || v_event_type || ':' || extract(epoch from now())::text,
    now(), '{}'::jsonb
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$function$;

create or replace function private.capture_waiting_order_notification_events()
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'order.waiting_3m', 'order', o.id, o.business_id, o.location_id,
    'order:' || o.id::text || ':waiting_3m', now(),
    jsonb_build_object('schemaVersion', 1, 'orderId', o.id, 'customerId', o.customer_id, 'actorType', 'system', 'fromStatus', null, 'toStatus', 'placed')
  from ordering.orders o
  where o.status = 'placed' and o.placed_at <= now() - interval '3 minutes'
  on conflict (dedupe_key) do nothing;

  insert into notifications.events (
    event_type, entity_type, entity_id, business_id, location_id, dedupe_key, occurred_at, payload
  )
  select
    'order.waiting_8m', 'order', o.id, o.business_id, o.location_id,
    'order:' || o.id::text || ':waiting_8m', now(),
    jsonb_build_object('schemaVersion', 1, 'orderId', o.id, 'customerId', o.customer_id, 'actorType', 'system', 'fromStatus', null, 'toStatus', 'placed')
  from ordering.orders o
  where o.status = 'placed' and o.placed_at <= now() - interval '8 minutes'
  on conflict (dedupe_key) do nothing;
end;
$function$;

create or replace function private.catalog_target_available_at (
  p_location_id uuid,
  p_category_id uuid,
  p_product_id  uuid,
  p_at          timestamp with time zone
)
  returns boolean
  language plpgsql
  stable
  set search_path to ''
  AS $function$
declare
  v_local_timestamp timestamp;
  v_has_windows boolean;
  v_current_day smallint;
  v_previous_day smallint;
  v_current_time time;
begin
  if (p_category_id is null) = (p_product_id is null) then
    return false;
  end if;

  select p_at at time zone business.timezone
  into v_local_timestamp
  from core.business_locations as location
  join core.businesses as business
    on business.id = location.business_id
  where location.id = p_location_id;

  if not found then
    return false;
  end if;

  select exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.location_id = p_location_id
      and (
        (p_category_id is not null
         and availability.category_id = p_category_id)
        or
        (p_product_id is not null
         and availability.product_id = p_product_id)
      )
  ) into v_has_windows;

  if not v_has_windows then
    return true;
  end if;

  v_current_day := extract(isodow from v_local_timestamp)::smallint;
  v_previous_day := case
    when v_current_day = 1 then 7
    else v_current_day - 1
  end;
  v_current_time := v_local_timestamp::time;

  return exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.location_id = p_location_id
      and (
        (p_category_id is not null
         and availability.category_id = p_category_id)
        or
        (p_product_id is not null
         and availability.product_id = p_product_id)
      )
      and (
        (
          availability.starts_at < availability.ends_at
          and availability.day_of_week = v_current_day
          and v_current_time >= availability.starts_at
          and v_current_time < availability.ends_at
        )
        or
        (
          availability.starts_at > availability.ends_at
          and (
            (
              availability.day_of_week = v_current_day
              and v_current_time >= availability.starts_at
            )
            or
            (
              availability.day_of_week = v_previous_day
              and v_current_time < availability.ends_at
            )
          )
        )
      )
  );
end;
$function$;

create or replace function private.current_cart_subtotal (
  p_cart_id uuid
)
  returns numeric
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select coalesce(round(sum(
    (
      coalesce(location_override.price_override, product.base_price)
      + coalesce(option_total.amount, 0)
    ) * item.quantity
  ), 2), 0)::numeric(14, 2)
  from ordering.cart_items as item
  join ordering.carts as cart
    on cart.id = item.cart_id
  join ordering.products as product
    on product.id = item.product_id
  left join ordering.product_locations as location_override
    on location_override.product_id = product.id
   and location_override.location_id = cart.location_id
  left join lateral (
    select sum(option_item.price_delta * selection.quantity) as amount
    from ordering.cart_item_options as selection
    join ordering.options as option_item
      on option_item.id = selection.option_id
    where selection.cart_item_id = item.id
  ) as option_total on true
  where item.cart_id = p_cart_id;
$function$;

create or replace function private.customer_can_access_location (
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.customers as customer
      join core.customer_businesses as link
        on link.customer_id = customer.id
      join core.business_locations as location
        on location.business_id = link.business_id
      where customer.auth_user_id = (select auth.uid())
        and location.id = p_location_id
    );
$function$;

create or replace function private.enforce_business_location_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '23514',
      message = 'business-location identity and business scope are immutable';
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_cart_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if tg_table_name = 'carts' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'cart identity, business, and location are immutable';
    end if;
  elsif tg_table_name = 'cart_items' then
    if new.id is distinct from old.id
       or new.product_id is distinct from old.product_id then
      raise exception using
        errcode = '23514',
        message = 'cart-item identity and product are immutable';
    end if;
  elsif tg_table_name = 'cart_item_options' then
    if new.cart_item_id is distinct from old.cart_item_id
       or new.option_id is distinct from old.option_id then
      raise exception using
        errcode = '23514',
        message = 'cart-item option identity is immutable';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_coupon_identity_and_history()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '23514',
      message = 'coupon identity and business are immutable';
  end if;

  if (
    new.code is distinct from old.code
    or new.campaign_id is distinct from old.campaign_id
  ) and (
    exists (
      select 1
      from ordering.carts as cart
      where cart.business_id = old.business_id
        and cart.coupon_id = old.id
    )
    or exists (
      select 1
      from ordering.orders as placed_order
      where placed_order.business_id = old.business_id
        and placed_order.coupon_id = old.id
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'coupon code and campaign are immutable after cart or order use';
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_order_snapshot_immutability()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.order_number is distinct from old.order_number
     or new.business_id is distinct from old.business_id
     or new.location_id is distinct from old.location_id
     or new.customer_id is distinct from old.customer_id
     or new.customer_business_id is distinct from old.customer_business_id
     or new.acquisition_source_id is distinct from old.acquisition_source_id
     or new.fulfillment_type is distinct from old.fulfillment_type
     or new.payment_method is distinct from old.payment_method
     or new.currency is distinct from old.currency
     or new.food_subtotal is distinct from old.food_subtotal
     or new.discount_total is distinct from old.discount_total
     or new.tax_total is distinct from old.tax_total
     or new.delivery_fee is distinct from old.delivery_fee
     or new.loyalty_redeemed is distinct from old.loyalty_redeemed
     or new.grand_total is distinct from old.grand_total
     or new.customer_name_snapshot is distinct from old.customer_name_snapshot
     or new.customer_phone_snapshot is distinct from old.customer_phone_snapshot
     or new.delivery_address_snapshot is distinct from old.delivery_address_snapshot
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.delivery_zone_id is distinct from old.delivery_zone_id
     or new.delivery_distance_km is distinct from old.delivery_distance_km
     or new.normal_delivery_fee is distinct from old.normal_delivery_fee
     or new.estimated_delivery_cost is distinct from old.estimated_delivery_cost
     or new.aggregator_benchmark_rate_snapshot
        is distinct from old.aggregator_benchmark_rate_snapshot
     or new.skrowia_commission_rate_snapshot
        is distinct from old.skrowia_commission_rate_snapshot
     or new.skrowia_commissionable_amount
        is distinct from old.skrowia_commissionable_amount
     or new.estimated_delivery_minutes
        is distinct from old.estimated_delivery_minutes
     or new.coupon_id is distinct from old.coupon_id
     or new.coupon_code_snapshot is distinct from old.coupon_code_snapshot
     or new.coupon_discount_amount is distinct from old.coupon_discount_amount
     or new.customer_note is distinct from old.customer_note
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'order identity and customer/catalog/financial snapshots are immutable';
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_payment_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id
     or new.order_id is distinct from old.order_id
     or new.business_id is distinct from old.business_id
     or new.provider is distinct from old.provider
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '23514',
      message = 'payment attempt identity, provider, and amount are immutable';
  end if;

  if old.status = 'paid' and new.status <> 'paid' then
    raise exception using errcode = '23514', message = 'paid payment cannot be downgraded';
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_phase_b_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if new.id is distinct from old.id then
    raise exception using
      errcode = '23514',
      message = 'row identifiers are immutable';
  end if;

  if tg_table_schema = 'ordering' and tg_table_name = 'campaigns' then
    if new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'campaign business_id is immutable';
    end if;

    if new.code is distinct from old.code and exists (
      select 1
      from core.customer_businesses as relationship
      join ordering.acquisition_sources as source
        on source.business_id = relationship.business_id
       and source.id = relationship.original_acquisition_source_id
      where source.business_id = old.business_id
        and source.campaign_id = old.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'campaign code is immutable after attribution use';
    end if;

  elsif tg_table_schema = 'ordering'
      and tg_table_name = 'acquisition_sources' then
    if new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'acquisition source business_id is immutable';
    end if;

    if old.code = 'DIRECT' and new.code is distinct from old.code then
      raise exception using
        errcode = '23514',
        message = 'the reserved DIRECT source code is immutable';
    end if;

    if (
      new.code is distinct from old.code
      or new.campaign_id is distinct from old.campaign_id
    ) and exists (
      select 1
      from core.customer_businesses as relationship
      where relationship.business_id = old.business_id
        and relationship.original_acquisition_source_id = old.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'source code and campaign are immutable after attribution use';
    end if;

  elsif tg_table_schema = 'core'
      and tg_table_name = 'customer_businesses' then
    if new.business_id is distinct from old.business_id
       or new.customer_id is distinct from old.customer_id
       or new.original_acquisition_source_id
          is distinct from old.original_acquisition_source_id then
      raise exception using
        errcode = '23514',
        message = 'customer relationship identity and first-touch source are immutable';
    end if;

  elsif tg_table_schema = 'core'
      and tg_table_name = 'customer_business_addresses' then
    if new.customer_business_id is distinct from old.customer_business_id
       or new.business_id is distinct from old.business_id
       or new.customer_id is distinct from old.customer_id then
      raise exception using
        errcode = '23514',
        message = 'saved address ownership is immutable';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.enforce_phase_c_identity()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if tg_table_schema <> 'ordering' then
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C trigger target';
  end if;

  if tg_table_name = 'restaurant_settings' then
    if new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'restaurant settings location_id is immutable';
    end if;

  elsif tg_table_name = 'opening_hours' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'opening-hours identity is immutable';
    end if;

  elsif tg_table_name = 'menu_categories' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'menu-category identity, business, and outlet scope are immutable';
    end if;

  elsif tg_table_name = 'products' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'product identity and business are immutable';
    end if;

  elsif tg_table_name = 'product_locations' then
    if new.product_id is distinct from old.product_id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'product-location mapping identity is immutable';
    end if;

  elsif tg_table_name = 'option_groups' then
    if new.id is distinct from old.id
       or new.business_id is distinct from old.business_id then
      raise exception using
        errcode = '23514',
        message = 'option-group identity and business are immutable';
    end if;

  elsif tg_table_name = 'options' then
    if new.id is distinct from old.id
       or new.option_group_id is distinct from old.option_group_id then
      raise exception using
        errcode = '23514',
        message = 'option identity and parent group are immutable';
    end if;

  elsif tg_table_name = 'product_option_groups' then
    if new.product_id is distinct from old.product_id
       or new.option_group_id is distinct from old.option_group_id then
      raise exception using
        errcode = '23514',
        message = 'product-option-group mapping identity is immutable';
    end if;

  elsif tg_table_name = 'delivery_zones' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id then
      raise exception using
        errcode = '23514',
        message = 'delivery-zone identity and location are immutable';
    end if;

  elsif tg_table_name = 'catalog_availability_windows' then
    if new.id is distinct from old.id
       or new.location_id is distinct from old.location_id
       or new.category_id is distinct from old.category_id
       or new.product_id is distinct from old.product_id then
      raise exception using
        errcode = '23514',
        message = 'catalog availability target and location are immutable';
    end if;

  else
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C trigger target';
  end if;

  return new;
end;
$function$;

create or replace function private.haversine_distance_km (
  p_origin_latitude       numeric,
  p_origin_longitude      numeric,
  p_destination_latitude  numeric,
  p_destination_longitude numeric
)
  returns double precision
  language sql
  immutable
  parallel safe
  strict
  set search_path to ''
  AS $function$
  select 6371.0088::double precision * 2::double precision * asin(
    sqrt(
      least(
        1::double precision,
        greatest(
          0::double precision,
          power(
            sin(
              radians(
                (p_destination_latitude - p_origin_latitude)::double precision
              ) / 2::double precision
            ),
            2::double precision
          )
          + cos(radians(p_origin_latitude::double precision))
          * cos(radians(p_destination_latitude::double precision))
          * power(
            sin(
              radians(
                (p_destination_longitude - p_origin_longitude)::double precision
              ) / 2::double precision
            ),
            2::double precision
          )
        )
      )
    )
  );
$function$;

create or replace function private.is_active_business_member (
  p_business_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_users as membership
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where membership.business_id = p_business_id
        and membership.is_active
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.is_active_location_member (
  p_location_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.business_locations as location
      join core.business_users as membership
        on membership.business_id = location.business_id
      join core.users as operator_user
        on operator_user.id = membership.user_id
      where location.id = p_location_id
        and membership.is_active
        and operator_user.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.is_customer_owner (
  p_customer_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from core.customers as customer
      where customer.id = p_customer_id
        and customer.auth_user_id = (select auth.uid())
    );
$function$;

create or replace function private.is_location_open_at (
  p_location_id uuid,
  p_at          timestamp with time zone
)
  returns boolean
  language sql
  stable
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from core.business_locations as location
    join core.businesses as business
      on business.id = location.business_id
    join ordering.opening_hours as hours
      on hours.location_id = location.id
    cross join lateral (
      select p_at at time zone business.timezone as local_timestamp
    ) as local_clock
    where location.id = p_location_id
      and not hours.is_closed
      and (
        (
          hours.opens_at < hours.closes_at
          and hours.day_of_week = extract(
            isodow from local_clock.local_timestamp
          )::smallint
          and local_clock.local_timestamp::time >= hours.opens_at
          and local_clock.local_timestamp::time < hours.closes_at
        )
        or
        (
          hours.opens_at > hours.closes_at
          and (
            (
              hours.day_of_week = extract(
                isodow from local_clock.local_timestamp
              )::smallint
              and local_clock.local_timestamp::time >= hours.opens_at
            )
            or
            (
              hours.day_of_week = case
                when extract(
                  isodow from local_clock.local_timestamp
                )::smallint = 1 then 7
                else extract(
                  isodow from local_clock.local_timestamp
                )::smallint - 1
              end
              and local_clock.local_timestamp::time < hours.closes_at
            )
          )
        )
      )
  );
$function$;

create or replace function private.normalize_attribution_code()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  new.code := upper(btrim(new.code));
  return new;
end;
$function$;

create or replace function private.normalize_delivery_phone (
  p_phone text
)
  returns text
  language sql
  immutable
  set search_path to ''
  AS $function$
  select case
    when p_phone is null or btrim(p_phone) = '' then null
    when btrim(p_phone) ~ '^[+][1-9][0-9]{7,14}$' then btrim(p_phone)
    when regexp_replace(p_phone, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
      then '+91' || regexp_replace(p_phone, '[^0-9]', '', 'g')
    else null
  end;
$function$;

create or replace function private.provision_direct_acquisition_source()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  insert into ordering.acquisition_sources (
    business_id,
    campaign_id,
    code,
    name,
    channel,
    is_active
  )
  values (new.id, null, 'DIRECT', 'Direct', 'direct', true)
  on conflict do nothing;

  return new;
end;
$function$;

create or replace function private.reject_order_snapshot_mutation()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  raise exception using
    errcode = '23514',
    message = 'order line and event snapshots are append-only';
end;
$function$;

create or replace function private.request_is_service_role()
  returns boolean
  language sql
  stable
  set search_path to ''
  AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.jwt() ->> 'role'),
    ''
  ) = 'service_role';
$function$;

create or replace function private.set_updated_at()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function private.snapshot_order_item_id (
  p_order_id     uuid,
  p_cart_item_id uuid
)
  returns uuid
  language sql
  immutable
  parallel safe
  strict
  set search_path to ''
  AS $function$
  with digest as (
    select md5(p_order_id::text || ':' || p_cart_item_id::text) as value
  )
  select (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-' ||
    substr(value, 13, 4) || '-' ||
    substr(value, 17, 4) || '-' ||
    substr(value, 21, 12)
  )::uuid
  from digest;
$function$;

create or replace function private.sync_customer_from_auth_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_phone_e164 text;
  v_customer_email text;
  v_customer_email_verified_at timestamptz;
begin
  v_phone_e164 := case
    when new.phone is null or btrim(new.phone) = '' then null
    else '+' || regexp_replace(new.phone, '[^0-9]', '', 'g')
  end;

  -- customer-auth-msg91 creates this address only because Supabase's
  -- email magic-link exchange needs one. Keep that technical identifier in
  -- auth.users while treating it as absent from the customer profile.
  v_customer_email := case
    when new.email ~* '^msg91_[0-9]+@auth[.]invalid$' then null
    else nullif(btrim(new.email), '')
  end;
  v_customer_email_verified_at := case
    when v_customer_email is null then null
    else new.email_confirmed_at
  end;

  -- If this Auth user is already linked, keep the identity fields in sync.
  update core.customers
  set phone_e164 = v_phone_e164,
      phone_verified_at = new.phone_confirmed_at,
      preferred_contact_phone_e164 = coalesce(core.customers.preferred_contact_phone_e164, v_phone_e164),
      preferred_contact_method = case
        when core.customers.preferred_contact_method is null and v_phone_e164 is not null then 'phone'
        else core.customers.preferred_contact_method
      end,
      email = coalesce(core.customers.email, v_customer_email),
      email_verified_at = case
        when core.customers.email is not null then core.customers.email_verified_at
        else v_customer_email_verified_at
      end,
      updated_at = now()
  where core.customers.auth_user_id = new.id;

  if found then
    return new;
  end if;

  -- Preserve the existing phone-first behavior: an unlinked pre-existing
  -- customer with the same verified phone is adopted by this Auth user.
  if v_phone_e164 is not null then
    insert into core.customers (
      phone_e164,
      auth_user_id,
      preferred_contact_phone_e164,
      preferred_contact_method,
      email,
      phone_verified_at,
      email_verified_at
    )
    values (
      v_phone_e164,
      new.id,
      v_phone_e164,
      'phone',
      v_customer_email,
      new.phone_confirmed_at,
      v_customer_email_verified_at
    )
    on conflict (phone_e164) do update
      set auth_user_id = excluded.auth_user_id,
          phone_verified_at = coalesce(excluded.phone_verified_at, core.customers.phone_verified_at),
          email = coalesce(core.customers.email, excluded.email),
          email_verified_at = case
            when core.customers.email is not null then core.customers.email_verified_at
            else excluded.email_verified_at
          end,
          preferred_contact_phone_e164 = coalesce(core.customers.preferred_contact_phone_e164, excluded.phone_e164),
          preferred_contact_method = coalesce(core.customers.preferred_contact_method, 'phone'),
          updated_at = now()
      where core.customers.auth_user_id is null
         or core.customers.auth_user_id = excluded.auth_user_id;

    return new;
  end if;

  -- OAuth-only users have a valid Supabase Auth identity even without a phone.
  insert into core.customers (
    auth_user_id,
    phone_e164,
    email,
    email_verified_at
  )
  values (
    new.id,
    null,
    v_customer_email,
    v_customer_email_verified_at
  )
  on conflict (auth_user_id) where auth_user_id is not null do update
    set email = coalesce(core.customers.email, excluded.email),
        email_verified_at = case
          when core.customers.email is not null then core.customers.email_verified_at
          else excluded.email_verified_at
        end,
        updated_at = now();

  return new;
end;
$function$;

create or replace function private.transition_order_internal (
  p_order_id         uuid,
  p_expected_status  text,
  p_new_status       text,
  p_cancel_reason    text,
  p_actor_mode       text   default 'request'::text,
  p_telegram_user_id bigint default null::bigint
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_now timestamptz := now();
  v_customer_actor boolean := false;
  v_operator_id uuid;
  v_service_actor boolean := false;
  v_telegram_staff_id uuid;
  v_allowed boolean := false;
  v_event_type text;
  v_actor_type text;
  v_actor_id uuid;
begin
  if p_actor_mode not in ('request', 'telegram') then
    raise exception using errcode = '22023', message = 'invalid transition actor mode';
  end if;

  select placed_order.*
  into v_order
  from ordering.orders as placed_order
  where placed_order.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  v_service_actor := private.request_is_service_role();

  if p_actor_mode = 'telegram' then
    if not v_service_actor then
      raise exception using errcode = '42501', message = 'Telegram transitions require the trusted backend';
    end if;

    if p_telegram_user_id is null then
      raise exception using errcode = '22023', message = 'Telegram sender identifier is required';
    end if;

    select staff.id
    into v_telegram_staff_id
    from ordering.telegram_staff as staff
    where staff.business_id = v_order.business_id
      and staff.telegram_user_id = p_telegram_user_id
      and staff.is_authorized
    for update;

    if v_telegram_staff_id is null then
      raise exception using errcode = '42501', message = 'Telegram staff authorization denied';
    end if;
  else
    select exists (
      select 1
      from core.customers as customer
      where customer.id = v_order.customer_id
        and customer.auth_user_id = (select auth.uid())
    ) into v_customer_actor;

    select operator_user.id
    into v_operator_id
    from core.business_users as membership
    join core.users as operator_user
      on operator_user.id = membership.user_id
    where membership.business_id = v_order.business_id
      and membership.is_active
      and operator_user.auth_user_id = (select auth.uid());

    if not v_service_actor and not v_customer_actor and v_operator_id is null then
      raise exception using errcode = '42501', message = 'order transition denied';
    end if;
  end if;

  -- The duplicate callback acknowledgement is intentionally successful, but
  -- authorization above still has to pass for a disabled staff mapping.
  if v_order.status = p_new_status then
    return ordering.get_order(p_order_id);
  end if;

  if v_order.status <> p_expected_status then
    raise exception using
      errcode = '40001',
      message = 'order status changed before this transition';
  end if;

  if p_new_status = 'cancelled' then
    if p_cancel_reason is null or btrim(p_cancel_reason) = '' then
      raise exception using errcode = '22023', message = 'cancellation reason is required';
    end if;

    v_allowed := (
      p_actor_mode = 'request'
      and v_customer_actor
      and v_operator_id is null
      and v_order.status = 'placed'
      and v_order.placed_at is not null
      and v_now < v_order.placed_at + interval '90 seconds'
    ) or (
      (v_operator_id is not null or v_telegram_staff_id is not null)
      and v_order.status in (
        'placed', 'needs_attention', 'accepted',
        'ready_for_pickup', 'out_for_delivery'
      )
    ) or (
      p_actor_mode = 'request'
      and v_service_actor
      and v_order.status <> 'delivered'
      and v_order.status <> 'cancelled'
    );
  elsif p_actor_mode = 'request'
      and v_service_actor
      and v_order.status = 'payment_pending'
      and p_new_status = 'placed' then
    v_allowed := v_order.payment_status in ('paid', 'not_required');
  elsif v_operator_id is not null or v_telegram_staff_id is not null then
    v_allowed := (
      (v_order.status = 'placed' and p_new_status in ('accepted', 'needs_attention'))
      or
      (v_order.status = 'needs_attention' and p_new_status = 'accepted')
      or
      (
        v_order.status = 'accepted'
        and v_order.fulfillment_type = 'delivery'
        and p_new_status = 'out_for_delivery'
      )
      or
      (
        v_order.status = 'accepted'
        and v_order.fulfillment_type = 'pickup'
        and p_new_status = 'ready_for_pickup'
      )
      or
      (
        v_order.status = 'out_for_delivery'
        and v_order.fulfillment_type = 'delivery'
        and p_new_status = 'delivered'
      )
      or
      (
        v_order.status = 'ready_for_pickup'
        and v_order.fulfillment_type = 'pickup'
        and p_new_status = 'delivered'
      )
    );
  end if;

  if p_new_status in (
    'accepted', 'needs_attention', 'ready_for_pickup',
    'out_for_delivery', 'delivered'
  ) and not (
    v_order.payment_status = 'paid'
    or (v_order.payment_method = 'cash' and v_order.payment_status = 'pending')
  ) then
    v_allowed := false;
  end if;

  if not v_allowed then
    raise exception using errcode = '22023', message = 'invalid order transition';
  end if;

  update ordering.orders
  set status = p_new_status,
      placed_at = case
        when p_new_status = 'placed' then coalesce(placed_at, v_now)
        else placed_at
      end,
      accepted_at = case
        when p_new_status = 'accepted' then coalesce(accepted_at, v_now)
        else accepted_at
      end,
      out_for_delivery_at = case
        when p_new_status = 'out_for_delivery'
          then coalesce(out_for_delivery_at, v_now)
        else out_for_delivery_at
      end,
      delivered_at = case
        when p_new_status = 'delivered' then coalesce(delivered_at, v_now)
        else delivered_at
      end,
      cancelled_at = case
        when p_new_status = 'cancelled' then coalesce(cancelled_at, v_now)
        else cancelled_at
      end,
      cancel_reason = case
        when p_new_status = 'cancelled' then btrim(p_cancel_reason)
        else cancel_reason
      end
  where id = p_order_id
    and status = p_expected_status;

  if not found then
    raise exception using errcode = '40001', message = 'order transition lost a race';
  end if;

  v_event_type := case p_new_status
    when 'placed' then 'order_placed'
    when 'accepted' then 'order_accepted'
    when 'needs_attention' then 'order_needs_attention'
    when 'ready_for_pickup' then 'order_ready_for_pickup'
    when 'out_for_delivery' then 'order_out_for_delivery'
    when 'delivered' then 'order_delivered'
    when 'cancelled' then 'order_cancelled'
  end;

  if v_telegram_staff_id is not null then
    v_actor_type := 'telegram';
    v_actor_id := v_telegram_staff_id;
  elsif v_operator_id is not null then
    v_actor_type := 'admin';
    v_actor_id := v_operator_id;
  elsif v_customer_actor and not v_service_actor then
    v_actor_type := 'customer';
    v_actor_id := v_order.customer_id;
  else
    v_actor_type := 'system';
    v_actor_id := null;
  end if;

  insert into ordering.order_events (
    order_id,
    business_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    metadata
  ) values (
    p_order_id,
    v_order.business_id,
    v_event_type,
    v_order.status,
    p_new_status,
    v_actor_type,
    v_actor_id,
    case
      when p_new_status = 'cancelled' then
        jsonb_build_object(
          'schema_version', 1,
          'reason', btrim(p_cancel_reason),
          'paid_amount', case
            when v_order.payment_status in (
              'paid', 'partially_refunded', 'refunded'
            ) then v_order.grand_total
            else 0
          end,
          'manual_refund_required', v_order.payment_status in (
            'paid', 'partially_refunded'
          )
        )
      else jsonb_build_object('schema_version', 1)
    end
  );

  if p_new_status = 'delivered' then
    update core.customer_businesses
    set first_order_at = coalesce(first_order_at, v_now),
        last_order_at = greatest(coalesce(last_order_at, v_now), v_now),
        order_count = order_count + 1,
        lifetime_order_value = lifetime_order_value + v_order.grand_total
    where id = v_order.customer_business_id
      and business_id = v_order.business_id
      and customer_id = v_order.customer_id;
  end if;

  return ordering.get_order(p_order_id);
end;
$function$;

create or replace function private.validate_analytics_event()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
begin
  -- Metadata is intentionally a small, flat, event-specific envelope. A
  -- key-name blocklist alone cannot prove that a free-text value has no PII.
  -- The allowlist below removes arbitrary notes, URLs, payloads, and IDs from
  -- this analytics surface entirely.
  if exists (
    select 1
    from jsonb_object_keys(new.metadata) as metadata_key(key)
    where metadata_key.key not in (
      'schema_version',
      'surface',
      'product_id',
      'quantity',
      'fulfillment_type',
      'provider',
      'reason_code',
      'permission_state'
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'analytics metadata includes an unsupported key';
  end if;

  if private.analytics_metadata_has_forbidden_key(new.metadata) then
    raise exception using
      errcode = '22023',
      message = 'analytics metadata contains a forbidden PII or payment key';
  end if;

  if new.metadata ? 'surface'
     and (
       new.event_name <> 'menu_viewed'
       or coalesce(new.metadata ->> 'surface', '') !~ '^[a-z][a-z0-9_-]{0,31}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics surface metadata is invalid';
  end if;

  if (new.metadata ? 'product_id') or (new.metadata ? 'quantity') then
    if new.event_name <> 'item_added_to_cart'
       or not (new.metadata ? 'product_id' and new.metadata ? 'quantity')
       or coalesce(new.metadata ->> 'product_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(new.metadata ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$'
       or (new.metadata ->> 'quantity')::integer > 100
       or not exists (
         select 1
         from ordering.products as product
         where product.id = (new.metadata ->> 'product_id')::uuid
           and product.business_id = new.business_id
       ) then
      raise exception using errcode = '22023', message = 'analytics item metadata is invalid';
    end if;
  elsif new.event_name = 'item_added_to_cart' then
    raise exception using
      errcode = '22023',
      message = 'item_added_to_cart requires product_id and quantity metadata';
  end if;

  if new.metadata ? 'fulfillment_type'
     and (
       new.event_name <> 'checkout_started'
       or new.metadata ->> 'fulfillment_type' not in ('delivery', 'pickup')
     ) then
    raise exception using errcode = '22023', message = 'analytics fulfillment metadata is invalid';
  end if;

  if new.metadata ? 'provider'
     and (
       new.event_name not in ('payment_started', 'payment_failed')
       or coalesce(new.metadata ->> 'provider', '') !~ '^[a-z][a-z0-9_-]{0,49}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics provider metadata is invalid';
  end if;

  if new.metadata ? 'reason_code'
     and (
       new.event_name not in (
         'payment_failed', 'otp_failed', 'delivery_unserviceable'
       )
       or coalesce(new.metadata ->> 'reason_code', '') !~ '^[a-z][a-z0-9_-]{0,63}$'
     ) then
    raise exception using errcode = '22023', message = 'analytics reason metadata is invalid';
  end if;

  if new.metadata ? 'permission_state'
     and (
       new.event_name <> 'location_permission_denied'
       or new.metadata ->> 'permission_state' <> 'denied'
     ) then
    raise exception using errcode = '22023', message = 'analytics permission metadata is invalid';
  end if;

  if new.event_name = 'order_placed' then
    select order_row.*
    into v_order
    from ordering.orders as order_row
    where order_row.id = new.order_id
      and order_row.business_id = new.business_id;

    if not found
       or v_order.payment_status not in ('paid', 'not_required')
       or v_order.status = 'payment_pending' then
      raise exception using
        errcode = '22023',
        message = 'order_placed analytics requires a paid or no-payment placed order';
    end if;

    if new.location_id is not null and new.location_id <> v_order.location_id then
      raise exception using
        errcode = '23514',
        message = 'analytics order location must match the order location';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.validate_cart_item_option_attachment()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if not exists (
    select 1
    from ordering.cart_items as item
    join ordering.options as option_item
      on option_item.id = new.option_id
    join ordering.product_option_groups as attachment
      on attachment.product_id = item.product_id
     and attachment.option_group_id = option_item.option_group_id
    join ordering.products as product
      on product.id = item.product_id
    join ordering.option_groups as option_group
      on option_group.id = option_item.option_group_id
     and option_group.business_id = product.business_id
    where item.id = new.cart_item_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'selected option must belong to a group attached to the product';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_cart_item_tenant()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
begin
  if not exists (
    select 1
    from ordering.carts as cart
    join ordering.products as product
      on product.id = new.product_id
     and product.business_id = cart.business_id
    join ordering.menu_categories as category
      on category.id = product.category_id
     and category.business_id = cart.business_id
     and (category.location_id is null or category.location_id = cart.location_id)
    where cart.id = new.cart_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'cart product must belong to the cart business and location scope';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_coupon_location_tenant()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_coupon_business_id uuid;
  v_location_business_id uuid;
begin
  select coupon.business_id
  into v_coupon_business_id
  from ordering.coupons as coupon
  where coupon.id = new.coupon_id;

  select location.business_id
  into v_location_business_id
  from core.business_locations as location
  where location.id = new.location_id;

  if v_coupon_business_id is null
     or v_location_business_id is null
     or v_coupon_business_id <> v_location_business_id then
    raise exception using
      errcode = '23514',
      message = 'coupon and location must belong to the same business';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_delivery_zone()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform 1
  from core.business_locations as location
  where location.id = new.location_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'location does not exist';
  end if;

  if new.is_active and exists (
    select 1
    from ordering.delivery_zones as sibling
    where sibling.location_id = new.location_id
      and sibling.is_active
      and sibling.id <> new.id
      and new.min_distance_km < sibling.max_distance_km
      and sibling.min_distance_km < new.max_distance_km
  ) then
    raise exception using
      errcode = '23P01',
      message = 'active delivery zones cannot overlap';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_menu_category_scope()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  perform 1
  from core.businesses as business
  where business.id = new.business_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'business does not exist';
  end if;

  if new.location_id is null then
    if exists (
      select 1
      from ordering.menu_categories as category
      where category.business_id = new.business_id
        and category.location_id is not null
        and lower(btrim(category.name)) = lower(btrim(new.name))
        and category.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'global category name conflicts with an outlet category';
    end if;
  else
    if exists (
      select 1
      from ordering.menu_categories as category
      where category.business_id = new.business_id
        and category.location_id is null
        and lower(btrim(category.name)) = lower(btrim(new.name))
        and category.id <> new.id
    ) then
      raise exception using
        errcode = '23505',
        message = 'outlet category name conflicts with a global category';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.validate_opening_hours()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_new_start numeric;
  v_new_end numeric;
begin
  perform 1
  from core.business_locations as location
  where location.id = new.location_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'location does not exist';
  end if;

  if new.is_closed then
    if exists (
      select 1
      from ordering.opening_hours as sibling
      where sibling.location_id = new.location_id
        and sibling.day_of_week = new.day_of_week
        and sibling.id <> new.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'a closed marker cannot coexist with an opening interval';
    end if;

    return new;
  end if;

  if exists (
    select 1
    from ordering.opening_hours as sibling
    where sibling.location_id = new.location_id
      and sibling.day_of_week = new.day_of_week
      and sibling.is_closed
      and sibling.id <> new.id
  ) then
    raise exception using
      errcode = '23514',
      message = 'an opening interval cannot coexist with a closed marker';
  end if;

  v_new_start := ((new.day_of_week - 1) * 86400)
    + extract(epoch from new.opens_at);

  v_new_end := case
    when new.closes_at > new.opens_at then
      ((new.day_of_week - 1) * 86400) + extract(epoch from new.closes_at)
    else
      (new.day_of_week * 86400) + extract(epoch from new.closes_at)
  end;

  if exists (
    select 1
    from ordering.opening_hours as sibling
    cross join lateral (
      select
        ((sibling.day_of_week - 1) * 86400)
          + extract(epoch from sibling.opens_at) as interval_start,
        case
          when sibling.closes_at > sibling.opens_at then
            ((sibling.day_of_week - 1) * 86400)
              + extract(epoch from sibling.closes_at)
          else
            (sibling.day_of_week * 86400)
              + extract(epoch from sibling.closes_at)
        end as interval_end
    ) as sibling_bounds
    cross join (
      values (-604800::numeric), (0::numeric), (604800::numeric)
    ) as week_shift(seconds)
    where sibling.location_id = new.location_id
      and not sibling.is_closed
      and sibling.id <> new.id
      and v_new_start < sibling_bounds.interval_end + week_shift.seconds
      and sibling_bounds.interval_start + week_shift.seconds < v_new_end
  ) then
    raise exception using
      errcode = '23P01',
      message = 'opening intervals cannot overlap';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_order_financial_snapshot()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_tax_mode text;
  v_tax_rate numeric(7, 4);
  v_currency text;
  v_aggregator_rate numeric(7, 4);
  v_skrowia_rate numeric(7, 4);
  v_net_food numeric(14, 2);
  v_expected_tax numeric(14, 2);
  v_expected_grand_total numeric(14, 2);
  v_expected_commissionable numeric(14, 2);
begin
  select
    settings.tax_mode,
    settings.tax_rate,
    settings.currency,
    settings.aggregator_benchmark_rate,
    settings.skrowia_commission_rate
  into
    v_tax_mode,
    v_tax_rate,
    v_currency,
    v_aggregator_rate,
    v_skrowia_rate
  from ordering.restaurant_settings as settings
  where settings.location_id = new.location_id;

  if not found then
    raise exception using errcode = '23514', message = 'restaurant settings are required';
  end if;

  if v_aggregator_rate is null then
    raise exception using
      errcode = '23514',
      message = 'aggregator benchmark rate must be configured before checkout';
  end if;

  if new.currency <> v_currency
     or new.aggregator_benchmark_rate_snapshot <> v_aggregator_rate
     or new.skrowia_commission_rate_snapshot <> v_skrowia_rate then
    raise exception using
      errcode = '23514',
      message = 'order currency and rate snapshots must match location settings';
  end if;

  v_net_food := round(
    new.food_subtotal - new.discount_total - new.loyalty_redeemed,
    2
  );
  v_expected_commissionable := greatest(v_net_food, 0);

  -- Batch-1 review default: delivery charges are excluded from the taxable
  -- base. Inclusive tax is extracted from discounted food and is not added a
  -- second time. This rule is centralized here and in the quote function.
  v_expected_tax := case
    when v_tax_mode = 'none' then 0
    when v_tax_mode = 'inclusive' then
      round(v_net_food * v_tax_rate / (100 + v_tax_rate), 2)
    else
      round(v_net_food * v_tax_rate / 100, 2)
  end;

  v_expected_grand_total := case
    when v_tax_mode = 'exclusive' then
      round(v_net_food + v_expected_tax + new.delivery_fee, 2)
    else
      round(v_net_food + new.delivery_fee, 2)
  end;

  if new.tax_total <> v_expected_tax
     or new.grand_total <> v_expected_grand_total
     or new.skrowia_commissionable_amount <> v_expected_commissionable then
    raise exception using
      errcode = '23514',
      message = 'order financial snapshot does not match authoritative pricing';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_order_payment_method()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_cash_enabled boolean;
  v_online_enabled boolean;
begin
  select settings.cash_on_delivery_enabled, settings.online_payments_enabled
  into v_cash_enabled, v_online_enabled
  from ordering.restaurant_settings as settings
  where settings.location_id = new.location_id;

  if not found then
    raise exception using errcode = '22023', message = 'restaurant payment settings are unavailable';
  end if;

  if new.payment_method = 'cash' then
    if not v_cash_enabled then
      raise exception using errcode = '22023', message = 'cash on delivery is unavailable for this outlet';
    end if;
  elsif new.payment_method = 'online' then
    if not v_online_enabled then
      raise exception using errcode = '22023', message = 'online payment is unavailable for this outlet';
    end if;

    if not exists (
      select 1
      from ordering.location_payment_providers as provider
      where provider.location_id = new.location_id
        and provider.is_active
        and provider.configuration_status = 'ready'
    ) then
      raise exception using errcode = '22023', message = 'online payment provider is not configured for this outlet';
    end if;
  else
    raise exception using errcode = '22023', message = 'unsupported payment method';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_payment_provider_route()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_provider text;
begin
  select placed_order.* into v_order
  from ordering.orders as placed_order
  where placed_order.id = new.order_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order was not found';
  end if;

  if v_order.payment_method <> 'online' then
    raise exception using errcode = '22023', message = 'payment attempts are only valid for online-payment orders';
  end if;

  select provider.provider into v_provider
  from ordering.location_payment_providers as provider
  where provider.location_id = v_order.location_id
    and provider.is_active
    and provider.configuration_status = 'ready'
  limit 1;

  if v_provider is null then
    raise exception using errcode = '55000', message = 'no ready online payment provider is configured for this outlet';
  end if;

  if lower(btrim(new.provider)) <> v_provider then
    raise exception using errcode = '22023', message = 'payment provider does not match the configured outlet provider';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_phase_c_tenant_integrity()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_left_business_id uuid;
  v_right_business_id uuid;
  v_target_location_id uuid;
begin
  if tg_table_schema <> 'ordering' then
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C tenant-integrity target';
  end if;

  if tg_table_name = 'product_locations' then
    select product.business_id
    into v_left_business_id
    from ordering.products as product
    where product.id = new.product_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'product does not exist';
    end if;

    select location.business_id
    into v_right_business_id
    from core.business_locations as location
    where location.id = new.location_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'location does not exist';
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'product and location must belong to the same business';
    end if;

  elsif tg_table_name = 'product_option_groups' then
    select product.business_id
    into v_left_business_id
    from ordering.products as product
    where product.id = new.product_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'product does not exist';
    end if;

    select option_group.business_id
    into v_right_business_id
    from ordering.option_groups as option_group
    where option_group.id = new.option_group_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'option group does not exist';
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'product and option group must belong to the same business';
    end if;

  elsif tg_table_name = 'catalog_availability_windows' then
    if (new.category_id is null) = (new.product_id is null) then
      raise exception using
        errcode = '23514',
        message = 'exactly one catalog availability target is required';
    end if;

    select location.business_id
    into v_right_business_id
    from core.business_locations as location
    where location.id = new.location_id
    for update;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'location does not exist';
    end if;

    if new.category_id is not null then
      select category.business_id, category.location_id
      into v_left_business_id, v_target_location_id
      from ordering.menu_categories as category
      where category.id = new.category_id;

      if not found then
        raise exception using
          errcode = '23503',
          message = 'category does not exist';
      end if;

    else
      select product.business_id, category.location_id
      into v_left_business_id, v_target_location_id
      from ordering.products as product
      join ordering.menu_categories as category
        on category.business_id = product.business_id
       and category.id = product.category_id
      where product.id = new.product_id
      for update of product;

      if not found then
        raise exception using
          errcode = '23503',
          message = 'product does not exist';
      end if;
    end if;

    if v_left_business_id <> v_right_business_id then
      raise exception using
        errcode = '23514',
        message = 'catalog target and location must belong to the same business';
    end if;

    if v_target_location_id is not null
       and v_target_location_id <> new.location_id then
      raise exception using
        errcode = '23514',
        message = 'outlet-specific catalog target must use its own location';
    end if;

  else
    raise exception using
      errcode = '23514',
      message = 'unexpected Phase C tenant-integrity target';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_product_category_assignment()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_category_location_id uuid;
begin
  select category.location_id
  into v_category_location_id
  from ordering.menu_categories as category
  where category.business_id = new.business_id
    and category.id = new.category_id;

  if not found then
    return new;
  end if;

  if v_category_location_id is not null and exists (
    select 1
    from ordering.catalog_availability_windows as availability
    where availability.product_id = new.id
      and availability.location_id <> v_category_location_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'product availability windows conflict with the new outlet category';
  end if;

  return new;
end;
$function$;

create or replace function private.validate_refund_total()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
declare
  v_payment_amount numeric(14, 2);
  v_existing_amount numeric(14, 2);
begin
  select payment.amount
  into v_payment_amount
  from ordering.payments as payment
  where payment.id = new.payment_id
    and payment.order_id = new.order_id
    and payment.status = 'paid'
  for update;

  if v_payment_amount is null then
    raise exception using
      errcode = '23514',
      message = 'refund requires a captured payment for the same order';
  end if;

  if tg_op = 'INSERT' then
    select coalesce(sum(refund.amount), 0)
    into v_existing_amount
    from ordering.refunds as refund
    where refund.payment_id = new.payment_id
      and refund.status <> 'cancelled';
  else
    select coalesce(sum(refund.amount), 0)
    into v_existing_amount
    from ordering.refunds as refund
    where refund.payment_id = new.payment_id
      and refund.status <> 'cancelled'
      and refund.id <> old.id;
  end if;

  if new.status <> 'cancelled'
     and v_existing_amount + new.amount > v_payment_amount then
    raise exception using
      errcode = '23514',
      message = 'cumulative refunds cannot exceed the captured payment';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.payment_id is distinct from old.payment_id
    or new.amount is distinct from old.amount
    or new.method is distinct from old.method
    or new.reason is distinct from old.reason
    or new.created_at is distinct from old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'refund identity, amount, method, and reason are immutable';
  end if;

  return new;
end;
$function$;

create or replace function public.notifications_claim_deliveries (
  p_limit         integer default 20,
  p_lease_seconds integer default 120
)
  returns SETOF notifications.deliveries
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.deliveries d
  set status = 'sending',
      sending_started_at = now(),
      sending_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = d.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.deliveries
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'sending' and sending_lease_expires_at < now())
    order by created_at
    limit p_limit
    for update skip locked
  ) as claimed
  where d.id = claimed.id
  returning d.*;
end;
$function$;

create or replace function public.notifications_claim_events (
  p_limit         integer default 20,
  p_lease_seconds integer default 120
)
  returns SETOF notifications.events
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  return query
  update notifications.events e
  set status = 'planning',
      planning_started_at = now(),
      planning_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = e.attempt_count + 1,
      updated_at = now()
  from (
    select id
    from notifications.events
    where (status in ('pending', 'failed') and next_attempt_at <= now())
       or (status = 'planning' and planning_lease_expires_at < now())
    order by occurred_at
    limit p_limit
    for update skip locked
  ) as claimed
  where e.id = claimed.id
  returning e.*;
end;
$function$;

create or replace function public.notifications_claim_telegram_webhook_update (
  p_update_id bigint
)
  returns boolean
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  insert into notifications.telegram_webhook_updates (update_id)
  values (p_update_id)
  on conflict (update_id) do nothing;

  return found;
end;
$function$;

create or replace function public.notifications_consume_telegram_pairing (
  p_token_hash          text,
  p_telegram_chat_id    text,
  p_telegram_chat_type  text,
  p_telegram_chat_title text default null::text,
  p_telegram_user_id    text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_token notifications.telegram_pairing_tokens%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  update notifications.telegram_pairing_tokens
  set consumed_at = now()
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > now()
  returning * into v_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_expired_or_used');
  end if;

  if v_token.destination_type = 'staff_group' and p_telegram_chat_type not in ('group', 'supergroup') then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'staff_group');
  end if;
  if v_token.destination_type = 'business_user' and p_telegram_chat_type <> 'private' then
    return jsonb_build_object('ok', false, 'reason', 'wrong_chat_type', 'destinationType', 'business_user');
  end if;

  if v_token.destination_type = 'staff_group' then
    update notifications.telegram_destinations
    set is_active = false
    where business_id = v_token.business_id
      and location_id = v_token.location_id
      and destination_type = 'staff_group'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, telegram_chat_id, telegram_chat_type, telegram_chat_title
    ) values (
      v_token.business_id, v_token.location_id, 'staff_group', p_telegram_chat_id, p_telegram_chat_type, p_telegram_chat_title
    );
  else
    update notifications.telegram_destinations
    set is_active = false
    where business_user_id = v_token.business_user_id
      and destination_type = 'business_user'
      and is_active;

    insert into notifications.telegram_destinations (
      business_id, location_id, destination_type, business_user_id, telegram_chat_id, telegram_user_id, telegram_chat_type
    ) values (
      v_token.business_id, null, 'business_user', v_token.business_user_id, p_telegram_chat_id, p_telegram_user_id, p_telegram_chat_type
    );
  end if;

  select b.* into v_business from core.businesses b where b.id = v_token.business_id;
  if v_token.location_id is not null then
    select l.* into v_location from core.business_locations l where l.id = v_token.location_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'destinationType', v_token.destination_type,
    'businessName', v_business.name,
    'locationName', v_location.name
  );
end;
$function$;

create or replace function public.notifications_create_telegram_pairing_token (
  p_destination_type text,
  p_business_id      uuid,
  p_location_id      uuid default null::uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_business_user_id uuid;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to manage this business';
  end if;

  if p_destination_type = 'staff_group' then
    if p_location_id is null then
      raise exception using errcode = '22023', message = 'location_id is required for a staff_group pairing token';
    end if;
    if not exists (
      select 1 from core.business_locations l
      where l.id = p_location_id and l.business_id = p_business_id
    ) then
      raise exception using errcode = 'P0002', message = 'location does not belong to this business';
    end if;
  elsif p_destination_type = 'business_user' then
    select bu.id into v_business_user_id
    from core.business_users bu
    join core.users u on u.id = bu.user_id
    where bu.business_id = p_business_id
      and bu.is_active
      and u.auth_user_id = (select auth.uid())
    limit 1;
    if v_business_user_id is null then
      raise exception using errcode = '42501', message = 'caller is not an active member of this business';
    end if;
    p_location_id := null;
  else
    raise exception using errcode = '22023', message = 'invalid destination_type';
  end if;

  v_token := encode(extensions.gen_random_bytes(20), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into notifications.telegram_pairing_tokens (
    token_hash, business_id, location_id, destination_type, business_user_id, expires_at, created_by
  ) values (
    v_token_hash, p_business_id, p_location_id, p_destination_type, v_business_user_id, v_expires_at, (select auth.uid())
  );

  return jsonb_build_object(
    'token', v_token,
    'expiresAt', v_expires_at,
    'destinationType', p_destination_type,
    'businessId', p_business_id,
    'locationId', p_location_id
  );
end;
$function$;

create or replace function public.notifications_get_business_preferences (
  p_business_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_notify boolean;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to view this business';
  end if;

  select bp.notify_owner_on_cancellation into v_notify
  from notifications.business_preferences bp where bp.business_id = p_business_id;

  return jsonb_build_object('notifyOwnerOnCancellation', coalesce(v_notify, false));
end;
$function$;

create or replace function public.notifications_get_dispatcher_config()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_settings notifications.settings%rowtype;
  v_resend_key text;
  v_dispatcher_secret text;
  v_telegram_bot_token text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select * into v_settings from notifications.settings where id = true;

  select secret.decrypted_secret into v_resend_key
  from vault.decrypted_secrets secret where secret.id = v_settings.resend_api_key_secret_id;

  select secret.decrypted_secret into v_dispatcher_secret
  from vault.decrypted_secrets secret where secret.id = v_settings.dispatcher_auth_secret_id;

  select secret.decrypted_secret into v_telegram_bot_token
  from vault.decrypted_secrets secret where secret.id = v_settings.telegram_bot_token_secret_id;

  return jsonb_build_object(
    'emailProvider', v_settings.email_provider,
    'emailFromAddress', v_settings.email_from_address,
    'emailFromNameFallback', v_settings.email_from_name_fallback,
    'emailReplyTo', v_settings.email_reply_to,
    'notificationsEmailMode', v_settings.notifications_email_mode,
    'notificationsDevRecipient', v_settings.notifications_dev_recipient,
    'notificationsEnvironment', v_settings.notifications_environment,
    'devDefaultStorefrontUrl', v_settings.dev_default_storefront_url,
    'resendApiKey', v_resend_key,
    'dispatcherAuthSecret', v_dispatcher_secret,
    'telegramBotToken', v_telegram_bot_token,
    'notificationsTelegramMode', v_settings.notifications_telegram_mode
  );
end;
$function$;

create or replace function public.notifications_get_location_context (
  p_location_id  uuid,
  p_summary_date date default null::date
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_location core.business_locations%rowtype;
  v_business core.businesses%rowtype;
  v_staff_group notifications.telegram_destinations%rowtype;
  v_owners jsonb;
  v_sales jsonb;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select l.* into v_location from core.business_locations l where l.id = p_location_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'location not found';
  end if;
  select b.* into v_business from core.businesses b where b.id = v_location.business_id;

  select * into v_staff_group
  from notifications.telegram_destinations d
  where d.business_id = v_business.id
    and d.location_id = p_location_id
    and d.destination_type = 'staff_group'
    and d.is_active
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('chatId', d.telegram_chat_id)), '[]'::jsonb)
  into v_owners
  from notifications.telegram_destinations d
  join core.business_users bu on bu.id = d.business_user_id
  where d.destination_type = 'business_user'
    and d.is_active
    and bu.business_id = v_business.id
    and bu.is_active
    and bu.role in ('owner', 'admin');

  if p_summary_date is not null then
    select jsonb_build_object(
      'date', p_summary_date,
      'orderCount', count(*) filter (where o.status <> 'cancelled'),
      'cancelledCount', count(*) filter (where o.status = 'cancelled'),
      'totalRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled'), 0)::text,
      'cashRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled' and o.payment_method = 'cash'), 0)::text,
      'onlineRevenue', coalesce(sum(o.grand_total) filter (where o.status <> 'cancelled' and o.payment_method = 'online'), 0)::text
    )
    into v_sales
    from ordering.orders o
    where o.location_id = p_location_id
      and (o.placed_at at time zone v_business.timezone)::date = p_summary_date;
  end if;

  return jsonb_build_object(
    'business', jsonb_build_object(
      'id', v_business.id, 'name', v_business.name, 'timezone', v_business.timezone, 'currency', v_business.currency
    ),
    'location', jsonb_build_object('id', v_location.id, 'name', v_location.name),
    'telegram', jsonb_build_object(
      'staffGroup', case when v_staff_group.id is null then null else jsonb_build_object(
        'chatId', v_staff_group.telegram_chat_id,
        'chatTitle', v_staff_group.telegram_chat_title
      ) end,
      'businessOwners', v_owners
    ),
    'salesSummary', v_sales
  );
end;
$function$;

create or replace function public.notifications_get_order_context (
  p_order_id uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_order ordering.orders%rowtype;
  v_business core.businesses%rowtype;
  v_location core.business_locations%rowtype;
  v_customer core.customers%rowtype;
  v_items jsonb;
  v_payment jsonb;
  v_refund_total numeric;
  v_refund_status text;
  v_staff_group notifications.telegram_destinations%rowtype;
  v_owners jsonb;
  v_notify_owner_on_cancellation boolean;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select o.* into v_order from ordering.orders o where o.id = p_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'order not found';
  end if;

  select b.* into v_business from core.businesses b where b.id = v_order.business_id;
  select l.* into v_location from core.business_locations l where l.id = v_order.location_id;

  if v_order.customer_id is not null then
    select c.* into v_customer from core.customers c where c.id = v_order.customer_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'productName', oi.product_name,
    'quantity', oi.quantity,
    'baseUnitPrice', oi.base_unit_price::text,
    'modifierUnitTotal', oi.modifier_unit_total::text,
    'finalUnitPrice', oi.final_unit_price::text,
    'lineTotal', oi.line_total::text,
    'customerNote', oi.customer_note,
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'optionGroupName', oio.option_group_name,
        'optionName', oio.option_name,
        'priceDelta', oio.price_delta::text,
        'quantity', oio.quantity
      ) order by oio.option_group_name, oio.option_name), '[]'::jsonb)
      from ordering.order_item_options oio
      where oio.order_item_id = oi.id
    )
  ) order by oi.created_at), '[]'::jsonb)
  into v_items
  from ordering.order_items oi
  where oi.order_id = v_order.id;

  select jsonb_build_object(
    'status', p.status,
    'method', p.method,
    'amount', p.amount::text,
    'paidAt', p.paid_at
  )
  into v_payment
  from ordering.payments p
  where p.order_id = v_order.id
  order by p.created_at desc
  limit 1;

  select coalesce(sum(r.amount) filter (where r.status = 'completed'), 0)
  into v_refund_total
  from ordering.refunds r
  where r.order_id = v_order.id;

  select r.status into v_refund_status
  from ordering.refunds r
  where r.order_id = v_order.id
  order by r.created_at desc
  limit 1;

  select * into v_staff_group
  from notifications.telegram_destinations d
  where d.business_id = v_order.business_id
    and d.location_id = v_order.location_id
    and d.destination_type = 'staff_group'
    and d.is_active
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('chatId', d.telegram_chat_id)), '[]'::jsonb)
  into v_owners
  from notifications.telegram_destinations d
  join core.business_users bu on bu.id = d.business_user_id
  where d.destination_type = 'business_user'
    and d.is_active
    and bu.business_id = v_order.business_id
    and bu.is_active
    and bu.role in ('owner', 'admin');

  select bp.notify_owner_on_cancellation into v_notify_owner_on_cancellation
  from notifications.business_preferences bp where bp.business_id = v_order.business_id;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'businessId', v_order.business_id,
      'locationId', v_order.location_id,
      'customerId', v_order.customer_id,
      'fulfillmentType', v_order.fulfillment_type,
      'status', v_order.status,
      'paymentStatus', v_order.payment_status,
      'paymentMethod', v_order.payment_method,
      'currency', v_order.currency,
      'foodSubtotal', v_order.food_subtotal::text,
      'discountTotal', v_order.discount_total::text,
      'taxTotal', v_order.tax_total::text,
      'deliveryFee', v_order.delivery_fee::text,
      'grandTotal', v_order.grand_total::text,
      'customerNameSnapshot', v_order.customer_name_snapshot,
      'customerPhoneSnapshot', v_order.customer_phone_snapshot,
      'deliveryAddressSnapshot', v_order.delivery_address_snapshot,
      'customerNote', v_order.customer_note,
      'placedAt', v_order.placed_at,
      'acceptedAt', v_order.accepted_at,
      'outForDeliveryAt', v_order.out_for_delivery_at,
      'deliveredAt', v_order.delivered_at,
      'cancelledAt', v_order.cancelled_at,
      'cancelReason', v_order.cancel_reason,
      'estimatedDeliveryMinutes', v_order.estimated_delivery_minutes,
      'couponCodeSnapshot', v_order.coupon_code_snapshot,
      'couponDiscountAmount', v_order.coupon_discount_amount::text
    ),
    'items', v_items,
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'logoUrl', v_business.logo_url,
      'timezone', v_business.timezone,
      'currency', v_business.currency
    ),
    'location', jsonb_build_object(
      'id', v_location.id,
      'name', v_location.name,
      'phone', v_location.phone,
      'addressLine', nullif(trim(both ', ' from
        coalesce(v_location.address_line_1, '') ||
        case when v_location.address_line_2 is not null and v_location.address_line_2 <> ''
          then ', ' || v_location.address_line_2 else '' end ||
        ', ' || coalesce(v_location.city, '')
      ), ''),
      'storefrontDomain', v_location.storefront_domain
    ),
    'customer', case when v_customer.id is null then null else jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'displayName', v_customer.display_name
    ) end,
    'payment', v_payment,
    'refundFacts', jsonb_build_object(
      'paymentTaken', (v_payment is not null and (v_payment->>'status') = 'paid'),
      'refundedAmount', v_refund_total::text,
      'latestRefundStatus', v_refund_status
    ),
    'telegram', jsonb_build_object(
      'staffGroup', case when v_staff_group.id is null then null else jsonb_build_object(
        'chatId', v_staff_group.telegram_chat_id,
        'chatTitle', v_staff_group.telegram_chat_title
      ) end,
      'businessOwners', v_owners
    ),
    'preferences', jsonb_build_object(
      'notifyOwnerOnCancellation', coalesce(v_notify_owner_on_cancellation, false)
    )
  );
end;
$function$;

create or replace function public.notifications_get_telegram_connection_status (
  p_business_id uuid,
  p_location_id uuid default null::uuid
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_staff_group notifications.telegram_destinations%rowtype;
  v_my_business_user_id uuid;
  v_my_connection notifications.telegram_destinations%rowtype;
  v_bot_username text;
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to view this business';
  end if;

  select s.telegram_bot_username into v_bot_username from notifications.settings s where s.id = true;

  if p_location_id is not null then
    select * into v_staff_group
    from notifications.telegram_destinations d
    where d.business_id = p_business_id
      and d.location_id = p_location_id
      and d.destination_type = 'staff_group'
      and d.is_active
    limit 1;
  end if;

  select bu.id into v_my_business_user_id
  from core.business_users bu
  join core.users u on u.id = bu.user_id
  where bu.business_id = p_business_id
    and bu.is_active
    and u.auth_user_id = (select auth.uid())
  limit 1;

  if v_my_business_user_id is not null then
    select * into v_my_connection
    from notifications.telegram_destinations d
    where d.business_user_id = v_my_business_user_id
      and d.destination_type = 'business_user'
      and d.is_active
    limit 1;
  end if;

  return jsonb_build_object(
    'botUsername', v_bot_username,
    'staffGroup', case when v_staff_group.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'chatTitle', v_staff_group.telegram_chat_title, 'connectedAt', v_staff_group.connected_at) end,
    'myConnection', case when v_my_connection.id is null then jsonb_build_object('connected', false)
      else jsonb_build_object('connected', true, 'connectedAt', v_my_connection.connected_at) end
  );
end;
$function$;

create or replace function public.notifications_get_telegram_webhook_config()
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  v_bot_token text;
  v_webhook_secret text;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select secret.decrypted_secret into v_bot_token
  from vault.decrypted_secrets secret
  join notifications.settings s on s.telegram_bot_token_secret_id = secret.id
  where s.id = true;

  select secret.decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets secret
  join notifications.settings s on s.telegram_webhook_secret_id = secret.id
  where s.id = true;

  return jsonb_build_object('botToken', v_bot_token, 'webhookSecret', v_webhook_secret);
end;
$function$;

create or replace function public.notifications_mark_event_failed (
  p_event_id     uuid,
  p_error        text,
  p_max_attempts integer default 8
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_attempt_count int;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select attempt_count into v_attempt_count
  from notifications.events where id = p_event_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_attempt_count >= p_max_attempts then
    update notifications.events
    set status = 'dead', last_error = left(p_error, 2000), updated_at = now()
    where id = p_event_id;
  else
    update notifications.events
    set status = 'failed',
        last_error = left(p_error, 2000),
        next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
        updated_at = now()
    where id = p_event_id;
  end if;
end;
$function$;

create or replace function public.notifications_plan_event (
  p_event_id   uuid,
  p_deliveries jsonb
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_event notifications.events%rowtype;
  v_item jsonb;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  select e.* into v_event from notifications.events e where e.id = p_event_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'notification event not found';
  end if;

  if v_event.status <> 'planning' then
    raise exception using errcode = '55000',
      message = format('event %s is not in planning status (found %s)', p_event_id, v_event.status);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_deliveries, '[]'::jsonb))
  loop
    insert into notifications.deliveries (
      event_id, business_id, location_id, channel, template_key,
      recipient_type, recipient_id, recipient_address, locale, payload,
      status, skip_reason
    ) values (
      p_event_id,
      v_event.business_id,
      v_event.location_id,
      v_item->>'channel',
      v_item->>'templateKey',
      v_item->>'recipientType',
      nullif(v_item->>'recipientId', '')::uuid,
      nullif(v_item->>'recipientAddress', ''),
      coalesce(v_item->>'locale', 'en-IN'),
      coalesce(v_item->'payload', '{}'::jsonb),
      coalesce(v_item->>'status', 'pending'),
      nullif(v_item->>'skipReason', '')
    )
    on conflict (dedupe_key) do nothing;
  end loop;

  update notifications.events
  set status = 'planned', planned_at = now(), last_error = null, updated_at = now()
  where id = p_event_id;
end;
$function$;

create or replace function public.notifications_record_delivery_result (
  p_delivery_id         uuid,
  p_outcome             text,
  p_provider            text    default null::text,
  p_provider_message_id text    default null::text,
  p_error               text    default null::text,
  p_max_attempts        integer default 5,
  p_skip_reason         text    default null::text
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  v_attempt_count int;
begin
  if not (select private.request_is_service_role()) then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_outcome not in ('sent', 'retry', 'permanent_failure', 'skipped') then
    raise exception using errcode = '22023', message = 'invalid delivery outcome';
  end if;

  select attempt_count into v_attempt_count
  from notifications.deliveries where id = p_delivery_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'delivery not found';
  end if;

  if p_outcome = 'sent' then
    update notifications.deliveries
    set status = 'sent',
        sent_at = now(),
        provider = p_provider,
        provider_message_id = p_provider_message_id,
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'skipped' then
    update notifications.deliveries
    set status = 'skipped',
        skip_reason = coalesce(p_skip_reason, 'channel_disabled'),
        provider = coalesce(p_provider, provider),
        last_error = null,
        updated_at = now()
    where id = p_delivery_id;
  elsif p_outcome = 'permanent_failure' then
    update notifications.deliveries
    set status = 'dead',
        last_error = left(p_error, 2000),
        provider = coalesce(p_provider, provider),
        updated_at = now()
    where id = p_delivery_id;
  else
    if v_attempt_count >= p_max_attempts then
      update notifications.deliveries
      set status = 'dead',
          last_error = left(p_error, 2000),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    else
      update notifications.deliveries
      set status = 'failed',
          last_error = left(p_error, 2000),
          next_attempt_at = now() + notifications.retry_backoff(v_attempt_count),
          provider = coalesce(p_provider, provider),
          updated_at = now()
      where id = p_delivery_id;
    end if;
  end if;
end;
$function$;

create or replace function public.notifications_set_business_preferences (
  p_business_id                  uuid,
  p_notify_owner_on_cancellation boolean
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if not (select auth.uid()) is not null
     or not (select private.can_manage_sensitive_business_configuration(p_business_id)) then
    raise exception using errcode = '42501', message = 'not authorized to manage this business';
  end if;

  insert into notifications.business_preferences (business_id, notify_owner_on_cancellation)
  values (p_business_id, p_notify_owner_on_cancellation)
  on conflict (business_id) do update
  set notify_owner_on_cancellation = excluded.notify_owner_on_cancellation;

  return jsonb_build_object('notifyOwnerOnCancellation', p_notify_owner_on_cancellation);
end;
$function$;

alter table "core"."business_locations"
  add constraint "business_locations_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "core"."business_users"
  add constraint "business_users_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "core"."customer_business_addresses"
  add constraint "customer_business_addresses_owner_fkey" foreign key (business_id, customer_id, customer_business_id)
    references core.customer_businesses(business_id, customer_id, id) on delete cascade;

alter table "core"."customer_businesses"
  add constraint "customer_businesses_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "core"."customers"
  add constraint "customers_auth_user_id_fkey" foreign key (auth_user_id) references auth.users(id) on delete set null;

alter table "core"."customer_auth_verifications"
  add constraint "customer_auth_verifications_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete set null;

alter table "core"."customer_businesses"
  add constraint "customer_businesses_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict;

alter table "core"."users"
  add constraint "users_auth_user_id_fkey" foreign key (auth_user_id) references auth.users(id) on delete set null;

alter table "core"."business_users"
  add constraint "business_users_user_id_fkey" foreign key (user_id) references core.users(id) on delete restrict;

alter table "notifications"."business_preferences"
  add constraint "business_preferences_business_id_fkey" foreign key (business_id) references core.businesses(id);

alter table "notifications"."deliveries"
  add constraint "notifications_deliveries_dedupe_key_key" unique (dedupe_key);

alter table "notifications"."deliveries"
  add constraint "deliveries_event_id_fkey" foreign key (event_id) references notifications.events(id);

alter table "notifications"."settings"
  add constraint "settings_dispatcher_auth_secret_id_fkey" foreign key (dispatcher_auth_secret_id) references vault.secrets(id);

alter table "notifications"."settings"
  add constraint "settings_resend_api_key_secret_id_fkey" foreign key (resend_api_key_secret_id) references vault.secrets(id);

alter table "notifications"."settings"
  add constraint "settings_telegram_bot_token_secret_id_fkey" foreign key (telegram_bot_token_secret_id) references vault.secrets(id);

alter table "notifications"."settings"
  add constraint "settings_telegram_webhook_secret_id_fkey" foreign key (telegram_webhook_secret_id) references vault.secrets(id);

alter table "notifications"."telegram_destinations"
  add constraint "telegram_destinations_business_id_fkey" foreign key (business_id) references core.businesses(id);

alter table "notifications"."telegram_destinations"
  add constraint "telegram_destinations_business_user_id_fkey" foreign key (business_user_id) references core.business_users(id);

alter table "notifications"."telegram_destinations"
  add constraint "telegram_destinations_location_id_fkey" foreign key (location_id) references core.business_locations(id);

alter table "notifications"."telegram_pairing_tokens"
  add constraint "telegram_pairing_tokens_business_id_fkey" foreign key (business_id) references core.businesses(id);

alter table "notifications"."telegram_pairing_tokens"
  add constraint "telegram_pairing_tokens_business_user_id_fkey" foreign key (business_user_id) references core.business_users(id);

alter table "notifications"."telegram_pairing_tokens"
  add constraint "telegram_pairing_tokens_created_by_fkey" foreign key (created_by) references auth.users(id);

alter table "notifications"."telegram_pairing_tokens"
  add constraint "telegram_pairing_tokens_location_id_fkey" foreign key (location_id) references core.business_locations(id);

alter table "ordering"."acquisition_sources"
  add constraint "acquisition_sources_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "core"."customer_businesses"
  add constraint "customer_businesses_business_id_source_id_fkey" foreign key (business_id, original_acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict;

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_customer_fkey" foreign key (business_id, customer_id) references core.customer_businesses(business_id, customer_id) on delete
    set null (customer_id);

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_location_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete
    set null (location_id);

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_source_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id) on delete
    set null (acquisition_source_id);

alter table "ordering"."campaigns"
  add constraint "campaigns_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."acquisition_sources"
  add constraint "acquisition_sources_business_id_campaign_id_fkey" foreign key (business_id, campaign_id) references ordering.campaigns(business_id, id) on delete restrict;

alter table "ordering"."cart_item_options"
  add constraint "cart_item_options_cart_item_id_fkey" foreign key (cart_item_id) references ordering.cart_items(id) on delete cascade;

alter table "ordering"."carts"
  add constraint "carts_business_id_acquisition_source_id_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict;

alter table "ordering"."carts"
  add constraint "carts_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."carts"
  add constraint "carts_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict;

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_location_cart_fkey" foreign key (business_id, location_id, cart_id) references ordering.carts(business_id, location_id, id) on delete
    set null (cart_id);

alter table "ordering"."carts"
  add constraint "carts_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict;

alter table "ordering"."carts"
  add constraint "carts_customer_relationship_fkey" foreign key (business_id, customer_id, customer_business_id) references core.customer_businesses(business_id, customer_id, id)
    on delete restrict;

alter table "ordering"."cart_items"
  add constraint "cart_items_cart_id_fkey" foreign key (cart_id) references ordering.carts(id) on delete cascade;

alter table "ordering"."catalog_availability_windows"
  add constraint "catalog_availability_windows_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."coupon_locations"
  add constraint "coupon_locations_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."coupons"
  add constraint "coupons_business_id_campaign_id_fkey" foreign key (business_id, campaign_id) references ordering.campaigns(business_id, id) on delete restrict;

alter table "ordering"."coupons"
  add constraint "coupons_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."carts"
  add constraint "carts_business_id_coupon_id_fkey" foreign key (business_id, coupon_id) references ordering.coupons(business_id, id) on delete restrict;

alter table "ordering"."coupons"
  add constraint "coupons_created_by_fkey" foreign key (created_by) references core.users(id) on delete set null;

alter table "ordering"."coupon_locations"
  add constraint "coupon_locations_coupon_id_fkey" foreign key (coupon_id) references ordering.coupons(id) on delete cascade;

alter table "ordering"."delivery_zones"
  add constraint "delivery_zones_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete restrict;

alter table "ordering"."location_payment_providers"
  add constraint "location_payment_providers_credentials_secret_id_fkey" foreign key (credentials_secret_id) references vault.secrets(id) on delete set null;

alter table "ordering"."location_payment_providers"
  add constraint "location_payment_providers_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."location_payment_providers"
  add constraint "location_payment_providers_webhook_secret_id_fkey" foreign key (webhook_secret_id) references vault.secrets(id) on delete set null;

alter table "ordering"."menu_categories"
  add constraint "menu_categories_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."menu_categories"
  add constraint "menu_categories_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict;

alter table "ordering"."catalog_availability_windows"
  add constraint "catalog_availability_windows_category_id_fkey" foreign key (category_id) references ordering.menu_categories(id) on delete cascade;

alter table "ordering"."opening_hours"
  add constraint "opening_hours_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."option_groups"
  add constraint "option_groups_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."options"
  add constraint "options_option_group_id_fkey" foreign key (option_group_id) references ordering.option_groups(id) on delete cascade;

alter table "ordering"."cart_item_options"
  add constraint "cart_item_options_option_id_fkey" foreign key (option_id) references ordering.options(id) on delete restrict;

alter table "ordering"."order_item_options"
  add constraint "order_item_options_option_id_fkey" foreign key (option_id) references ordering.options(id) on delete restrict;

alter table "ordering"."order_items"
  add constraint "order_items_category_id_snapshot_fkey" foreign key (category_id_snapshot) references ordering.menu_categories(id) on delete restrict;

alter table "ordering"."order_item_options"
  add constraint "order_item_options_order_item_id_fkey" foreign key (order_item_id) references ordering.order_items(id) on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_business_id_acquisition_source_id_fkey" foreign key (business_id, acquisition_source_id) references ordering.acquisition_sources(business_id, id)
    on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_business_id_coupon_id_fkey" foreign key (business_id, coupon_id) references ordering.coupons(business_id, id) on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."analytics_events"
  add constraint "analytics_events_business_order_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete set null (order_id);

alter table "ordering"."order_events"
  add constraint "order_events_business_id_order_id_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_business_id_location_id_fkey" foreign key (business_id, location_id) references core.business_locations(business_id, id) on delete restrict;

alter table "ordering"."carts"
  add constraint "carts_business_location_converted_order_fkey" foreign key (business_id, location_id, converted_order_id) references ordering.orders(business_id, location_id, id)
    on delete restrict deferrable initially deferred;

alter table "ordering"."orders"
  add constraint "orders_customer_id_fkey" foreign key (customer_id) references core.customers(id) on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_customer_relationship_fkey" foreign key (business_id, customer_id, customer_business_id) references core.customer_businesses(business_id, customer_id, id)
    on delete restrict;

alter table "ordering"."orders"
  add constraint "orders_location_id_delivery_zone_id_fkey" foreign key (location_id, delivery_zone_id) references ordering.delivery_zones(location_id, id) on delete restrict;

alter table "ordering"."order_items"
  add constraint "order_items_order_id_fkey" foreign key (order_id) references ordering.orders(id) on delete restrict;

alter table "ordering"."payments"
  add constraint "payments_business_id_order_id_fkey" foreign key (business_id, order_id) references ordering.orders(business_id, id) on delete restrict;

alter table "ordering"."product_locations"
  add constraint "product_locations_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."location_featured_products"
  add constraint "location_featured_products_product_location_fkey" foreign key (product_id, location_id) references ordering.product_locations(product_id, location_id)
    on delete cascade;

alter table "ordering"."product_option_groups"
  add constraint "product_option_groups_option_group_id_fkey" foreign key (option_group_id) references ordering.option_groups(id) on delete cascade;

alter table "ordering"."products"
  add constraint "products_business_id_category_id_fkey" foreign key (business_id, category_id) references ordering.menu_categories(business_id, id) on delete restrict;

alter table "ordering"."products"
  add constraint "products_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

alter table "ordering"."cart_items"
  add constraint "cart_items_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete restrict;

alter table "ordering"."catalog_availability_windows"
  add constraint "catalog_availability_windows_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade;

alter table "ordering"."order_items"
  add constraint "order_items_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete restrict;

alter table "ordering"."product_locations"
  add constraint "product_locations_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade;

alter table "ordering"."product_option_groups"
  add constraint "product_option_groups_product_id_fkey" foreign key (product_id) references ordering.products(id) on delete cascade;

alter table "ordering"."refunds"
  add constraint "refunds_order_id_payment_id_fkey" foreign key (order_id, payment_id) references ordering.payments(order_id, id) on delete restrict;

alter table "ordering"."refunds"
  add constraint "refunds_processed_by_fkey" foreign key (processed_by) references core.users(id) on delete set null;

alter table "ordering"."restaurant_settings"
  add constraint "restaurant_settings_location_id_fkey" foreign key (location_id) references core.business_locations(id) on delete cascade;

alter table "ordering"."telegram_order_messages"
  add constraint "telegram_order_messages_order_id_fkey" foreign key (order_id) references ordering.orders(id) on delete restrict;

alter table "ordering"."telegram_staff"
  add constraint "telegram_staff_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict;

create index business_locations_business_active_idx on core.business_locations using btree (business_id, is_active, id);

create unique index business_locations_storefront_domain_unique on core.business_locations using btree (lower(storefront_domain))
  where (storefront_domain is not null);

create index business_users_business_active_role_user_idx on core.business_users using btree (business_id, is_active, role, user_id);

create index business_users_user_active_business_role_idx on core.business_users using btree (user_id, is_active, business_id, role);

create unique index businesses_slug_normalized_key on core.businesses using btree (lower(btrim(slug)));

create index customer_auth_verifications_identifier_created_idx on core.customer_auth_verifications using btree (identifier_e164, created_at desc);

create unique index customer_business_addresses_one_default_key on core.customer_business_addresses using btree (customer_business_id)
  where is_default;

create index customer_business_addresses_owner_fk_idx on core.customer_business_addresses using btree (business_id, customer_id, customer_business_id);

create index customer_business_addresses_relationship_created_idx on core.customer_business_addresses using btree (customer_business_id, created_at desc, id);

create index customer_businesses_business_last_seen_idx on core.customer_businesses using btree (business_id, last_seen_at desc, id);

create index customer_businesses_business_source_idx on core.customer_businesses using btree (business_id, original_acquisition_source_id)
  where (original_acquisition_source_id is not null);

create index customer_businesses_customer_business_idx on core.customer_businesses using btree (customer_id, business_id);

create unique index customers_auth_user_id_key on core.customers using btree (auth_user_id)
  where (auth_user_id is not null);

create unique index users_auth_user_id_key on core.users using btree (auth_user_id)
  where (auth_user_id is not null);

create unique index users_email_normalized_key on core.users using btree (lower(btrim(email)))
  where (email is not null);

create index notifications_deliveries_business_idx on notifications.deliveries using btree (business_id);

create index notifications_deliveries_claim_idx on notifications.deliveries using btree (status, next_attempt_at);

create index notifications_deliveries_event_idx on notifications.deliveries using btree (event_id);

create index notifications_events_business_idx on notifications.events using btree (business_id);

create index notifications_events_claim_idx on notifications.events using btree (status, next_attempt_at);

create index notifications_events_entity_idx on notifications.events using btree (entity_type, entity_id);

create unique index telegram_destinations_active_business_user_idx on notifications.telegram_destinations using btree (business_user_id)
  where ((destination_type = 'business_user'::text) AND is_active);

create unique index telegram_destinations_active_staff_group_idx on notifications.telegram_destinations using btree (business_id, location_id)
  where ((destination_type = 'staff_group'::text) AND is_active);

create index telegram_destinations_business_id_idx on notifications.telegram_destinations using btree (business_id);

create index telegram_pairing_tokens_lookup_idx on notifications.telegram_pairing_tokens using btree (token_hash)
  where (consumed_at is null);

create index acquisition_sources_business_active_idx on ordering.acquisition_sources using btree (business_id, is_active, id);

create index acquisition_sources_business_campaign_idx on ordering.acquisition_sources using btree (business_id, campaign_id);

create unique index acquisition_sources_business_code_normalized_key on ordering.acquisition_sources using btree (business_id, lower(btrim(code)));

create index analytics_events_business_event_occurred_idx on ordering.analytics_events using btree (business_id, event_name, occurred_at, id);

create index analytics_events_business_occurred_idx on ordering.analytics_events using btree (business_id, occurred_at, id);

create index analytics_events_business_session_occurred_idx on ordering.analytics_events using btree (business_id, session_id, occurred_at, id);

create unique index campaigns_business_code_normalized_key on ordering.campaigns using btree (business_id, lower(btrim(code)));

create index campaigns_business_status_window_idx on ordering.campaigns using btree (business_id, status, starts_at, ends_at);

create index cart_item_options_option_item_idx on ordering.cart_item_options using btree (option_id, cart_item_id);

create index cart_items_cart_created_idx on ordering.cart_items using btree (cart_id, created_at, id);

create index cart_items_product_idx on ordering.cart_items using btree (product_id, cart_id);

create index carts_anonymous_status_updated_idx on ordering.carts using btree (anonymous_session_id, status, updated_at desc, id)
  where (anonymous_session_id is not null);

create index carts_business_coupon_idx on ordering.carts using btree (business_id, coupon_id)
  where (coupon_id is not null);

create index carts_business_location_status_updated_idx on ordering.carts using btree (business_id, location_id, status, updated_at desc, id);

create index carts_business_source_idx on ordering.carts using btree (business_id, acquisition_source_id)
  where (acquisition_source_id is not null);

create unique index carts_converted_order_key on ordering.carts using btree (business_id, location_id, converted_order_id)
  where (converted_order_id is not null);

create index carts_customer_relationship_idx on ordering.carts using btree (business_id, customer_id, customer_business_id)
  where (customer_id is not null);

create index carts_customer_status_updated_idx on ordering.carts using btree (customer_id, status, updated_at desc, id)
  where (customer_id is not null);

create index carts_expiry_housekeeping_idx on ordering.carts using btree (expires_at, id)
  where (status = ANY (ARRAY['active'::text, 'abandoned'::text]));

create unique index carts_one_active_anonymous_key on ordering.carts using btree (business_id, location_id, anonymous_session_id)
  where ((status = 'active'::text) AND (anonymous_session_id is not null));

create unique index carts_one_active_customer_key on ordering.carts using btree (business_id, location_id, customer_id)
  where ((status = 'active'::text) AND (customer_id is not null));

create unique index catalog_availability_windows_category_day_key on ordering.catalog_availability_windows using btree (category_id, location_id, day_of_week)
  where (category_id is not null);

create index catalog_availability_windows_location_day_category_idx on ordering.catalog_availability_windows using btree (location_id, day_of_week, category_id)
  where (category_id is not null);

create index catalog_availability_windows_location_day_product_idx on ordering.catalog_availability_windows using btree (location_id, day_of_week, product_id)
  where (product_id is not null);

create unique index catalog_availability_windows_product_day_key on ordering.catalog_availability_windows using btree (product_id, location_id, day_of_week)
  where (product_id is not null);

create index coupon_locations_location_coupon_idx on ordering.coupon_locations using btree (location_id, coupon_id);

create index coupons_business_active_window_idx on ordering.coupons using btree (business_id, is_active, starts_at, ends_at, id);

create index coupons_business_campaign_idx on ordering.coupons using btree (business_id, campaign_id)
  where (campaign_id is not null);

create unique index coupons_business_code_normalized_key on ordering.coupons using btree (business_id, lower(btrim(code)));

create index coupons_created_by_idx on ordering.coupons using btree (created_by)
  where (created_by is not null);

create index delivery_zones_location_active_distance_idx on ordering.delivery_zones using btree (location_id, is_active, min_distance_km, max_distance_km, id);

create unique index delivery_zones_location_name_normalized_key on ordering.delivery_zones using btree (location_id, lower(btrim(name)));

create index location_featured_products_active_location_sort_idx on ordering.location_featured_products using btree (location_id, sort_order, product_id)
  where is_active;

create unique index location_payment_providers_one_active_per_location_idx on ordering.location_payment_providers using btree (location_id)
  where is_active;

create index menu_categories_business_location_active_sort_idx on ordering.menu_categories using btree (business_id, location_id, is_active, sort_order, id);

create unique index menu_categories_global_name_normalized_key on ordering.menu_categories using btree (business_id, lower(btrim(name)))
  where (location_id is null);

create unique index menu_categories_local_name_normalized_key on ordering.menu_categories using btree (business_id, location_id, lower(btrim(name)))
  where (location_id is not null);

create index opening_hours_location_day_time_idx on ordering.opening_hours using btree (location_id, day_of_week, opens_at, id);

create unique index opening_hours_one_closed_marker_key on ordering.opening_hours using btree (location_id, day_of_week)
  where is_closed;

create index option_groups_business_active_sort_idx on ordering.option_groups using btree (business_id, is_active, sort_order, id);

create unique index option_groups_business_name_normalized_key on ordering.option_groups using btree (business_id, lower(btrim(name)));

create index options_group_active_available_sort_idx on ordering.options using btree (option_group_id, is_active, is_available, sort_order, id);

create unique index options_group_name_normalized_key on ordering.options using btree (option_group_id, lower(btrim(name)));

create index order_events_business_order_idx on ordering.order_events using btree (business_id, order_id);

create index order_events_business_type_created_idx on ordering.order_events using btree (business_id, event_type, created_at desc, id);

create index order_events_order_created_idx on ordering.order_events using btree (order_id, created_at, id);

create unique index order_events_provider_event_key on ordering.order_events using btree (((metadata ->> 'provider'::text)), ((metadata ->> 'provider_event_id'::text)))
  where ((event_type = 'payment_status_changed'::text) AND (metadata ? 'provider'::text) AND (metadata ? 'provider_event_id'::text));

create index order_item_options_item_idx on ordering.order_item_options using btree (order_item_id, id);

create index order_item_options_option_item_idx on ordering.order_item_options using btree (option_id, order_item_id);

create index order_items_category_order_idx on ordering.order_items using btree (category_id_snapshot, order_id);

create index order_items_order_created_idx on ordering.order_items using btree (order_id, created_at, id);

create index order_items_product_order_idx on ordering.order_items using btree (product_id, order_id);

create index orders_business_coupon_created_idx on ordering.orders using btree (business_id, coupon_id, created_at desc, id)
  where (coupon_id is not null);

create index orders_business_customer_created_idx on ordering.orders using btree (business_id, customer_id, customer_business_id, created_at desc, id);

create index orders_business_location_created_idx on ordering.orders using btree (business_id, location_id, created_at desc, id desc);

create index orders_business_location_status_created_idx on ordering.orders using btree (business_id, location_id, status, created_at desc, id);

create index orders_business_payment_status_created_idx on ordering.orders using btree (business_id, payment_status, created_at desc, id);

create index orders_business_source_created_idx on ordering.orders using btree (business_id, acquisition_source_id, created_at desc, id)
  where (acquisition_source_id is not null);

create index orders_customer_created_idx on ordering.orders using btree (customer_id, created_at desc, id);

create index orders_location_zone_created_idx on ordering.orders using btree (location_id, delivery_zone_id, created_at desc, id)
  where (delivery_zone_id is not null);

create index payments_business_order_created_idx on ordering.payments using btree (business_id, order_id, created_at desc, id);

create unique index payments_one_paid_per_order_key on ordering.payments using btree (order_id)
  where (status = 'paid'::text);

create unique index payments_provider_order_id_key on ordering.payments using btree (provider, provider_order_id)
  where (provider_order_id is not null);

create unique index payments_provider_payment_id_key on ordering.payments using btree (provider, provider_payment_id)
  where (provider_payment_id is not null);

create index payments_reconciliation_idx on ordering.payments using btree (status, updated_at, id)
  where (status = ANY (ARRAY['created'::text, 'pending'::text, 'authorized'::text]));

create index product_locations_location_available_product_idx on ordering.product_locations using btree (location_id, is_available, product_id);

create index product_option_groups_group_product_idx on ordering.product_option_groups using btree (option_group_id, product_id);

create index products_business_category_active_available_sort_idx on ordering.products using btree (business_id, category_id, is_active, is_available, sort_order, id);

create index refunds_order_payment_idx on ordering.refunds using btree (order_id, payment_id);

create index refunds_order_status_created_idx on ordering.refunds using btree (order_id, status, created_at desc, id);

create unique index refunds_payment_external_reference_key on ordering.refunds using btree (payment_id, lower(btrim(external_reference)))
  where (external_reference is not null);

create index refunds_payment_status_created_idx on ordering.refunds using btree (payment_id, status, created_at desc, id);

create index refunds_processed_by_idx on ordering.refunds using btree (processed_by, created_at desc, id)
  where (processed_by is not null);

create index telegram_staff_authorized_lookup_idx on ordering.telegram_staff using btree (business_id, telegram_user_id)
  where is_authorized;

create trigger business_locations_10_enforce_identity
  before update on core.business_locations
  for each row
  execute function private.enforce_business_location_identity();

create trigger businesses_provision_direct_acquisition_source
  after insert on core.businesses
  for each row
  execute function private.provision_direct_acquisition_source();

create trigger customer_business_addresses_20_enforce_identity
  before update on core.customer_business_addresses
  for each row
  execute function private.enforce_phase_b_identity();

create trigger customer_business_addresses_90_set_updated_at
  before update on core.customer_business_addresses
  for each row
  execute function private.set_updated_at();

create trigger customer_businesses_20_enforce_identity
  before update on core.customer_businesses
  for each row
  execute function private.enforce_phase_b_identity();

create trigger business_preferences_set_updated_at
  before update on notifications.business_preferences
  for each row
  execute function private.set_updated_at();

create trigger notifications_deliveries_set_updated_at
  before update on notifications.deliveries
  for each row
  execute function private.set_updated_at();

create trigger notifications_events_set_updated_at
  before update on notifications.events
  for each row
  execute function private.set_updated_at();

create trigger notifications_settings_set_updated_at
  before update on notifications.settings
  for each row
  execute function private.set_updated_at();

create trigger telegram_destinations_set_updated_at
  before update on notifications.telegram_destinations
  for each row
  execute function private.set_updated_at();

create trigger acquisition_sources_10_normalize_code
  before insert or update of code on ordering.acquisition_sources
  for each row
  execute function private.normalize_attribution_code();

create trigger acquisition_sources_20_enforce_identity
  before update on ordering.acquisition_sources
  for each row
  execute function private.enforce_phase_b_identity();

create trigger analytics_events_20_validate
  before insert or update on ordering.analytics_events
  for each row
  execute function private.validate_analytics_event();

create trigger campaigns_10_normalize_code
  before insert or update of code on ordering.campaigns
  for each row
  execute function private.normalize_attribution_code();

create trigger campaigns_20_enforce_identity
  before update on ordering.campaigns
  for each row
  execute function private.enforce_phase_b_identity();

create trigger campaigns_90_set_updated_at
  before update on ordering.campaigns
  for each row
  execute function private.set_updated_at();

create trigger cart_item_options_20_enforce_identity
  before update on ordering.cart_item_options
  for each row
  execute function private.enforce_cart_identity();

create trigger cart_item_options_30_validate_attachment
  before insert or update on ordering.cart_item_options
  for each row
  execute function private.validate_cart_item_option_attachment();

create trigger cart_items_20_enforce_identity
  before update on ordering.cart_items
  for each row
  execute function private.enforce_cart_identity();

create trigger cart_items_30_validate_tenant
  before insert or update on ordering.cart_items
  for each row
  execute function private.validate_cart_item_tenant();

create trigger cart_items_90_set_updated_at
  before update on ordering.cart_items
  for each row
  execute function private.set_updated_at();

create trigger carts_20_enforce_identity
  before update on ordering.carts
  for each row
  execute function private.enforce_cart_identity();

create trigger carts_90_set_updated_at
  before update on ordering.carts
  for each row
  execute function private.set_updated_at();

create trigger catalog_availability_windows_10_enforce_identity
  before update on ordering.catalog_availability_windows
  for each row
  execute function private.enforce_phase_c_identity();

create trigger catalog_availability_windows_20_validate_tenant
  before insert or update on ordering.catalog_availability_windows
  for each row
  execute function private.validate_phase_c_tenant_integrity();

create trigger coupon_locations_20_validate_tenant
  before insert or update on ordering.coupon_locations
  for each row
  execute function private.validate_coupon_location_tenant();

create trigger coupons_10_normalize_code
  before insert or update of code on ordering.coupons
  for each row
  execute function private.normalize_attribution_code();

create trigger coupons_20_enforce_identity_and_history
  before update on ordering.coupons
  for each row
  execute function private.enforce_coupon_identity_and_history();

create trigger coupons_90_set_updated_at
  before update on ordering.coupons
  for each row
  execute function private.set_updated_at();

create trigger delivery_zones_10_enforce_identity
  before update on ordering.delivery_zones
  for each row
  execute function private.enforce_phase_c_identity();

create trigger delivery_zones_20_validate
  before insert or update on ordering.delivery_zones
  for each row
  execute function private.validate_delivery_zone();

create trigger location_featured_products_90_set_updated_at
  before update on ordering.location_featured_products
  for each row
  execute function private.set_updated_at();

create trigger location_payment_providers_90_set_updated_at
  before update on ordering.location_payment_providers
  for each row
  execute function private.set_updated_at();

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

create trigger opening_hours_10_enforce_identity
  before update on ordering.opening_hours
  for each row
  execute function private.enforce_phase_c_identity();

create trigger opening_hours_20_validate
  before insert or update on ordering.opening_hours
  for each row
  execute function private.validate_opening_hours();

create trigger option_groups_10_enforce_identity
  before update on ordering.option_groups
  for each row
  execute function private.enforce_phase_c_identity();

create trigger options_10_enforce_identity
  before update on ordering.options
  for each row
  execute function private.enforce_phase_c_identity();

create trigger order_events_capture_notification
  after insert on ordering.order_events
  for each row
  execute function private.capture_notification_event_from_order_event();

create trigger order_events_reject_update
  before delete or update on ordering.order_events
  for each row
  execute function private.reject_order_snapshot_mutation();

create trigger order_item_options_reject_update
  before delete or update on ordering.order_item_options
  for each row
  execute function private.reject_order_snapshot_mutation();

create trigger order_items_reject_update
  before delete or update on ordering.order_items
  for each row
  execute function private.reject_order_snapshot_mutation();

create trigger orders_10_validate_financial_snapshot
  before insert on ordering.orders
  for each row
  execute function private.validate_order_financial_snapshot();

create trigger orders_15_validate_payment_method
  before insert on ordering.orders
  for each row
  execute function private.validate_order_payment_method();

create trigger orders_20_enforce_snapshot_immutability
  before update on ordering.orders
  for each row
  execute function private.enforce_order_snapshot_immutability();

create trigger orders_90_set_updated_at
  before update on ordering.orders
  for each row
  execute function private.set_updated_at();

create trigger orders_95_broadcast_change_insert
  after insert on ordering.orders
  for each row
  execute function ordering.broadcast_order_change();

create trigger orders_95_broadcast_change_update
  after update of status, payment_status on ordering.orders
  for each row
  when (((old.status IS DISTINCT FROM new.status) OR (old.payment_status IS DISTINCT FROM new.payment_status)))
  execute function ordering.broadcast_order_change();

create trigger payments_15_validate_provider_route
  before insert on ordering.payments
  for each row
  execute function private.validate_payment_provider_route();

create trigger payments_20_enforce_identity
  before update on ordering.payments
  for each row
  execute function private.enforce_payment_identity();

create trigger payments_90_set_updated_at
  before update on ordering.payments
  for each row
  execute function private.set_updated_at();

create trigger product_locations_10_enforce_identity
  before update on ordering.product_locations
  for each row
  execute function private.enforce_phase_c_identity();

create trigger product_locations_20_validate_tenant
  before insert or update on ordering.product_locations
  for each row
  execute function private.validate_phase_c_tenant_integrity();

create trigger product_option_groups_10_enforce_identity
  before update on ordering.product_option_groups
  for each row
  execute function private.enforce_phase_c_identity();

create trigger product_option_groups_20_validate_tenant
  before insert or update on ordering.product_option_groups
  for each row
  execute function private.validate_phase_c_tenant_integrity();

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

create trigger refunds_20_validate_total
  before insert or update on ordering.refunds
  for each row
  execute function private.validate_refund_total();

create trigger restaurant_settings_10_enforce_identity
  before update on ordering.restaurant_settings
  for each row
  execute function private.enforce_phase_c_identity();

create trigger restaurant_settings_90_set_updated_at
  before update on ordering.restaurant_settings
  for each row
  execute function private.set_updated_at();

create trigger restaurant_settings_capture_notification
  after update of ordering_enabled on ordering.restaurant_settings
  for each row
  when ((old.ordering_enabled IS DISTINCT FROM new.ordering_enabled))
  execute function private.capture_notification_event_from_ordering_status_change();

create trigger restaurant_settings_ordering_status_broadcast
  after update of ordering_enabled on ordering.restaurant_settings
  for each row
  when ((old.ordering_enabled IS DISTINCT FROM new.ordering_enabled))
  execute function ordering.broadcast_ordering_status();

create trigger telegram_order_messages_90_set_updated_at
  before update on ordering.telegram_order_messages
  for each row
  execute function private.set_updated_at();

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

create policy "business_users_select_own" on "core"."business_users"
  for select
  to "authenticated"
  using ((exists ( select 1
   from core.users operator_user
  where ((operator_user.id = business_users.user_id) AND (operator_user.auth_user_id = ( select auth.uid() as uid))))));

create policy "businesses_select_active_members" on "core"."businesses"
  for select
  to "authenticated"
  using ((exists ( select 1
   from (core.business_users membership
     JOIN core.users operator_user on ((operator_user.id = membership.user_id)))
  where ((membership.business_id = businesses.id) AND membership.is_active AND (operator_user.auth_user_id = ( select auth.uid() as uid))))));

create policy "businesses_update_owners_admins" on "core"."businesses"
  for update
  to "authenticated"
  using (( select private.can_manage_sensitive_business_configuration(businesses.id) as can_manage_sensitive_business_configuration))
  with check (( SELECT private.can_manage_sensitive_business_configuration(businesses.id) AS can_manage_sensitive_business_configuration));

create policy "customer_business_addresses_select_customer_or_member" on "core"."customer_business_addresses"
  for select
  to "authenticated"
  using
    ((( select private.is_customer_owner(customer_business_addresses.customer_id) as is_customer_owner) or ( select
    private.is_active_business_member(customer_business_addresses.business_id) as is_active_business_member)));

create policy "customer_businesses_select_customer_or_member" on "core"."customer_businesses"
  for select
  to "authenticated"
  using
    ((( select private.is_customer_owner(customer_businesses.customer_id) as is_customer_owner) or ( select private.is_active_business_member(customer_businesses.business_id) as
    is_active_business_member)));

create policy "customers_select_own" on "core"."customers"
  for select
  to "authenticated"
  using ((auth_user_id = ( select auth.uid() as uid)));

create policy "users_select_own" on "core"."users"
  for select
  to "authenticated"
  using ((auth_user_id = ( select auth.uid() as uid)));

create policy "acquisition_sources_insert_managers" on "ordering"."acquisition_sources"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_attribution(acquisition_sources.business_id) AS can_manage_attribution));

create policy "acquisition_sources_select_members" on "ordering"."acquisition_sources"
  for select
  to "authenticated"
  using (( select private.is_active_business_member(acquisition_sources.business_id) as is_active_business_member));

create policy "acquisition_sources_update_managers" on "ordering"."acquisition_sources"
  for update
  to "authenticated"
  using (( select private.can_manage_attribution(acquisition_sources.business_id) as can_manage_attribution))
  with check (( SELECT private.can_manage_attribution(acquisition_sources.business_id) AS can_manage_attribution));

create policy "campaigns_insert_managers" on "ordering"."campaigns"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_attribution(campaigns.business_id) AS can_manage_attribution));

create policy "campaigns_select_members" on "ordering"."campaigns"
  for select
  to "authenticated"
  using (( select private.is_active_business_member(campaigns.business_id) as is_active_business_member));

create policy "campaigns_update_managers" on "ordering"."campaigns"
  for update
  to "authenticated"
  using (( select private.can_manage_attribution(campaigns.business_id) as can_manage_attribution))
  with check (( SELECT private.can_manage_attribution(campaigns.business_id) AS can_manage_attribution));

create policy "catalog_availability_windows_delete_managers" on "ordering"."catalog_availability_windows"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(catalog_availability_windows.location_id) as can_manage_catalog_at_location));

create policy "catalog_availability_windows_insert_managers" on "ordering"."catalog_availability_windows"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(catalog_availability_windows.location_id) AS can_manage_catalog_at_location));

create policy "catalog_availability_windows_select_members" on "ordering"."catalog_availability_windows"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(catalog_availability_windows.location_id) as is_active_location_member));

create policy "catalog_availability_windows_update_managers" on "ordering"."catalog_availability_windows"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(catalog_availability_windows.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(catalog_availability_windows.location_id) AS can_manage_catalog_at_location));

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

create policy "coupons_insert_managers" on "ordering"."coupons"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_coupons(coupons.business_id) AS can_manage_coupons));

create policy "coupons_select_managers" on "ordering"."coupons"
  for select
  to "authenticated"
  using (( select private.can_manage_coupons(coupons.business_id) as can_manage_coupons));

create policy "coupons_update_managers" on "ordering"."coupons"
  for update
  to "authenticated"
  using (( select private.can_manage_coupons(coupons.business_id) as can_manage_coupons))
  with check (( SELECT private.can_manage_coupons(coupons.business_id) AS can_manage_coupons));

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

create policy "location_featured_products_delete_managers" on "ordering"."location_featured_products"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(location_featured_products.location_id) as can_manage_catalog_at_location));

create policy "location_featured_products_insert_managers" on "ordering"."location_featured_products"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(location_featured_products.location_id) AS can_manage_catalog_at_location));

create policy "location_featured_products_select_members" on "ordering"."location_featured_products"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(location_featured_products.location_id) as is_active_location_member));

create policy "location_featured_products_select_public" on "ordering"."location_featured_products"
  for select
  to "anon", "authenticated"
  using (((is_active = true) AND ((starts_at is null) or (starts_at <= now())) AND ((ends_at is null) or (ends_at > now()))));

create policy "location_featured_products_update_managers" on "ordering"."location_featured_products"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(location_featured_products.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(location_featured_products.location_id) AS can_manage_catalog_at_location));

create policy "location_payment_providers_select_managers" on "ordering"."location_payment_providers"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(location_payment_providers.location_id) as can_manage_sensitive_location_configuration));

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

create policy "orders_select_settings_managers" on "ordering"."orders"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(orders.location_id) as can_manage_sensitive_location_configuration));

create policy "product_locations_delete_managers" on "ordering"."product_locations"
  for delete
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(product_locations.location_id) as can_manage_catalog_at_location));

create policy "product_locations_insert_managers" on "ordering"."product_locations"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_catalog_at_location(product_locations.location_id) AS can_manage_catalog_at_location));

create policy "product_locations_select_members" on "ordering"."product_locations"
  for select
  to "authenticated"
  using (( select private.is_active_location_member(product_locations.location_id) as is_active_location_member));

create policy "product_locations_update_managers" on "ordering"."product_locations"
  for update
  to "authenticated"
  using (( select private.can_manage_catalog_at_location(product_locations.location_id) as can_manage_catalog_at_location))
  with check (( SELECT private.can_manage_catalog_at_location(product_locations.location_id) AS can_manage_catalog_at_location));

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

create policy "restaurant_settings_insert_owners_admins" on "ordering"."restaurant_settings"
  for insert
  to "authenticated"
  with check (( SELECT private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) AS can_manage_sensitive_location_configuration));

create policy "restaurant_settings_select_owners_admins" on "ordering"."restaurant_settings"
  for select
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) as can_manage_sensitive_location_configuration));

create policy "restaurant_settings_update_owners_admins" on "ordering"."restaurant_settings"
  for update
  to "authenticated"
  using (( select private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) as can_manage_sensitive_location_configuration))
  with check (( SELECT private.can_manage_sensitive_location_configuration(restaurant_settings.location_id) AS can_manage_sensitive_location_configuration));

comment on column "core"."customer_business_addresses"."preferred_contact_method" is 'How restaurant/rider should contact the recipient for this address: phone, whatsapp, or telegram.';

comment on column "core"."customer_business_addresses"."recipient_phone_e164" is 'Canonical E.164 phone for the recipient at this saved delivery address. Fulfillment contact, not authentication identity.';

comment on column "core"."customer_business_addresses"."telegram_username" is 'Telegram username without leading @; used only when preferred_contact_method=telegram.';

comment on column "core"."customers"."phone_e164" is 'Verified phone identity from Supabase Auth when the customer authenticates by phone. Nullable for OAuth-only customers.';

comment on column "core"."customers"."preferred_contact_method" is 'Preferred order-related contact channel for preferred_contact_phone_e164: phone or whatsapp.';

comment on column "core"."customers"."preferred_contact_phone_e164" is 'Customer-provided E.164 phone number the restaurant should use for order-related contact. Not an authentication identity and not unique.';

comment on column "ordering"."location_payment_providers"."auth_mode" is 'How this location authenticates with the provider: api_key for direct merchant credentials, oauth for partner-connected credentials.';

comment on column "ordering"."location_payment_providers"."credentials_expires_at" is 'Expiry of provider credentials when applicable, primarily OAuth access credentials. NULL for api_key auth.';

comment on column "ordering"."location_payment_providers"."environment" is 'Provider environment for this location: test or live.';

comment on column "ordering"."location_payment_providers"."webhook_secret_id" is 'Vault secret used only to verify incoming provider webhooks. Kept separate from API credentials.';

comment on column "ordering"."orders"."delivery_contact_method_snapshot" is 'Immutable fulfillment contact channel captured when the order is placed.';

comment on column "ordering"."orders"."delivery_contact_phone_snapshot" is 'Immutable E.164 fulfillment contact phone captured when the order is placed.';

comment on column "ordering"."orders"."delivery_contact_telegram_username_snapshot" is 'Immutable Telegram username (without @) captured when the order is placed.';

comment on function "core"."update_customer_profile"(text, text) is 'Updates the signed-in customer''s own display name and email. Phone fields are owned by the auth sync trigger and are intentionally not writable here.';

comment on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) is 'Attaches and deterministically merges a same-location anonymous cart after Auth.';

comment on function "ordering"."broadcast_ordering_status"() is 'Broadcasts only the accepting-orders flag for a location. Does not expose any other restaurant_settings column.';

comment on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) is 'Safe radial delivery estimate; never exposes internal delivery cost.';

comment on function "ordering"."get_public_menu"(text, uuid) is 'Safe active menu projection; excludes internal rates, costs, and inactive rows.';

comment on function "ordering"."get_storefront_menu"(uuid) is 'Returns a location-scoped customer menu, the business logo, and whether the outlet is accepting orders. Invalid or inactive locations return null.';

comment on function "ordering"."ingest_analytics_events"(jsonb) is 'Service-only batch funnel ingestion with UUID dedupe and a per-session database rate limit.';

comment on function "ordering"."list_orders_for_location"(uuid, uuid, text[], timestamp with time zone, uuid, integer, timestamp with time zone, timestamp
  with time zone) is 'Lists orders for a location queue. An optional [p_from, p_to) window narrows delivered/cancelled orders by created_at only -- open orders are always returned regardless of the window.';

comment on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) is 'Service-only, idempotent order_placed event. Invoke after verified payment/order placement with the checkout session UUID.';

comment on function "ordering"."transition_order"(uuid, text, text, text) is 'Expected-state order transition with customer/operator authorization, milestones, and one immutable event.';

comment on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) is 'Service-only Telegram bridge that authorizes a live Telegram sender and records actor_type=telegram.';

comment on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) is 'Validates one business/location coupon and returns only checkout-safe facts.';

comment on function "private"."sync_customer_from_auth_user"() is 'Links a Supabase Auth user to its core.customers row by phone_e164 whenever auth.users gains or confirms a phone number. The durable identity is auth.users.id -> core.customers.auth_user_id.';

comment on schema "core" is 'Cross-domain tenant, customer, and operator identity for A2 Ordering.';

comment on schema "ordering" is 'A2 Ordering domain. Browser-facing reads use curated RPCs; transactional, Telegram, and raw analytics base tables remain deny-by-default.';

comment on schema "private" is 'Non-exposed authorization and integrity helpers for A2 Ordering.';

comment on table "core"."business_locations" is 'Physical outlets belonging to a business tenant.';

comment on table "core"."business_users" is 'Business-scoped operator membership and role; never derived from user metadata.';

comment on table "core"."businesses" is 'Top-level tenant record. Hard deletion is not an application operation.';

comment on table "core"."customer_auth_verifications" is 'Replay guard and audit trail for MSG91 access-token verification. A repeat token_hash is rejected by the unique constraint before a Supabase Auth session is minted. Service-role only.';

comment on table "core"."customer_business_addresses" is 'Saved delivery addresses isolated to one customer-business relationship.';

comment on table "core"."customer_businesses" is 'Tenant-scoped customer relationship with immutable first-touch source.';

comment on table "core"."customers" is 'Global consumer identity. Business-specific state is stored separately.';

comment on table "core"."users" is 'Platform and restaurant operator identity; authorization comes from business_users.';

comment on table "notifications"."deliveries" is 'Per-recipient, per-channel delivery attempts fanned out from notifications.events. recipient_address is nullable only when status=skipped (e.g. no usable email). Server-only.';

comment on table "notifications"."events" is 'Durable outbox of domain notification events captured from ordering.order_events. Idempotent on dedupe_key (e.g. order:{orderId}:placed). Server-only.';

comment on table "notifications"."settings" is 'Singleton server-side notification configuration. Secret material is referenced via vault.secrets (resend_api_key_secret_id, dispatcher_auth_secret_id) and never stored in plaintext on this row.';

comment on table "ordering"."acquisition_sources" is 'Business-scoped first-touch and per-session acquisition sources.';

comment on table "ordering"."analytics_events" is 'Bounded funnel and diagnostic events. Raw events are backend-write-only; reporting uses aggregate RPCs.';

comment on table "ordering"."campaigns" is 'Business-scoped attribution campaigns; validity windows are half-open.';

comment on table "ordering"."cart_item_options" is 'Selected option quantities for a cart line.';

comment on table "ordering"."cart_items" is 'Mutable cart lines; authoritative prices are resolved from current catalog data.';

comment on table "ordering"."carts" is 'Persistent tenant/location cart owned by an anonymous bearer session or customer.';

comment on table "ordering"."catalog_availability_windows" is 'Location-specific weekly category or product availability intervals.';

comment on table "ordering"."coupon_locations" is 'Optional coupon outlet allow-list; an empty mapping means all tenant outlets.';

comment on table "ordering"."coupons" is 'Business-scoped V1 coupon definitions; one coupon may apply to a cart/order.';

comment on table "ordering"."delivery_zones" is 'Half-open radial delivery bands; estimated cost is private.';

comment on table "ordering"."menu_categories" is 'Business-wide or outlet-specific customer-facing menu categories.';

comment on table "ordering"."opening_hours" is 'ISO-weekday ordering intervals; overnight intervals belong to their start day.';

comment on table "ordering"."option_groups" is 'Reusable business-level single- or multiple-choice product option groups.';

comment on table "ordering"."options" is 'Customer-selectable options belonging to a reusable option group.';

comment on table "ordering"."orders" is 'Immutable customer/catalog/financial snapshot plus mutable operational state.';

comment on table "ordering"."payments" is 'Provider payment attempts; verified backend processing is idempotent.';

comment on table "ordering"."product_locations" is 'Optional outlet-level price and availability overrides for products.';

comment on table "ordering"."product_option_groups" is 'Many-to-many attachment of reusable option groups to products.';

comment on table "ordering"."products" is 'Business catalog products with global active and sold-out controls.';

comment on table "ordering"."refunds" is 'Manual MVP refund responsibility and completion record, separate from cancellation.';

comment on table "ordering"."restaurant_settings" is 'Location ordering configuration; benchmark and commission fields are private.';

comment on table "ordering"."telegram_order_messages" is 'Idempotent mapping between an order and a Telegram message that can be edited after state changes.';

comment on table "ordering"."telegram_staff" is 'Business-wide Telegram staff authorization. A2 MVP sends only to private staff chats; group routing is not representable in the locked schema.';

revoke all on function "core"."create_customer_business_address"(uuid, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean) from public;

grant execute
  on function "core"."create_customer_business_address"(uuid, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  to "authenticated", "postgres";

revoke all
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  from public;

grant execute
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  to "authenticated", "postgres";

revoke all
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  from public;

grant execute
  on function "core"."create_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, text, text, text, boolean)
  to "authenticated", "postgres";

revoke all on function "core"."delete_customer_business_address"(uuid) from public;

grant execute on function "core"."delete_customer_business_address"(uuid) to "authenticated", "postgres";

revoke all on function "core"."record_customer_business_visit"(uuid, uuid, uuid, timestamp with time zone) from public;

grant execute on function "core"."record_customer_business_visit"(uuid, uuid, uuid, timestamp with time zone) to "authenticated", "postgres";

revoke all on function "core"."set_default_customer_business_address"(uuid, uuid) from public;

grant execute on function "core"."set_default_customer_business_address"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "core"."update_customer_business_address"(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text) from public;

grant execute
  on function "core"."update_customer_business_address"(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  to "authenticated", "postgres";

revoke all
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  from public;

grant execute
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  to "authenticated", "postgres";

revoke all
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  from public;

grant execute
  on function "core"."update_customer_business_address_v2"(uuid, text, text, text, text, text, text, text, text, text, text, numeric, numeric, boolean, text, text, text, text)
  to "authenticated", "postgres";

revoke all on function "core"."update_customer_contact"(text, text) from public;

grant execute on function "core"."update_customer_contact"(text, text) to "authenticated", "postgres";

revoke all on function "core"."update_customer_profile"(text, text) from public;

grant execute on function "core"."update_customer_profile"(text, text) to "authenticated", "postgres";

grant execute on function "notifications"."retry_backoff"(integer) to "postgres";

revoke all on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) from public;

grant execute on function "ordering"."attach_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) to "authenticated", "postgres";

grant execute on function "ordering"."broadcast_order_change"() to "postgres";

grant execute on function "ordering"."broadcast_ordering_status"() to "postgres";

revoke all on function "ordering"."checkout_cart"(uuid, uuid, text, uuid, text, smallint, text) from public;

grant execute on function "ordering"."checkout_cart"(uuid, uuid, text, uuid, text, smallint, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."checkout_cart_v2"(uuid, uuid, text, uuid, text, smallint, text) from public;

grant execute on function "ordering"."checkout_cart_v2"(uuid, uuid, text, uuid, text, smallint, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."create_manual_refund"(uuid, uuid, uuid, numeric, text) from public;

grant execute on function "ordering"."create_manual_refund"(uuid, uuid, uuid, numeric, text) to "authenticated", "postgres";

revoke all on function "ordering"."create_payment_attempt"(uuid, uuid, text, numeric, text, text) from public;

grant execute on function "ordering"."create_payment_attempt"(uuid, uuid, text, numeric, text, text) to "postgres", "service_role";

revoke all on function "ordering"."get_analytics_diagnostics"(uuid, timestamp with time zone, timestamp with time zone) from public;

grant execute on function "ordering"."get_analytics_diagnostics"(uuid, timestamp with time zone, timestamp with time zone) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_analytics_funnel"(uuid, timestamp with time zone, timestamp with time zone) from public;

grant execute on function "ordering"."get_analytics_funnel"(uuid, timestamp with time zone, timestamp with time zone) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_cart"(uuid, uuid) from public;

grant execute on function "ordering"."get_cart"(uuid, uuid) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) from public;

grant execute on function "ordering"."get_delivery_quote"(uuid, numeric, numeric, numeric) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_featured_product_ids"(uuid, uuid) from public;

grant execute on function "ordering"."get_featured_product_ids"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_location_payment_configuration"(uuid, uuid) from public;

grant execute on function "ordering"."get_location_payment_configuration"(uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_menu"(uuid, uuid) from public;

grant execute on function "ordering"."get_menu"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_new_order_alert_duration"(uuid) from public;

grant execute on function "ordering"."get_new_order_alert_duration"(uuid) to "authenticated", "postgres";

revoke all on function "ordering"."get_order"(uuid) from public;

grant execute on function "ordering"."get_order"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_order_finance"(uuid) from public;

grant execute on function "ordering"."get_order_finance"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_payment_provider_for_order"(uuid) from public;

grant execute on function "ordering"."get_payment_provider_for_order"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."get_payment_provider_webhook_config"(uuid) from public;

grant execute on function "ordering"."get_payment_provider_webhook_config"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."get_public_menu"(text, uuid) from public;

grant execute on function "ordering"."get_public_menu"(text, uuid) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."get_storefront_menu"(uuid) from public;

grant execute on function "ordering"."get_storefront_menu"(uuid) to "anon", "authenticated", "postgres";

revoke all on function "ordering"."get_storefront_settings"(uuid) from public;

grant execute on function "ordering"."get_storefront_settings"(uuid) to "anon", "authenticated", "postgres";

revoke all on function "ordering"."get_telegram_message_payload"(uuid) from public;

grant execute on function "ordering"."get_telegram_message_payload"(uuid) to "postgres", "service_role";

revoke all on function "ordering"."ingest_analytics_events"(jsonb) from public;

grant execute on function "ordering"."ingest_analytics_events"(jsonb) to "postgres", "service_role";

revoke all on function "ordering"."list_customer_orders"(uuid, uuid, integer) from public;

grant execute on function "ordering"."list_customer_orders"(uuid, uuid, integer) to "authenticated", "postgres";

revoke all on function "ordering"."list_orders"(uuid, text[], timestamp with time zone, uuid, integer) from public;

grant execute on function "ordering"."list_orders"(uuid, text[], timestamp with time zone, uuid, integer) to "authenticated", "postgres", "service_role";

revoke all
  on function "ordering"."list_orders_for_location"(uuid, uuid, text[], timestamp with time zone, uuid, integer, timestamp with time zone, timestamp with time zone)
  from public;

grant execute
  on function "ordering"."list_orders_for_location"(uuid, uuid, text[], timestamp with time zone, uuid, integer, timestamp with time zone, timestamp with time zone)
  to "authenticated", "postgres";

revoke all on function "ordering"."list_stale_payment_attempts"(timestamp with time zone, integer) from public;

grant execute on function "ordering"."list_stale_payment_attempts"(timestamp with time zone, integer) to "postgres", "service_role";

revoke all on function "ordering"."list_telegram_reconciliation_candidates"(integer) from public;

grant execute on function "ordering"."list_telegram_reconciliation_candidates"(integer) to "postgres", "service_role";

revoke all on function "ordering"."list_telegram_staff"(uuid) from public;

grant execute on function "ordering"."list_telegram_staff"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."maintain_cart_lifecycle"(timestamp with time zone, timestamp with time zone, integer) from public;

grant execute on function "ordering"."maintain_cart_lifecycle"(timestamp with time zone, timestamp with time zone, integer) to "postgres", "service_role";

revoke all on function "ordering"."mark_payment_pending"(uuid, text, jsonb) from public;

grant execute on function "ordering"."mark_payment_pending"(uuid, text, jsonb) to "postgres", "service_role";

revoke all on function "ordering"."open_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) from public;

grant execute on function "ordering"."open_anonymous_cart"(uuid, uuid, uuid, uuid, uuid) to "anon", "postgres", "service_role";

revoke all on function "ordering"."open_customer_cart"(uuid, uuid, uuid, uuid, uuid) from public;

grant execute on function "ordering"."open_customer_cart"(uuid, uuid, uuid, uuid, uuid) to "authenticated", "postgres";

revoke all on function "ordering"."quote_cart"(uuid, uuid, text, uuid, smallint) from public;

grant execute on function "ordering"."quote_cart"(uuid, uuid, text, uuid, smallint) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."record_payment_result"(uuid, text, text, text, text, jsonb, numeric, numeric, timestamp with time zone) from public;

grant execute on function "ordering"."record_payment_result"(uuid, text, text, text, text, jsonb, numeric, numeric, timestamp with time zone) to "postgres", "service_role";

revoke all on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) from public;

grant execute on function "ordering"."record_trusted_order_placed_event"(uuid, uuid, jsonb) to "postgres", "service_role";

revoke all on function "ordering"."remove_cart_item"(uuid, uuid, uuid) from public;

grant execute on function "ordering"."remove_cart_item"(uuid, uuid, uuid) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."resolve_storefront_context"(text) from public;

grant execute on function "ordering"."resolve_storefront_context"(text) to "anon", "authenticated", "postgres";

revoke all on function "ordering"."save_business_settings"(uuid, uuid, jsonb, jsonb) from public;

grant execute on function "ordering"."save_business_settings"(uuid, uuid, jsonb, jsonb) to "authenticated", "postgres";

revoke all on function "ordering"."save_featured_product_ids"(uuid, uuid, uuid[]) from public;

grant execute on function "ordering"."save_featured_product_ids"(uuid, uuid, uuid[]) to "authenticated", "postgres";

revoke all on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean) from public;

grant execute on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean, text) from public;

grant execute on function "ordering"."save_location_payment_methods"(uuid, uuid, boolean, boolean, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."save_menu_changes"(uuid, uuid, jsonb, jsonb) from public;

grant execute on function "ordering"."save_menu_changes"(uuid, uuid, jsonb, jsonb) to "authenticated", "postgres";

revoke all on function "ordering"."save_menu_changes_with_baseline"(uuid, uuid, jsonb, jsonb, uuid[]) from public;

grant execute on function "ordering"."save_menu_changes_with_baseline"(uuid, uuid, jsonb, jsonb, uuid[]) to "authenticated", "postgres";

revoke all on function "ordering"."set_cart_coupon"(uuid, uuid, text) from public;

grant execute on function "ordering"."set_cart_coupon"(uuid, uuid, text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."set_cart_item"(uuid, uuid, uuid, uuid, integer, text, jsonb) from public;

grant execute on function "ordering"."set_cart_item"(uuid, uuid, uuid, uuid, integer, text, jsonb) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "ordering"."set_manual_refund_status"(uuid, text, text) from public;

grant execute on function "ordering"."set_manual_refund_status"(uuid, text, text) to "authenticated", "postgres";

revoke all on function "ordering"."set_new_order_alert_duration"(uuid, uuid, timestamp with time zone, smallint) from public;

grant execute on function "ordering"."set_new_order_alert_duration"(uuid, uuid, timestamp with time zone, smallint) to "authenticated", "postgres";

revoke all on function "ordering"."set_order_restaurant_note"(uuid, text) from public;

grant execute on function "ordering"."set_order_restaurant_note"(uuid, text) to "authenticated", "postgres";

revoke all on function "ordering"."transition_order"(uuid, text, text, text) from public;

grant execute on function "ordering"."transition_order"(uuid, text, text, text) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."transition_order_at_location"(uuid, uuid, uuid, text, text, text) from public;

grant execute on function "ordering"."transition_order_at_location"(uuid, uuid, uuid, text, text, text) to "authenticated", "postgres";

revoke all on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) from public;

grant execute on function "ordering"."transition_order_from_telegram"(uuid, text, text, bigint, text) to "postgres", "service_role";

revoke all on function "ordering"."upsert_telegram_order_message"(uuid, bigint, bigint, text) from public;

grant execute on function "ordering"."upsert_telegram_order_message"(uuid, bigint, bigint, text) to "postgres", "service_role";

revoke all on function "ordering"."upsert_telegram_staff"(uuid, bigint, text, boolean) from public;

grant execute on function "ordering"."upsert_telegram_staff"(uuid, bigint, text, boolean) to "authenticated", "postgres", "service_role";

revoke all on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) from public;

grant execute on function "ordering"."validate_coupon"(uuid, uuid, text, numeric, timestamp with time zone) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "private"."analytics_metadata_has_forbidden_key"(jsonb) from public;

grant execute on function "private"."analytics_metadata_has_forbidden_key"(jsonb) to "postgres";

revoke all on function "private"."calculate_order_quote"(uuid, text, uuid, smallint, timestamp with time zone) from public;

grant execute on function "private"."calculate_order_quote"(uuid, text, uuid, smallint, timestamp with time zone) to "postgres";

revoke all on function "private"."can_access_cart"(uuid, uuid) from public;

grant execute on function "private"."can_access_cart"(uuid, uuid) to "postgres";

revoke all on function "private"."can_manage_attribution"(uuid) from public;

grant execute on function "private"."can_manage_attribution"(uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_catalog"(uuid) from public;

grant execute on function "private"."can_manage_catalog"(uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_catalog_at_location"(uuid) from public;

grant execute on function "private"."can_manage_catalog_at_location"(uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_coupon_mapping"(uuid, uuid) from public;

grant execute on function "private"."can_manage_coupon_mapping"(uuid, uuid) to "authenticated", "postgres";

revoke all on function "private"."can_manage_coupons"(uuid) from public;

grant execute on function "private"."can_manage_coupons"(uuid) to "authenticated", "postgres";

grant execute on function "private"."can_manage_sensitive_business_configuration"(uuid) to "postgres";

revoke all on function "private"."can_manage_sensitive_location_configuration"(uuid) from public;

grant execute on function "private"."can_manage_sensitive_location_configuration"(uuid) to "authenticated", "postgres";

revoke all on function "private"."can_operate_orders"(uuid) from public;

grant execute on function "private"."can_operate_orders"(uuid) to "postgres";

revoke all on function "private"."can_view_order"(uuid, uuid) from public;

grant execute on function "private"."can_view_order"(uuid, uuid) to "postgres";

revoke all on function "private"."can_view_order_finance"(uuid) from public;

grant execute on function "private"."can_view_order_finance"(uuid) to "postgres";

revoke all on function "private"."capture_daily_sales_summary_notification_events"() from public;

grant execute on function "private"."capture_daily_sales_summary_notification_events"() to "postgres";

grant execute on function "private"."capture_notification_event_from_order_event"() to "postgres";

grant execute on function "private"."capture_notification_event_from_ordering_status_change"() to "postgres";

revoke all on function "private"."capture_waiting_order_notification_events"() from public;

grant execute on function "private"."capture_waiting_order_notification_events"() to "postgres";

revoke all on function "private"."catalog_target_available_at"(uuid, uuid, uuid, timestamp with time zone) from public;

grant execute on function "private"."catalog_target_available_at"(uuid, uuid, uuid, timestamp with time zone) to "postgres";

revoke all on function "private"."current_cart_subtotal"(uuid) from public;

grant execute on function "private"."current_cart_subtotal"(uuid) to "postgres";

grant execute on function "private"."customer_can_access_location"(uuid) to "postgres";

grant execute on function "private"."enforce_business_location_identity"() to "postgres";

revoke all on function "private"."enforce_cart_identity"() from public;

grant execute on function "private"."enforce_cart_identity"() to "postgres";

revoke all on function "private"."enforce_coupon_identity_and_history"() from public;

grant execute on function "private"."enforce_coupon_identity_and_history"() to "postgres";

revoke all on function "private"."enforce_order_snapshot_immutability"() from public;

grant execute on function "private"."enforce_order_snapshot_immutability"() to "postgres";

revoke all on function "private"."enforce_payment_identity"() from public;

grant execute on function "private"."enforce_payment_identity"() to "postgres";

revoke all on function "private"."enforce_phase_b_identity"() from public;

grant execute on function "private"."enforce_phase_b_identity"() to "postgres";

revoke all on function "private"."enforce_phase_c_identity"() from public;

grant execute on function "private"."enforce_phase_c_identity"() to "postgres";

revoke all on function "private"."haversine_distance_km"(numeric, numeric, numeric, numeric) from public;

grant execute on function "private"."haversine_distance_km"(numeric, numeric, numeric, numeric) to "postgres";

revoke all on function "private"."is_active_business_member"(uuid) from public;

grant execute on function "private"."is_active_business_member"(uuid) to "authenticated", "postgres";

revoke all on function "private"."is_active_location_member"(uuid) from public;

grant execute on function "private"."is_active_location_member"(uuid) to "authenticated", "postgres";

revoke all on function "private"."is_customer_owner"(uuid) from public;

grant execute on function "private"."is_customer_owner"(uuid) to "authenticated", "postgres";

revoke all on function "private"."is_location_open_at"(uuid, timestamp with time zone) from public;

grant execute on function "private"."is_location_open_at"(uuid, timestamp with time zone) to "postgres";

revoke all on function "private"."normalize_attribution_code"() from public;

grant execute on function "private"."normalize_attribution_code"() to "postgres";

revoke all on function "private"."normalize_delivery_phone"(text) from public;

grant execute on function "private"."normalize_delivery_phone"(text) to "postgres";

revoke all on function "private"."provision_direct_acquisition_source"() from public;

grant execute on function "private"."provision_direct_acquisition_source"() to "postgres";

revoke all on function "private"."reject_order_snapshot_mutation"() from public;

grant execute on function "private"."reject_order_snapshot_mutation"() to "postgres";

revoke all on function "private"."request_is_service_role"() from public;

grant execute on function "private"."request_is_service_role"() to "postgres";

revoke all on function "private"."set_updated_at"() from public;

grant execute on function "private"."set_updated_at"() to "postgres";

revoke all on function "private"."snapshot_order_item_id"(uuid, uuid) from public;

grant execute on function "private"."snapshot_order_item_id"(uuid, uuid) to "postgres";

grant execute on function "private"."sync_customer_from_auth_user"() to "postgres";

revoke all on function "private"."transition_order_internal"(uuid, text, text, text, text, bigint) from public;

grant execute on function "private"."transition_order_internal"(uuid, text, text, text, text, bigint) to "postgres";

revoke all on function "private"."validate_analytics_event"() from public;

grant execute on function "private"."validate_analytics_event"() to "postgres";

revoke all on function "private"."validate_cart_item_option_attachment"() from public;

grant execute on function "private"."validate_cart_item_option_attachment"() to "postgres";

revoke all on function "private"."validate_cart_item_tenant"() from public;

grant execute on function "private"."validate_cart_item_tenant"() to "postgres";

revoke all on function "private"."validate_coupon_location_tenant"() from public;

grant execute on function "private"."validate_coupon_location_tenant"() to "postgres";

revoke all on function "private"."validate_delivery_zone"() from public;

grant execute on function "private"."validate_delivery_zone"() to "postgres";

revoke all on function "private"."validate_menu_category_scope"() from public;

grant execute on function "private"."validate_menu_category_scope"() to "postgres";

revoke all on function "private"."validate_opening_hours"() from public;

grant execute on function "private"."validate_opening_hours"() to "postgres";

revoke all on function "private"."validate_order_financial_snapshot"() from public;

grant execute on function "private"."validate_order_financial_snapshot"() to "postgres";

grant execute on function "private"."validate_order_payment_method"() to "postgres";

grant execute on function "private"."validate_payment_provider_route"() to "postgres";

revoke all on function "private"."validate_phase_c_tenant_integrity"() from public;

grant execute on function "private"."validate_phase_c_tenant_integrity"() to "postgres";

revoke all on function "private"."validate_product_category_assignment"() from public;

grant execute on function "private"."validate_product_category_assignment"() to "postgres";

revoke all on function "private"."validate_refund_total"() from public;

grant execute on function "private"."validate_refund_total"() to "postgres";

revoke all on function "public"."notifications_claim_deliveries"(integer, integer) from public;

grant execute on function "public"."notifications_claim_deliveries"(integer, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_claim_events"(integer, integer) from public;

grant execute on function "public"."notifications_claim_events"(integer, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_claim_telegram_webhook_update"(bigint) from public;

grant execute on function "public"."notifications_claim_telegram_webhook_update"(bigint) to "postgres", "service_role";

revoke all on function "public"."notifications_consume_telegram_pairing"(text, text, text, text, text) from public;

grant execute on function "public"."notifications_consume_telegram_pairing"(text, text, text, text, text) to "postgres", "service_role";

revoke all on function "public"."notifications_create_telegram_pairing_token"(text, uuid, uuid) from public;

grant execute on function "public"."notifications_create_telegram_pairing_token"(text, uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_get_business_preferences"(uuid) from public;

grant execute on function "public"."notifications_get_business_preferences"(uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_get_dispatcher_config"() from public;

grant execute on function "public"."notifications_get_dispatcher_config"() to "postgres", "service_role";

revoke all on function "public"."notifications_get_location_context"(uuid, date) from public;

grant execute on function "public"."notifications_get_location_context"(uuid, date) to "postgres", "service_role";

revoke all on function "public"."notifications_get_order_context"(uuid) from public;

grant execute on function "public"."notifications_get_order_context"(uuid) to "postgres", "service_role";

revoke all on function "public"."notifications_get_telegram_connection_status"(uuid, uuid) from public;

grant execute on function "public"."notifications_get_telegram_connection_status"(uuid, uuid) to "authenticated", "postgres", "service_role";

revoke all on function "public"."notifications_get_telegram_webhook_config"() from public;

grant execute on function "public"."notifications_get_telegram_webhook_config"() to "postgres", "service_role";

revoke all on function "public"."notifications_mark_event_failed"(uuid, text, integer) from public;

grant execute on function "public"."notifications_mark_event_failed"(uuid, text, integer) to "postgres", "service_role";

revoke all on function "public"."notifications_plan_event"(uuid, jsonb) from public;

grant execute on function "public"."notifications_plan_event"(uuid, jsonb) to "postgres", "service_role";

revoke all on function "public"."notifications_record_delivery_result"(uuid, text, text, text, text, integer, text) from public;

grant execute on function "public"."notifications_record_delivery_result"(uuid, text, text, text, text, integer, text) to "postgres", "service_role";

revoke all on function "public"."notifications_set_business_preferences"(uuid, boolean) from public;

grant execute on function "public"."notifications_set_business_preferences"(uuid, boolean) to "authenticated", "postgres", "service_role";

grant usage on schema "core" to "authenticated";

grant create, usage on schema "core" to "postgres";

grant usage on schema "core" to "service_role";

grant create, usage on schema "notifications" to "postgres";

grant usage on schema "ordering" to "anon", "authenticated";

grant create, usage on schema "ordering" to "postgres";

grant usage on schema "ordering" to "service_role";

grant usage on schema "private" to "authenticated";

grant create, usage on schema "private" to "postgres";

grant select, update on table "core"."business_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."business_locations" to "postgres", "service_role";

grant select on table "core"."business_users" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."business_users" to "postgres", "service_role";

grant select, update on table "core"."businesses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."businesses" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_auth_verifications" to "postgres", "service_role";

grant select on table "core"."customer_business_addresses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_business_addresses" to "postgres", "service_role";

grant select on table "core"."customer_businesses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customer_businesses" to "postgres", "service_role";

grant select on table "core"."customers" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customers" to "postgres", "service_role";

grant select on table "core"."users" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."users" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."business_preferences" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."deliveries" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."events" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."settings" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_destinations" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_pairing_tokens" to "postgres";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_webhook_updates" to "postgres";

grant insert, select, update on table "ordering"."acquisition_sources" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."acquisition_sources" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."analytics_events" to "postgres", "service_role";

grant insert, select, update on table "ordering"."campaigns" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."campaigns" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."cart_item_options" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."cart_items" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."carts" to "postgres", "service_role";

grant delete, insert, select, update on table "ordering"."catalog_availability_windows" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."catalog_availability_windows" to "postgres", "service_role";

grant delete, insert, select on table "ordering"."coupon_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."coupon_locations" to "postgres", "service_role";

grant insert, select, update on table "ordering"."coupons" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."coupons" to "postgres", "service_role";

grant delete, insert, select, update on table "ordering"."delivery_zones" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."delivery_zones" to "postgres", "service_role";

grant select on table "ordering"."location_featured_products" to "anon";

grant delete, insert, select, update on table "ordering"."location_featured_products" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."location_featured_products" to "postgres", "service_role";

grant select on table "ordering"."location_payment_providers" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."location_payment_providers" to "postgres", "service_role";

grant insert, select, update on table "ordering"."menu_categories" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."menu_categories" to "postgres", "service_role";

grant delete, insert, select, update on table "ordering"."opening_hours" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."opening_hours" to "postgres", "service_role";

grant insert, select, update on table "ordering"."option_groups" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."option_groups" to "postgres", "service_role";

grant insert, select, update on table "ordering"."options" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."options" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_events" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_item_options" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_items" to "postgres", "service_role";

grant select on table "ordering"."orders" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."orders" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."payments" to "postgres", "service_role";

grant delete, insert, select, update on table "ordering"."product_locations" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."product_locations" to "postgres", "service_role";

grant delete, insert, select, update on table "ordering"."product_option_groups" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."product_option_groups" to "postgres", "service_role";

grant insert, select, update on table "ordering"."products" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."products" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."refunds" to "postgres", "service_role";

grant insert, select, update on table "ordering"."restaurant_settings" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."restaurant_settings" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."telegram_order_messages" to "postgres", "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."telegram_staff" to "postgres", "service_role";

alter default privileges for role "postgres" in schema "core" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "core" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

alter default privileges for role "postgres" in schema "ordering" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "ordering" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "anon";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "authenticated";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "anon";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "authenticated";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "service_role";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "anon";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "authenticated";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

-- Custom application trigger on the Supabase-managed auth.users table.
-- Auth accounts themselves are not part of this baseline or the planned data import.
create trigger auth_users_10_sync_customer
  after insert or update of phone, phone_confirmed_at on auth.users
  for each row
  execute function private.sync_customer_from_auth_user();
