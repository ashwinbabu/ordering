create table "notifications"."business_preferences" (
  "business_id"                  uuid                     not null,
  "notify_owner_on_cancellation" boolean                  not null default false,
  "created_at"                   timestamp with time zone not null default now(),
  "updated_at"                   timestamp with time zone not null default now(),
  constraint "business_preferences_business_id_fkey" foreign key (business_id) references core.businesses(id),
  constraint "business_preferences_pkey" primary key (business_id)
);

alter table "notifications"."business_preferences"
  enable row level security;

create trigger business_preferences_set_updated_at
  before update on notifications.business_preferences
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."business_preferences" to "postgres";
