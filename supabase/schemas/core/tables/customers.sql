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
  constraint "customers_auth_user_id_fkey" foreign key (auth_user_id) references auth.users(id) on delete set null,
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

create unique index customers_auth_user_id_key on core.customers using btree (auth_user_id)
  where (auth_user_id is not null);

create policy "customers_select_own" on "core"."customers"
  for select
  to "authenticated"
  using ((auth_user_id = ( select auth.uid() as uid)));

grant select on table "core"."customers" to "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "core"."customers" to "postgres", "service_role";

comment on column "core"."customers"."phone_e164" is 'Verified phone identity from Supabase Auth when the customer authenticates by phone. Nullable for OAuth-only customers.';

comment on column "core"."customers"."preferred_contact_method" is 'Preferred order-related contact channel for preferred_contact_phone_e164: phone or whatsapp.';

comment on column "core"."customers"."preferred_contact_phone_e164" is 'Customer-provided E.164 phone number the restaurant should use for order-related contact. Not an authentication identity and not unique.';

comment on table "core"."customers" is 'Global consumer identity. Business-specific state is stored separately.';
