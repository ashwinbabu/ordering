create table "ordering"."acquisition_sources" (
  "id"          uuid    not null default gen_random_uuid(),
  "business_id" uuid    not null,
  "campaign_id" uuid,
  "code"        text    not null,
  "name"        text    not null,
  "channel"     text    not null,
  "is_active"   boolean not null default true,
  constraint "acquisition_sources_business_id_fkey" foreign key (business_id) references core.businesses(id) on delete restrict,
  constraint "acquisition_sources_business_id_id_key" unique (business_id, id),
  constraint "acquisition_sources_channel_check"
    check (((channel = lower(btrim(channel))) AND ((char_length(channel) >= 1) AND (char_length(channel) <= 50)) AND (channel ~ '^[a-z][a-z0-9_-]*$'::text))),
  constraint "acquisition_sources_code_check"
    check (((code = upper(btrim(code))) AND ((char_length(code) >= 2) AND (char_length(code) <= 100)) AND (code ~ '^[A-Z0-9]+([_-][A-Z0-9]+)*$'::text))),
  constraint "acquisition_sources_direct_check" check (((code <> 'DIRECT'::text) OR ((campaign_id IS NULL) AND (channel = 'direct'::text) AND is_active))),
  constraint "acquisition_sources_name_check" check (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 200)))),
  constraint "acquisition_sources_pkey" primary key (id),
  constraint "acquisition_sources_business_id_campaign_id_fkey" foreign key (business_id, campaign_id) references ordering.campaigns(business_id, id) on delete restrict
);

alter table "ordering"."acquisition_sources"
  enable row level security;

create index acquisition_sources_business_active_idx on ordering.acquisition_sources using btree (business_id, is_active, id);

create index acquisition_sources_business_campaign_idx on ordering.acquisition_sources using btree (business_id, campaign_id);

create unique index acquisition_sources_business_code_normalized_key on ordering.acquisition_sources using btree (business_id, lower(btrim(code)));

create trigger acquisition_sources_10_normalize_code
  before insert or update of code on ordering.acquisition_sources
  for each row
  execute function private.normalize_attribution_code();

create trigger acquisition_sources_20_enforce_identity
  before update on ordering.acquisition_sources
  for each row
  execute function private.enforce_phase_b_identity();

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

grant insert, select, update on table "ordering"."acquisition_sources" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."acquisition_sources" to "postgres", "service_role";

comment on table "ordering"."acquisition_sources" is 'Business-scoped first-touch and per-session acquisition sources.';
