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

create unique index businesses_slug_normalized_key on core.businesses using btree (lower(btrim(slug)));

create trigger businesses_provision_direct_acquisition_source
  after insert on core.businesses
  for each row
  execute function private.provision_direct_acquisition_source();

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

grant select, update on table "core"."businesses" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."businesses" to "postgres", "service_role";

comment on table "core"."businesses" is 'Top-level tenant record. Hard deletion is not an application operation.';
