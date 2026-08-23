create table "ordering"."telegram_order_messages" (
  "id"                   uuid                     not null default gen_random_uuid(),
  "order_id"             uuid                     not null,
  "telegram_chat_id"     bigint                   not null,
  "telegram_message_id"  bigint                   not null,
  "last_rendered_status" text                     not null,
  "created_at"           timestamp with time zone not null default now(),
  "updated_at"           timestamp with time zone not null default now(),
  constraint "telegram_order_messages_chat_message_key" unique (telegram_chat_id, telegram_message_id),
  constraint "telegram_order_messages_message_id_check" check ((telegram_message_id > 0)),
  constraint "telegram_order_messages_order_chat_key" unique (order_id, telegram_chat_id),
  constraint "telegram_order_messages_order_id_fkey" foreign key (order_id) references ordering.orders(id) on delete restrict,
  constraint "telegram_order_messages_pkey" primary key (id),
  constraint "telegram_order_messages_status_check"
    check
    ((last_rendered_status = ANY (ARRAY['payment_pending'::text, 'placed'::text, 'accepted'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'delivered'::text,
    'needs_attention'::text, 'cancelled'::text]))),
  constraint "telegram_order_messages_updated_at_check" check ((updated_at >= created_at))
);

alter table "ordering"."telegram_order_messages"
  enable row level security;

create trigger telegram_order_messages_90_set_updated_at
  before update on ordering.telegram_order_messages
  for each row
  execute function private.set_updated_at();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."telegram_order_messages" to "postgres", "service_role";

comment on table "ordering"."telegram_order_messages" is 'Idempotent mapping between an order and a Telegram message that can be edited after state changes.';
