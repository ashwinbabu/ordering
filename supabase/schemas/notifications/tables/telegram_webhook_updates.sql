create table "notifications"."telegram_webhook_updates" (
  "update_id"   bigint                   not null,
  "received_at" timestamp with time zone not null default now(),
  constraint "telegram_webhook_updates_pkey" primary key (update_id)
);

alter table "notifications"."telegram_webhook_updates"
  enable row level security;

grant delete, insert, maintain, references, select, trigger, truncate, update on table "notifications"."telegram_webhook_updates" to "postgres";
