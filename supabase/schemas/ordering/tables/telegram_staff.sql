create table "ordering"."telegram_staff" (
  "id"               uuid                     not null default gen_random_uuid(),
  "business_id"      uuid                     not null,
  "telegram_user_id" bigint                   not null,
  "display_name"     text                     not null,
  "is_authorized"    boolean                  not null default true,
  "created_at"       timestamp with time zone not null default now(),
  constraint "telegram_staff_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "telegram_staff_business_telegram_user_key" unique (business_id, telegram_user_id),
  constraint "telegram_staff_display_name_check" check (((display_name = btrim(display_name)) AND ((char_length(display_name) >= 1) AND (char_length(display_name) <= 200)))),
  constraint "telegram_staff_pkey" primary key (id),
  constraint "telegram_staff_telegram_user_id_check" check ((telegram_user_id > 0))
);

alter table "ordering"."telegram_staff"
  enable row level security;

create index telegram_staff_authorized_lookup_idx on ordering.telegram_staff using btree (business_id, telegram_user_id)
  where is_authorized;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."telegram_staff" to "postgres", "service_role";

comment on table "ordering"."telegram_staff" is 'Business-wide Telegram staff authorization. A2 MVP sends only to private staff chats; group routing is not representable in the locked schema.';
