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
  constraint "telegram_destinations_business_id_fkey" foreign key (business_id) references core.businesses(id),
  constraint "telegram_destinations_business_user_id_fkey" foreign key (business_user_id) references core.business_users(id),
  constraint "telegram_destinations_destination_type_check" check ((destination_type = ANY (ARRAY['staff_group'::text, 'business_user'::text]))),
  constraint "telegram_destinations_location_id_fkey" foreign key (location_id) references core.business_locations(id),
  constraint "telegram_destinations_pkey" primary key (id),
  constraint "telegram_destinations_shape_check" check ((((destination_type = 'staff_group'::text) AND (location_id IS
    NOT NULL) AND (business_user_id IS NULL) AND (telegram_chat_type = ANY (ARRAY['group'::text, 'supergroup'::text]))) OR
    ((destination_type = 'business_user'::text) AND (business_user_id IS NOT NULL) AND (telegram_chat_type = 'private'::text)))),
  constraint "telegram_destinations_telegram_chat_type_check" check ((telegram_chat_type = ANY (ARRAY['private'::text, 'group'::text, 'supergroup'::text])))
);

alter table "notifications"."telegram_destinations"
  enable row level security;

create unique index telegram_destinations_active_business_user_idx on notifications.telegram_destinations using btree (business_user_id)
  where ((destination_type = 'business_user'::text) AND is_active);

create unique index telegram_destinations_active_staff_group_idx on notifications.telegram_destinations using btree (business_id, location_id)
  where ((destination_type = 'staff_group'::text) AND is_active);

create index telegram_destinations_business_id_idx on notifications.telegram_destinations using btree (business_id);

create trigger telegram_destinations_set_updated_at
  before update on notifications.telegram_destinations
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_destinations" to "postgres";
