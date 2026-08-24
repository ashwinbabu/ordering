create table "core"."business_users" (
  "id"          uuid                     not null default gen_random_uuid(),
  "user_id"     uuid                     not null,
  "business_id" uuid                     not null,
  "role"        text                     not null,
  "is_active"   boolean                  not null default true,
  "created_at"  timestamp with time zone not null default now(),
  constraint "business_users_business_id_user_id_key" unique (business_id, user_id),
  constraint "business_users_pkey" primary key (id),
  constraint "business_users_role_check" check ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text]))),
  constraint "business_users_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "business_users_user_id_fkey" foreign key (user_id) references core.users(id) on delete restrict
);

alter table "core"."business_users"
  enable row level security;

create index business_users_business_active_role_user_idx on core.business_users using btree (business_id, is_active, role, user_id);

create index business_users_user_active_business_role_idx on core.business_users using btree (user_id, is_active, business_id, role);

create policy "business_users_select_own" on "core"."business_users"
  for select
  to "authenticated"
  using ((exists ( select 1
   from core.users operator_user
  where ((operator_user.id = business_users.user_id) AND (operator_user.auth_user_id = ( select auth.uid() as uid))))));

grant select on table "core"."business_users" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."business_users" to "postgres", "service_role";

comment on table "core"."business_users" is 'Business-scoped operator membership and role; never derived from user metadata.';
