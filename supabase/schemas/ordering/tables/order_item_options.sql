create table "ordering"."order_item_options" (
  "id"                uuid          not null default gen_random_uuid(),
  "order_item_id"     uuid          not null,
  "option_group_name" text          not null,
  "option_id"         uuid          not null,
  "option_name"       text          not null,
  "price_delta"       numeric(14,2) not null,
  "quantity"          integer       not null,
  constraint "order_item_options_group_name_check"
    check (((option_group_name = btrim(option_group_name)) AND ((char_length(option_group_name) >= 1) AND (char_length(option_group_name) <= 200)))),
  constraint "order_item_options_option_id_fkey" foreign key (option_id) references ordering.options(id) on delete restrict,
  constraint "order_item_options_option_name_check" check (((option_name = btrim(option_name)) AND ((char_length(option_name) >= 1) AND (char_length(option_name) <= 200)))),
  constraint "order_item_options_pkey" primary key (id),
  constraint "order_item_options_price_delta_check" check ((price_delta >= (0)::numeric)),
  constraint "order_item_options_quantity_check" check ((quantity > 0)),
  constraint "order_item_options_order_item_id_fkey" foreign key (order_item_id) references ordering.order_items(id) on delete restrict
);

alter table "ordering"."order_item_options"
  enable row level security;

create index order_item_options_item_idx on ordering.order_item_options using btree (order_item_id, id);

create index order_item_options_option_item_idx on ordering.order_item_options using btree (option_id, order_item_id);

create trigger order_item_options_reject_update
  before delete or update on ordering.order_item_options
  for each row
  execute function private.reject_order_snapshot_mutation();

grant delete, insert, maintain, references, select, trigger, truncate, update on table "ordering"."order_item_options" to "postgres", "service_role";
