create table "core"."users" (
  "id"           uuid                     not null default gen_random_uuid(),
  "auth_user_id" uuid,
  "name"         text                     not null,
  "email"        text,
  "phone"        text,
  "created_at"   timestamp with time zone not null default now(),
  constraint "users_auth_user_id_fkey" foreign key (auth_user_id) references auth.users(id) on delete set null,
  constraint "users_email_check" check (((email IS NULL) OR ((email = btrim(email)) AND ((char_length(email) >= 3) AND (char_length(email) <= 320))))),
  constraint "users_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "users_phone_check" check (((phone IS NULL) OR ((phone = btrim(phone)) AND ((char_length(phone) >= 5) AND (char_length(phone) <= 32))))),
  constraint "users_pkey" primary key (id)
);

alter table "core"."users"
  enable row level security;

create unique index users_auth_user_id_key on core.users using btree (auth_user_id)
  where (auth_user_id is not null);

create unique index users_email_normalized_key on core.users using btree (lower(btrim(email)))
  where (email is not null);

create policy "users_select_own" on "core"."users"
  for select
  to "authenticated"
  using ((auth_user_id = ( select auth.uid() as uid)));

grant select on table "core"."users" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."users" to "postgres", "service_role";

comment on table "core"."users" is 'Platform and restaurant operator identity; authorization comes from business_users.';
