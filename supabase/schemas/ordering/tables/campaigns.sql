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
  constraint "campaigns_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
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

create unique index campaigns_business_code_normalized_key on ordering.campaigns using btree (business_id, lower(btrim(code)));

create index campaigns_business_status_window_idx on ordering.campaigns using btree (business_id, status, starts_at, ends_at);

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

grant insert, select, update on table "ordering"."campaigns" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."campaigns" to "postgres", "service_role";

comment on table "ordering"."campaigns" is 'Business-scoped attribution campaigns; validity windows are half-open.';
