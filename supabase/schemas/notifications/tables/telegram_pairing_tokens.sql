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
  constraint "telegram_pairing_tokens_business_id_fkey" foreign key (business_id) references core.businesses(id),
  constraint "telegram_pairing_tokens_business_user_id_fkey" foreign key (business_user_id) references core.business_users(id),
  constraint "telegram_pairing_tokens_created_by_fkey" foreign key (created_by) references auth.users(id),
  constraint "telegram_pairing_tokens_destination_type_check" check ((destination_type = ANY (ARRAY['staff_group'::text, 'business_user'::text]))),
  constraint "telegram_pairing_tokens_location_id_fkey" foreign key (location_id) references core.business_locations(id),
  constraint "telegram_pairing_tokens_pkey" primary key (id),
  constraint "telegram_pairing_tokens_shape_check" check ((((destination_type = 'staff_group'::text) AND (location_id IS
    NOT NULL) AND (business_user_id IS NULL)) OR ((destination_type = 'business_user'::text) AND (business_user_id IS NOT NULL)))),
  constraint "telegram_pairing_tokens_token_hash_key" unique (token_hash)
);

alter table "notifications"."telegram_pairing_tokens"
  enable row level security;

create index telegram_pairing_tokens_lookup_idx on notifications.telegram_pairing_tokens using btree (token_hash)
  where (consumed_at is null);

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_pairing_tokens" to "postgres";
